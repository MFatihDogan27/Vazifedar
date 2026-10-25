// "Bugün" ekranı: 24 saatlik kadran, geri sayım blokları, günün akışı, boşluğa sığan görevler, bu hafta.
import { h, toast, onColor } from './ui.js';
import { state, commit, occurrencesInRange, category, upsertEvent, upsertTask, priority, absenceInfo, taskCategory, dueDate } from './store.js';
import {
  startOfDay, addDays, addMinutes, timeStr, daysBetween, fmtDateShort, durationText, toLocalISO,
  GUNLER, GUNLER_KISA, AYLAR, isoWeekday, parseLocal, startOfWeek, hmToMin,
} from './dates.js';
import { openOccurrence, openTaskForm, openEventForm, openScheduleTask } from './forms.js';
import { ic } from './icons.js';
import { sortTasks, tickButton, completeTask } from './tasks.js';
import { VAKITLER, prayerEnabled, prayerSettings, timesFor, prayerNow, locationLabel } from './prayer.js';
import { bagCard, bagMode, pinsForOcc } from './notes.js';
import { journalPrompt } from './journal.js';
import { textureKey, svgPattern, themedCard } from './themes.js';
import { sleepSpans, nightsInRange, openNight, sleepCard } from './sleep.js';

export function termWeek(date) {
  const { start, end } = state.term;
  if (!start || !end) return null;
  const s = startOfWeek(parseLocal(start));
  const total = Math.ceil((daysBetween(s, parseLocal(end)) + 1) / 7);
  const n = Math.floor(daysBetween(s, date) / 7) + 1;
  if (n < 1 || n > total) return null;
  return { n, total };
}

const minsLeft = (a, b) => Math.max(0, Math.round((b - a) / 60000));
function inText(min) {
  if (min < 60) return `${min} dk`;
  const hh = Math.floor(min / 60), mm = min % 60;
  return mm ? `${hh} sa ${mm} dk` : `${hh} sa`;
}

// Bugünün kalan kısmındaki en uzun boşluk (görev yerleştirme saatleri içinde)
function longestGap(timed, now) {
  const day = startOfDay(now);
  const winStart = addMinutes(day, hmToMin(state.settings.freeSlotStart || '09:00'));
  const winEnd = addMinutes(day, hmToMin(state.settings.freeSlotEnd || '22:00'));
  let cursor = new Date(Math.max(now, winStart));
  const r = cursor.getMinutes() % 5; if (r) cursor = addMinutes(cursor, 5 - r);
  cursor.setSeconds(0, 0);
  let best = null;
  const busy = [...timed, ...nightsInRange(day, addDays(day, 1))].filter((o) => o.end > cursor && o.start < winEnd).sort((a, b) => a.start - b.start);
  for (const o of busy) {
    if (o.start > cursor) {
      const g = { start: cursor, end: new Date(Math.min(o.start, winEnd)) };
      if (!best || g.end - g.start > best.end - best.start) best = g;
    }
    if (o.end > cursor) cursor = o.end;
  }
  if (cursor < winEnd) {
    const g = { start: cursor, end: winEnd };
    if (!best || g.end - g.start > best.end - best.start) best = g;
  }
  return best && best.end - best.start >= 15 * 60000 ? best : null;
}

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
};
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const occLabel = (o) => (o.kind === 'course' ? (o.ref.code || o.title) : o.title);
// Sekiz köşeli yıldız (çini motifi)
const star8 = (cx, cy, r) => {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2, rr = i % 2 ? r * 0.55 : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }
  return `${d}Z`;
};

// ---- Kadran: 24 saatlik gün; öğlen tepede, gece yarısı altta ----
// Bitiş anı bir kez oynasın (dakikalık yenilemelerde tekrar etmesin; aynı anda gelen yeniden çizimlerde kaybolmasın)
const closedShown = new Map();

function buildDial(day, now, timed, gap, prayers = [], pins = new Map(), sun = null) {
  const ang = (hr) => ((hr / 24) * 360 + 180) * Math.PI / 180;
  const P = (hr, r) => [Math.sin(ang(hr)) * r, -Math.cos(ang(hr)) * r];
  const f = (n) => n.toFixed(2);
  const arcPath = (a, b, r) => {
    const [x1, y1] = P(a, r), [x2, y2] = P(b, r);
    return `M${f(x1)} ${f(y1)}A${r} ${r} 0 ${b - a > 12 ? 1 : 0} 1 ${f(x2)} ${f(y2)}`;
  };
  const sector = (a, b, r1, r2) => {
    const [x1, y1] = P(a, r2), [x2, y2] = P(b, r2), [x3, y3] = P(b, r1), [x4, y4] = P(a, r1);
    const big = b - a > 12 ? 1 : 0;
    return `M${f(x1)} ${f(y1)}A${r2} ${r2} 0 ${big} 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r1} ${r1} 0 ${big} 0 ${f(x4)} ${f(y4)}Z`;
  };
  const hrOf = (d) => (d - day) / 3600000;
  const RI = 190, RO = 240;

  const svg = svgEl('svg', { viewBox: '-284 -284 568 568', class: 'dial', role: 'group', 'aria-label': 'Günün kadranı' });
  const defs = svgEl('defs'); svg.append(defs);
  const uid = Math.random().toString(36).slice(2, 7);
  // Yüzük ve uyku dilimi
  svg.append(svgEl('path', { d: sector(0, 23.999, RI, RO), class: 'd-track' }));
  // Uyku: o günün gecelerinden (gün gün ayarlanır; değiştirilmemişse varsayılan saatler). Dokununca düzenlenir.
  const spans = sleepSpans(day);
  for (const sp of spans) {
    const a = sp.a / 60, b = Math.min(23.999, sp.b / 60);
    const p = svgEl('path', { d: sector(a, b, RI, RO), class: 'd-night', tabindex: '0', role: 'button', 'aria-label': `Uyku ${timeStr(sp.n.start)}–${timeStr(sp.n.end)}, değiştir` });
    p.append(svgEl('title', {}, `Uyku ${timeStr(sp.n.start)}–${timeStr(sp.n.end)}\nDeğiştirmek için dokun`));
    p.addEventListener('click', () => openNight(sp.n.key));
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNight(sp.n.key); } });
    svg.append(p);
  }
  const big = spans.slice().sort((x, y) => (y.b - y.a) - (x.b - x.a))[0];
  if (big && big.b - big.a >= 120) { const [x, y] = P((big.a + big.b) / 120, (RI + RO) / 2); svg.append(svgEl('text', { x: f(x), y: f(y + 4), class: 'd-night-t' }, 'uyku')); }
  // Saat çizgileri ve rakamlar
  for (let hr = 0; hr < 24; hr++) {
    const [x1, y1] = P(hr, RO + 8), [x2, y2] = P(hr, RO + (hr % 3 ? 13 : 20));
    svg.append(svgEl('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: hr % 3 ? 'd-tick' : 'd-tick major' }));
    if (hr % 3 === 0) { const [tx, ty] = P(hr, RI - 22); svg.append(svgEl('text', { x: f(tx), y: f(ty + 6), class: 'd-hour' }, String(hr).padStart(2, '0'))); }
  }
  // Kayıtlar: çakışanlar iç içe şeritlere
  const lanes = [];
  const placed = timed.slice().sort((a, b) => a.start - b.start).map((o) => {
    let li = lanes.findIndex((end) => end <= o.start);
    if (li === -1) { li = lanes.length; lanes.push(o.end); } else lanes[li] = o.end;
    return { o, li };
  });
  const nl = Math.max(1, lanes.length), band = (RO - RI) / nl;
  const closeGlyphs = [];
  const labels = [];
  for (const { o, li } of placed) {
    const a = Math.max(0, hrOf(o.start)), b = Math.min(24, hrOf(o.end));
    if (b <= a) continue;
    const past = o.end <= now, cur = o.start <= now && now < o.end;
    const r2 = RO - li * band, r1 = r2 - band;
    const seg = svgEl('path', {
      d: sector(a, Math.max(b, a + 0.08), r1 + (nl > 1 ? 1 : 0), r2), fill: o.color,
      class: `d-seg ${o.kind} ${past ? 'past' : ''} ${cur ? 'cur' : ''} ${o.absent ? 'absent' : ''}`,
      tabindex: '0', role: 'button', 'aria-label': `${o.title}, ${timeStr(o.start)}–${timeStr(o.end)}`,
    });
    seg.append(svgEl('title', {}, `${o.title}\n${timeStr(o.start)}–${timeStr(o.end)}${o.location ? `\n${o.location}` : ''}`));
    seg.addEventListener('click', () => openOccurrence(o));
    seg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOccurrence(o); } });
    svg.append(seg);
    // Dilimin dokusu: çim, ekolayzır, kareli defter, breadboard…
    const tk = textureKey(o);
    if (tk) {
      const pid = svgPattern(defs, tk, onColor(o.color) === '#FFFFFF' ? 'w' : 'k', uid);
      if (pid) svg.append(svgEl('path', { d: seg.getAttribute('d'), fill: `url(#${pid})`, class: `d-tx ${past ? 'past' : ''} ${o.absent ? 'absent' : ''}`, 'aria-hidden': 'true' }));
    }
    // Bitiş anı: yeni biten bir kaydın sonunda kendi simgesi kısa bir an belirir
    const since = now - o.end;
    const ck = `${o.id}|${+o.end}`;
    const shownAt = closedShown.get(ck);
    if (since >= 0 && since < 4 * 60000 && (!shownAt || Date.now() - shownAt < 1500)) {
      if (!shownAt) closedShown.set(ck, Date.now());
      seg.classList.add('just-closed');
      const iconName = o.kind === 'course' ? 'cap' : (category(o.categoryId)?.icon || 'check');
      const [cx, cy] = P(b, (r1 + r2) / 2);
      const g = svgEl('g', { class: `d-close k-${iconName}`, 'aria-hidden': 'true' });
      g.append(svgEl('circle', { cx: f(cx), cy: f(cy), r: 17 }));
      const icn = ic(iconName, { size: 20 });
      icn.setAttribute('x', f(cx - 10)); icn.setAttribute('y', f(cy - 10));
      g.append(icn);
      closeGlyphs.push(g);
    }
    // Etiket: halkanın üstünde, yay boyunca. Alt yarıda yazı ters dönmesin diye yol tersine çizilir.
    const fs = nl > 2 ? 11 : nl > 1 ? 12.5 : 14;
    const rm = (r1 + r2) / 2;
    const max = Math.floor((rm * ((b - a) / 24) * 2 * Math.PI - 16) / (fs * 0.6));
    const full = occLabel(o), first = full.split(' ')[0];
    const text = full.length <= max ? full : first.length <= max && first.length >= 3 ? first : max >= 9 ? short(full, max) : '';
    if (text) {
      const top = Math.cos(ang((a + b) / 2)) > 0; // öğlen tepede
      const id = `dl-${uid}-${labels.length}`;
      let d;
      if (top) d = arcPath(a, b, rm - fs * 0.35);
      else {
        const rr = rm + fs * 0.35;
        const [x1, y1] = P(b, rr), [x2, y2] = P(a, rr);
        d = `M${f(x1)} ${f(y1)}A${rr} ${rr} 0 ${b - a > 12 ? 1 : 0} 0 ${f(x2)} ${f(y2)}`;
      }
      defs.append(svgEl('path', { id, d }));
      const t = svgEl('text', { class: `d-seg-t ${past ? 'past' : ''}`, fill: onColor(o.color), 'font-size': fs });
      t.append(svgEl('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, text));
      labels.push(t);
    }
  }
  for (const t of labels) svg.append(t);
  // Unutma notu olan kayıtlar: dilimin başında küçük bir iğne başı
  for (const { o, li } of placed) {
    const n = pins.get(o.id);
    if (!n) continue;
    const a = Math.max(0, hrOf(o.start)), b = Math.min(24, hrOf(o.end));
    if (b <= a) continue;
    const r2 = RO - li * band;
    const [px, py] = P(a + Math.min(0.22, (b - a) / 2), r2 - Math.min(9, band / 2));
    const g = svgEl('g', { class: `d-pin ${o.end <= now ? 'past' : ''}`, 'aria-hidden': 'true' });
    g.append(svgEl('circle', { cx: f(px), cy: f(py), r: 7.5 }));
    g.append(svgEl('circle', { cx: f(px), cy: f(py), r: 2.6, class: 'd-pin-in' }));
    g.append(svgEl('title', {}, `${n} unutma notu`));
    svg.append(g);
  }
  // En uzun boşluk
  if (gap) {
    const a = hrOf(gap.start), b = hrOf(gap.end);
    svg.append(svgEl('path', { d: arcPath(a, b, RI - 6), class: 'd-gap' }));
  }
  // Namaz vakitleri: halkayı kesen ince çizgi, iç kenarda yıldız, yay boyunca vaktin adı
  prayers.forEach((p, i) => {
    const hr = hrOf(p.at);
    const st = `${p.at <= now ? 'past' : ''} ${p.next ? 'next' : ''}`;
    const [x1, y1] = P(hr, RI + 2), [x2, y2] = P(hr, RO - 2);
    svg.append(svgEl('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: `d-pr-line ${st}` }));
    const [sx, sy] = P(hr, RI - 11);
    const star = svgEl('path', { d: star8(sx, sy, p.next ? 7 : 5.5), class: `d-pr-star ${st}` });
    star.append(svgEl('title', {}, `${p.name} ${timeStr(p.at)}`));
    svg.append(star);
    const fs = 12, rm = 148, id = `dp-${uid}-${i}`;
    const a = hr - 1.2, b = hr + 1.2;
    let d;
    if (Math.cos(ang(hr)) > 0) d = arcPath(a, b, rm - fs * 0.35);
    else {
      const rr = rm + fs * 0.35;
      const [px1, py1] = P(b, rr), [px2, py2] = P(a, rr);
      d = `M${f(px1)} ${f(py1)}A${rr} ${rr} 0 0 0 ${f(px2)} ${f(py2)}`;
    }
    defs.append(svgEl('path', { id, d }));
    const t = svgEl('text', { class: `d-pr-t ${st}`, 'font-size': fs });
    t.append(svgEl('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, p.name));
    svg.append(t);
  });
  // Gün ışığı yayı: güneşin doğuşundan batışına (iç yüzün kenarında)
  if (sun) {
    const RS = 137;
    svg.append(svgEl('circle', { r: RS, class: 'd-sky-night' }));
    const a = hrOf(sun.rise), b = hrOf(sun.set);
    if (b > a) {
      svg.append(svgEl('path', { d: arcPath(a, b, RS), class: 'd-sky-day' }));
      for (const [hr, lab] of [[a, 'doğuş'], [b, 'batış']]) {
        const [x, y] = P(hr, RS);
        const t = svgEl('circle', { cx: f(x), cy: f(y), r: 3.2, class: 'd-sky-end' });
        t.append(svgEl('title', {}, `Güneş ${lab}: ${timeStr(hr === a ? sun.rise : sun.set)}`));
        svg.append(t);
      }
    }
  }
  // Şimdi: geçen kısım ve ibre
  const nh = hrOf(now);
  // Uyanık geçen kısım: sabah kalkıştan şimdiye (gece yatışında durur)
  const sh = (spans.find((x) => x.b < 1440)?.b ?? 0) / 60;             // bu sabahki kalkış
  const eh = (spans.find((x) => x.b >= 1440 && x.a > 0)?.a ?? 1440) / 60; // bu geceki yatış (gece yarısından önceyse)
  if (nh > sh) svg.append(svgEl('path', { d: arcPath(sh, Math.min(nh, eh), RO + 26), class: 'd-progress' }));
  const [nx0, ny0] = P(nh, 132), [nx, ny] = P(nh, RO + 4);
  svg.append(svgEl('line', { x1: f(nx0), y1: f(ny0), x2: f(nx), y2: f(ny), class: 'd-needle' }));
  svg.append(svgEl('circle', { cx: f(nx), cy: f(ny), r: 10, class: 'd-knob' }));
  // Merkez
  svg.append(svgEl('circle', { r: 128, class: 'd-face' }));
  // İbrenin dibinde güneş ya da ay
  if (sun) {
    const [sx, sy] = P(nh, 137);
    const day = now >= sun.rise && now < sun.set;
    const g = svgEl('g', { class: `d-sun ${day ? 'day' : 'night'}` });
    g.append(svgEl('title', {}, day ? `Gündüz · batış ${timeStr(sun.set)}` : `Gece · doğuş ${timeStr(sun.rise > now ? sun.rise : addDays(sun.rise, 1))}`));
    if (day) {
      for (let i = 0; i < 8; i++) {
        const an = (i * Math.PI) / 4;
        g.append(svgEl('line', { x1: f(sx + Math.cos(an) * 9), y1: f(sy + Math.sin(an) * 9), x2: f(sx + Math.cos(an) * 12.5), y2: f(sy + Math.sin(an) * 12.5), class: 'd-sun-ray' }));
      }
      g.append(svgEl('circle', { cx: f(sx), cy: f(sy), r: 6.5, class: 'd-sun-disc' }));
    } else {
      g.append(svgEl('circle', { cx: f(sx), cy: f(sy), r: 7.5, class: 'd-moon' }));
      g.append(svgEl('circle', { cx: f(sx + 3.6), cy: f(sy - 2.6), r: 6.4, class: 'd-moon-cut' }));
    }
    svg.append(g);
  }
  for (const g of closeGlyphs) svg.append(g);
  return svg;
}

export function renderToday(root, { onWeek, onCourses, onTasks, onJournal } = {}) {
  const now = new Date();
  const day = startOfDay(now);
  const items = occurrencesInRange(day, addDays(day, 1));
  const timed = items.filter((o) => !o.allDay);
  const allDay = items.filter((o) => o.allDay && o.kind !== 'deadline');
  const deadlinesToday = items.filter((o) => o.kind === 'deadline');
  const gap = longestGap(timed, now);
  const tw = termWeek(day);
  // Her kaydın işaretlenmemiş unutma notları
  const pinMap = new Map();
  const openPins = (o) => {
    if (!pinMap.has(o.id)) pinMap.set(o.id, pinsForOcc(o, now).filter((x) => !x.checked));
    return pinMap.get(o.id);
  };
  const pinCounts = new Map(timed.map((o) => [o.id, openPins(o).length]).filter(([, n]) => n));

  // ---- Namaz vakitleri ----
  const pOn = prayerEnabled();
  const pt = pOn ? timesFor(day) : null;
  const pn = pOn ? prayerNow(now) : null;
  const isAt = (x, at) => !!x && x.at.getTime() === at.getTime();
  const st = timesFor(day);
  const sun = { rise: st.gunes, set: st.aksam };
  const dialPrayers = pOn && prayerSettings().onDial !== false
    ? VAKITLER.map((v) => ({ ...v, at: pt[v.id], next: isAt(pn.next, pt[v.id]) })) : [];
  const vakitStrip = pOn ? h('div', { class: 'db-vakit' },
    h('div', { class: 'dv-head' },
      h('span', {}, h('b', {}, 'Namaz vakitleri'), ` · ${locationLabel()}`),
      pn.next ? h('span', { class: 'dv-left' }, `${pn.next.dative} ${inText(minsLeft(now, pn.next.at))}`) : null),
    h('ol', { class: 'dv-list', 'aria-label': `Namaz vakitleri, ${locationLabel()}` }, VAKITLER.map((v) => {
      const at = pt[v.id];
      const next = isAt(pn.next, at), cur = v.id !== 'gunes' && isAt(pn.current, at);
      return h('li', { class: `${at <= now && !cur ? 'past' : ''} ${next ? 'next' : ''} ${cur ? 'cur' : ''}`, 'aria-current': cur ? 'time' : null },
        h('span', { class: 'dv-n' }, v.name), h('span', { class: 'dv-t' }, timeStr(at)));
    }))) : null;

  // ---- Şimdi / sıradaki (kadranın ortası ve akış listesi) ----
  const current = timed.filter((o) => o.start <= now && now < o.end).sort((a, b) => a.end - b.end)[0];
  const upcoming = timed.filter((o) => o.start > now);
  let tomorrow = [];
  if (!upcoming.length) tomorrow = occurrencesInRange(addDays(day, 1), addDays(day, 2)).filter((o) => !o.allDay).slice(0, 2);
  const focus = current || upcoming[0] || tomorrow[0];
  const centerK = current ? `${inText(minsLeft(now, current.end))} kaldı`
    : upcoming[0] ? `${inText(minsLeft(now, upcoming[0].start))} sonra`
      : tomorrow[0] ? `yarın ${timeStr(tomorrow[0].start)}` : 'bugün başka plan yok';
  const center = h('button', {
    class: 'dial-center', disabled: !focus, onclick: () => focus && openOccurrence(focus),
    'aria-label': focus ? `${focus.title}, ${centerK}` : 'Bugün başka plan yok',
  },
  h('span', { class: 'dc-time' }, timeStr(now)),
  h('span', { class: 'dc-k' }, centerK),
  focus ? h('span', { class: 'dc-t' }, short(focus.title, 40)) : null,
  focus?.location ? h('span', { class: 'dc-l' }, focus.location) : null);

  const legendMap = new Map();
  for (const o of timed) {
    const name = o.kind === 'course' ? (o.ref.code || o.ref.name) : category(o.categoryId).name;
    if (!legendMap.has(name)) legendMap.set(name, o.color);
  }

  const hero = h('section', { class: 'dial-block' },
    h('div', { class: 'db-head' },
      h('div', {},
        h('h1', { class: 'db-date' }, GUNLER[isoWeekday(day) - 1], h('br'), `${day.getDate()} ${AYLAR[day.getMonth()]}`),
        h('p', { class: 'db-sub' }, tw ? `Dönemin ${tw.n}. haftası, ${tw.total} haftadan` : String(day.getFullYear()))),
      h('div', { class: 'db-actions' },
        h('button', { class: 'btn on-hero ghost', onclick: () => onWeek?.() }, 'Haftayı gör'),
        h('button', { class: 'btn on-hero', onclick: () => openEventForm({}) }, '+ Plan ekle'))),
    allDay.length || deadlinesToday.length ? h('div', { class: 'db-allday' },
      [...allDay, ...deadlinesToday].map((o) => h('button', { class: `chip-mini ${o.kind}`, style: { '--c': o.color }, onclick: () => openOccurrence(o) },
        o.kind === 'deadline' ? `Teslim ${timeStr(o.due)}: ${o.title}` : `Tüm gün: ${o.title}`))) : null,
    h('div', { class: 'dial-wrap' }, buildDial(day, now, timed, gap, dialPrayers, pinCounts, sun), center),
    timed.length ? h('div', { class: 'db-legend' },
      [...legendMap].map(([name, c]) => h('span', {}, h('i', { style: { background: c } }), name)),
      gap ? h('span', {}, h('i', { class: 'gap-i' }), `boş ${timeStr(gap.start)}–${timeStr(gap.end)}`) : null)
      : h('p', { class: 'db-empty' }, 'Bugün saatli bir plan yok. Yukarıdaki kutuya "18:00 spor" gibi yazıp ekleyebilirsin.'),
    vakitStrip);

  // ---- Geri sayım blokları ----
  const cds = occurrencesInRange(day, addDays(day, 60), { includeCourses: false })
    .filter((o) => (o.kind === 'event' && (o.categoryId === 'sinav' || category(o.categoryId)?.icon === 'music') && o.end > now) || (o.kind === 'deadline' && !o.done && o.due > now))
    .map((o) => ({ o, at: o.kind === 'deadline' ? o.due : o.start })).sort((a, b) => a.at - b.at).slice(0, 4);
  const cdSec = cds.length ? h('div', { class: 'cd-blocks' }, cds.slice(0, 2).map(({ o }) => themedCard(o, now, { onClick: () => openOccurrence(o) })),
    cds.length > 2 ? h('ul', { class: 'cd-more' }, cds.slice(2).map(({ o, at }) => h('li', {},
      h('button', { onclick: () => openOccurrence(o) },
        h('b', {}, `${Math.max(0, daysBetween(now, at))} gün`),
        h('span', {}, o.kind === 'deadline' ? o.title : o.title))))) : null)
    : h('div', { class: 'cd-blocks cd-none' }, h('p', {}, 'Önümüzdeki 60 günde sınav ya da teslim yok. Sınavları "Sınav" kategorisiyle ekle, ödevleri bir derse bağla; geri sayım burada başlar.'));

  // ---- Günün akışı ----
  const flowItems = [...timed.filter((o) => o.end > now)];
  const pinLine = (o) => {
    const ps = openPins(o);
    return ps.length ? h('span', { class: 'fl-pins' }, ic('pin', { size: 13 }), ` ${ps.map((x) => x.n.text).join(' · ')}`) : null;
  };
  const flow = h('section', { class: 'card flow-card' },
    h('div', { class: 'card-head' }, h('h3', {}, tomorrow.length && !flowItems.length ? 'Yarın' : 'Günün akışı'),
      h('span', { class: 'muted small' }, timed.length ? `${timed.filter((o) => o.end <= now).length}/${timed.length} geride kaldı` : '')),
    flowItems.length || tomorrow.length ? h('ol', { class: 'flow' }, (flowItems.length ? flowItems : tomorrow).slice(0, 5).map((o) => {
      const cur = o.start <= now && now < o.end;
      return h('li', { class: cur ? 'cur' : '', style: { '--c': o.color } },
        h('button', { onclick: () => openOccurrence(o) },
          h('span', { class: 'fl-time' }, `${timeStr(o.start)}`, h('small', {}, timeStr(o.end))),
          h('span', { class: 'fl-main' },
            h('strong', {}, o.title),
            h('span', { class: 'muted small' }, [o.kind === 'course' ? (o.sub || 'Ders') : category(o.categoryId).name, o.location].filter(Boolean).join(', ')),
            pinLine(o)),
          h('span', { class: 'fl-when' }, cur ? `${inText(minsLeft(now, o.end))} kaldı` : flowItems.length ? `${inText(minsLeft(now, o.start))} sonra` : ''),
          cur ? h('span', { class: 'fl-bar' }, h('span', { style: { width: `${Math.round(((now - o.start) / (o.end - o.start)) * 100)}%` } })) : null));
    })) : h('p', { class: 'muted' }, 'Bugün ve yarın için saatli plan kalmadı.'));

  // ---- Görev rafı ----
  const rack = taskRack(now, gap, { onTasks, rerender: () => renderToday(root, { onWeek, onCourses, onTasks, onJournal }) });

  // ---- Unutma: gündüz "Bugün unutma", akşam "Yarının çantası" + defterden bir satır ----
  const evening = bagMode(now) === 'tomorrow';
  const bag = bagCard(now, { extra: evening ? journalPrompt(day, { onOpen: onJournal }) : null });

  // ---- Devamsızlık uyarısı ----
  const abs = state.courses.map((c) => ({ c, a: absenceInfo(c) })).filter(({ a }) => a.level === 'warn' || a.level === 'over');
  const absCard = abs.length ? h('section', { class: 'card abs-card' },
    h('h3', {}, 'Devamsızlık sınırına yakın'),
    h('ul', { class: 'abs-list' }, abs.map(({ c, a }) => h('li', { class: a.level, style: { '--c': c.color } },
      h('button', { onclick: () => onCourses?.() },
        h('span', {}, c.code || c.name),
        h('strong', {}, `${a.used}/${a.limit} ${a.unit}`)))))) : null;

  // İbre yalnızca ekran ilk açıldığında yerine oturur; dakikalık yenilemelerde oynamaz
  const refresh = !!root.querySelector(':scope > .today-view');
  if (!refresh) hero.querySelector('.dial')?.classList.add('intro');
  root.replaceChildren(h('div', { class: 'today-view' },
    hero,
    h('div', { class: 'today-side' }, evening ? bag : null, cdSec, evening ? null : bag, flow, sleepCard(now), absCard),
    rack,
    weekSummary(now)));
}

// ---- Bu hafta: günlere göre yük (kategorilere bölünmüş sütunlar) ----
function weekSummary(now) {
  const ws = startOfWeek(now), we = addDays(ws, 7);
  const occ = occurrencesInRange(ws, we).filter((o) => !o.allDay);
  const groups = new Map();
  const perDay = Array.from({ length: 7 }, () => new Map());
  for (const o of occ) {
    const a = Math.max(o.start, ws), b = Math.min(o.end, we);
    const min = Math.max(0, (b - a) / 60000);
    if (!min) continue;
    const key = o.kind === 'course' ? '__ders' : category(o.categoryId).id;
    const name = o.kind === 'course' ? 'Ders' : category(o.categoryId).name;
    const color = o.kind === 'course' ? 'var(--ders)' : category(o.categoryId).color;
    const g = groups.get(key) || { name, color, min: 0 };
    g.min += min; groups.set(key, g);
    const d = perDay[isoWeekday(o.start) - 1];
    d.set(key, (d.get(key) || 0) + min);
  }
  const total = [...groups.values()].reduce((a, g) => a + g.min, 0);
  const order = [...groups.entries()].sort((a, b) => (a[0] === 'diger') - (b[0] === 'diger') || b[1].min - a[1].min).map(([k]) => k);
  const dayTotals = perDay.map((m) => [...m.values()].reduce((a, v) => a + v, 0));
  const maxDay = Math.max(60, ...dayTotals);
  const busiest = dayTotals.indexOf(Math.max(...dayTotals));
  const doneThisWeek = state.tasks.filter((t) => t.done && t.doneAt && new Date(t.doneAt) >= ws).length;
  const nextWeekMin = occurrencesInRange(we, addDays(we, 7)).filter((o) => !o.allDay).reduce((a, o) => a + (o.end - o.start) / 60000, 0);
  const hrs = (m) => String(Math.round((m / 60) * 10) / 10).replace('.', ',');
  const todayIdx = isoWeekday(now) - 1;

  const bars = h('div', { class: 'wbars', role: 'img', 'aria-label': `Bu hafta günlere göre planlı saatler: ${GUNLER.map((g, i) => `${g} ${hrs(dayTotals[i])} saat`).join(', ')}` },
    perDay.map((m, i) => h('div', { class: `wbar ${i === todayIdx ? 'today' : ''}` },
      h('span', { class: 'wb-v' }, dayTotals[i] ? hrs(dayTotals[i]) : ''),
      h('div', { class: 'wb-stack', style: { height: `${Math.round((dayTotals[i] / maxDay) * 100)}%` } },
        order.filter((k) => m.get(k)).map((k) => h('i', { style: { flexGrow: String(m.get(k)), background: groups.get(k).color }, title: `${groups.get(k).name}: ${hrs(m.get(k))} sa` }))),
      h('span', { class: 'wb-d' }, GUNLER_KISA[i]))));
  const legend = h('ul', { class: 'w-legend' }, order.map((k) => {
    const g = groups.get(k);
    return h('li', {}, h('i', { style: { background: g.color } }), h('span', {}, g.name), h('b', {}, `${hrs(g.min)} sa`));
  }));
  const stats = h('div', { class: 'week-stats' },
    h('div', {}, h('b', {}, doneThisWeek), h('span', {}, 'görev bitti')),
    h('div', {}, h('b', {}, total ? GUNLER[busiest] : '–'), h('span', {}, total ? `en dolu gün, ${hrs(dayTotals[busiest])} sa` : 'en dolu gün')),
    h('div', {}, h('b', {}, hrs(nextWeekMin)), h('span', {}, 'saat plan gelecek hafta')));
  return h('section', { class: 'card week-card' },
    h('div', { class: 'card-head' }, h('h3', {}, total ? `Bu hafta ${hrs(total)} saat dolu` : 'Bu hafta'),
      h('span', { class: 'muted small' }, `${fmtDateShort(ws)} – ${fmtDateShort(addDays(ws, 6))}, dersler dahil`)),
    h('div', { class: 'week-body' }, bars, h('div', { class: 'week-side' }, legend, stats)));
}

// ---- Görev rafı: her görev bir fiş. Koçanda (renkli sol parça) zaman: kaç gün kaldı / kaç gündür bekliyor ----
let rackFilter = 'hepsi';
const RACK_MAX = 8;

// Bu haftanın geri kalanında görev saatleri içindeki boş zaman (dakika)
function freeMinutesThisWeek(now) {
  const ws = startOfWeek(now), we = addDays(ws, 7);
  const s0 = hmToMin(state.settings.freeSlotStart || '09:00'), s1 = hmToMin(state.settings.freeSlotEnd || '22:00');
  const busy = occurrencesInRange(startOfDay(now), we).filter((o) => !o.allDay);
  let total = 0;
  for (let d = startOfDay(now); d < we; d = addDays(d, 1)) {
    const a = new Date(Math.max(now, addMinutes(d, s0))), b = addMinutes(d, s1);
    if (b <= a) continue;
    const segs = busy.filter((o) => o.end > a && o.start < b)
      .map((o) => [Math.max(o.start, a), Math.min(o.end, b)]).sort((x, y) => x[0] - y[0]);
    let cur = +a, used = 0;
    for (const [x, y] of segs) { if (y <= cur) continue; used += y - Math.max(x, cur); cur = Math.max(cur, y); }
    total += (b - a - used) / 60000;
  }
  return Math.max(0, total);
}

function taskRack(now, gap, { onTasks, rerender }) {
  const open = sortTasks(state.tasks.filter((t) => !t.done));
  const due = (t) => (t.due ? (t.courseId ? dueDate(t) : parseLocal(`${t.due}T23:59`)) : null);
  const FILTERS = [
    ['hepsi', 'Hepsi', () => true],
    ['yakin', 'Bu hafta', (t) => t.due && daysBetween(now, due(t)) <= 7],
    ['odev', 'Ödevler', (t) => !!t.courseId],
    ['tarihsiz', 'Tarihsiz', (t) => !t.due],
  ];
  const fdef = FILTERS.find((f) => f[0] === rackFilter) || FILTERS[0];
  const list = open.filter(fdef[2]);
  const gapMin = gap ? minsLeft(gap.start, gap.end) : 0;

  const place = (t) => {
    const st = gap.start, en = addMinutes(st, t.estimateMin || 60);
    const ev = upsertEvent({ title: t.title, categoryId: 'gorev', start: toLocalISO(st), end: toLocalISO(en), notes: t.notes, taskId: t.id, reminderMin: 10, syncToGoogle: !!state.settings.googleConnected });
    t.scheduledEventId = ev.id; commit('tasks');
    toast(`"${t.title}" ${timeStr(st)}–${timeStr(en)} arasına yerleştirildi`);
  };

  const ticket = (t) => {
    const p = priority(t.priority);
    const course = t.courseId ? state.courses.find((c) => c.id === t.courseId) : null;
    const cat = taskCategory(t.categoryId);
    const est = t.estimateMin || 60;
    const d = due(t);
    let num, unit, state_ = '';
    if (d) {
      const n = daysBetween(now, d);
      if (d < now) { num = Math.max(1, -n); unit = n === 0 ? 'saat geçti' : 'gün gecikti'; if (n === 0) num = Math.max(1, Math.round((now - d) / 3600000)); state_ = 'late'; }
      else if (n === 0) { num = t.dueTime || 'Bugün'; unit = t.dueTime ? 'bugün' : 'son gün'; state_ = 'today'; }
      else if (n === 1) { num = 'Yarın'; unit = t.dueTime || 'son gün'; state_ = 'soon'; }
      else { num = n; unit = 'gün kaldı'; if (n <= 3) state_ = 'soon'; }
    } else {
      const age = Math.max(0, daysBetween(new Date(t.createdAt), now));
      num = age || 'Yeni'; unit = age ? 'gündür bekliyor' : 'tarihsiz'; state_ = age >= 7 ? 'waiting' : 'free';
    }
    const ev = t.scheduledEventId ? state.events.find((e) => e.id === t.scheduledEventId && !e.deleted) : null;
    const fits = gap && !ev && est <= gapMin;
    const label = `${num} ${unit}, ${p.name}`;
    return h('li', { class: `ticket ${state_}`, style: { '--c': p.color } },
      h('div', { class: 'tk' },
        h('div', { class: 'tk-stub', 'aria-label': label },
          h('span', { class: `tk-n ${typeof num === 'number' ? '' : 'word'}` }, num),
          h('span', { class: 'tk-u' }, unit),
          h('span', { class: 'tk-p' }, p.name)),
        h('div', { class: 'tk-body' },
          h('span', { class: 'tk-k' },
            course ? h('span', { class: 'tk-tag', style: { '--c': course.color } }, ic('book', { size: 13 }), ` ${course.code || course.name}`)
              : t.categoryId ? h('span', { class: 'tk-tag', style: { '--c': cat.color } }, cat.name) : h('span', { class: 'tk-tag none' }, 'Kategorisiz'),
            d ? h('span', { class: 'tk-date' }, `${fmtDateShort(d)}${t.dueTime ? ` ${t.dueTime}` : ''}`) : null),
          h('button', { class: 'tk-title', onclick: () => openTaskForm(t.id) }, t.title),
          h('div', { class: 'tk-foot' },
            tickButton(false, (e) => completeTask(t, e.currentTarget), `${t.title} tamamlandı`),
            h('span', { class: 'tk-est', title: 'Tahmini süre' }, h('i', { style: { '--deg': `${Math.min(360, (est / 240) * 360)}deg` } }), durationText(est)),
            ev ? h('span', { class: 'tk-sched' }, ic('calendar', { size: 13 }), ` ${GUNLER_KISA[isoWeekday(parseLocal(ev.start)) - 1]} ${timeStr(parseLocal(ev.start))}`)
              : fits ? h('button', { class: 'btn small tk-place', onclick: () => place(t), title: `Bugün ${timeStr(gap.start)}–${timeStr(gap.end)} boşluğuna yerleştir` }, 'Boşluğa koy')
                : h('button', { class: 'icon-btn tk-cal', title: 'Takvimde boş bir zamana yerleştir', 'aria-label': `${t.title}: takvime yerleştir`, onclick: () => openScheduleTask(t.id) }, ic('calendarPlus', { size: 17 }))))));
  };

  // Yük çubuğu: bu haftaki boş zaman ile açık görevlerin toplam süresi
  const workMin = open.reduce((a, t) => a + (t.estimateMin || 60), 0);
  const freeMin = freeMinutesThisWeek(now);
  const scale = Math.max(workMin, freeMin, 60);
  const hrs = (m) => String(Math.round((m / 60) * 10) / 10).replace('.', ',');
  const over = workMin > freeMin;
  const load = h('div', { class: `rk-load ${over ? 'over' : ''}` },
    h('div', { class: 'rk-bar', role: 'img', 'aria-label': `Açık görevler ${hrs(workMin)} saat, bu haftaki boş zaman ${hrs(freeMin)} saat` },
      h('span', { class: 'rk-free', style: { width: `${(freeMin / scale) * 100}%` } }),
      h('span', { class: 'rk-work' }, ['acil', 'yuksek', 'orta', 'dusuk'].map((pid) => {
        const m = open.filter((t) => t.priority === pid).reduce((a, t) => a + (t.estimateMin || 60), 0);
        return m ? h('i', { style: { width: `${(m / scale) * 100}%`, background: priority(pid).color }, title: `${priority(pid).name}: ${hrs(m)} sa` }) : null;
      }))),
    h('p', { class: 'rk-note' },
      h('b', {}, `${hrs(workMin)} sa iş`), ` bekliyor; bu hafta görev saatlerinde ${hrs(freeMin)} sa boşun var. `,
      over ? h('span', { class: 'rk-warn' }, `${hrs(workMin - freeMin)} sa sığmıyor, bir kısmını gelecek haftaya bırak.` )
        : workMin ? `Hepsi sığar, ${hrs(freeMin - workMin)} sa da artar.` : ''));

  // Hızlı görev
  const qi = h('input', { type: 'text', class: 'rk-input', placeholder: 'Yeni görev yaz, Enter', 'aria-label': 'Yeni görev ekle' });
  qi.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = qi.value.trim(); if (!v) return;
    upsertTask({ title: v, priority: 'orta', categoryId: '' });
    toast(`Görev eklendi: ${v}`);
    setTimeout(() => document.querySelector('.rk-input')?.focus(), 0);
  });

  const shown = list.slice(0, RACK_MAX);
  return h('section', { class: 'rack', 'aria-label': 'Görevler' },
    h('div', { class: 'rk-head' },
      h('div', { class: 'rk-title' },
        h('h3', {}, 'Görev rafı'),
        h('span', { class: 'muted small' }, open.length ? `${open.length} açık görev${gap ? `, bugünkü boşluk ${timeStr(gap.start)}–${timeStr(gap.end)}` : ''}` : 'Açık görev yok')),
      h('div', { class: 'rk-tools' },
        h('div', { class: 'seg compact', role: 'radiogroup', 'aria-label': 'Görev süzgeci' }, FILTERS.map(([id, name, fn]) => h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(rackFilter === id), class: `seg-btn ${rackFilter === id ? 'on' : ''}`,
          onclick: () => { rackFilter = id; rerender(); },
        }, name, h('span', { class: 'rk-c' }, open.filter(fn).length)))),
        qi)),
    open.length ? load : null,
    shown.length ? h('ul', { class: 'tickets' }, shown.map(ticket),
      list.length > RACK_MAX ? h('li', { class: 'ticket more' }, h('button', { onclick: () => onTasks?.() },
        h('span', { class: 'tk-n' }, `+${list.length - RACK_MAX}`), h('span', {}, 'görev daha, Görevler sayfasında'))) : null)
      : h('p', { class: 'rk-empty' }, open.length ? 'Bu süzgece uyan görev yok.' : 'Raf boş. Yukarıdaki kutuya yaz, Enter\'a bas; görev buraya fiş olarak gelir.'));
}
