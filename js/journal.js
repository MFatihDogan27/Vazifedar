// Defter: her günün kadranı küçük bir halka olarak saklanır (kadran arşivi), her güne birkaç satır yazılır.
// Ay sayfasında günler halka halka dizilir; bir güne tıklayınca o günün sayfası açılır:
// kadranı, o gün olanlar, bitenler, o güne iğnelenen notlar ve defter yazısı.
import { h, toast } from './ui.js';
import { state, commit, occurrencesInRange, category } from './store.js';
import {
  startOfDay, addDays, toDateKey, parseLocal, startOfMonth, startOfWeek, sameDay, minToHm,
  GUNLER, GUNLER_KISA, AYLAR, isoWeekday,
} from './dates.js';
import { ic } from './icons.js';
import { termWeek } from './today.js';
import { dayGroups, groupsCount, dayPinsBlock, allPinsPanel } from './notes.js';

const ARCH_FROM = 2;   // dünü canlı bırak (geç işaretlenen devamsızlık, sonradan eklenen plan), önceki günleri dondur
const ARCH_DAYS = 45;  // geriye doğru en çok bu kadar gün arşivlenir

// ---------------------------------------------------------------------------
// Kadran arşivi
// ---------------------------------------------------------------------------
function snapshot(day) {
  const d0 = startOfDay(day), d1 = addDays(d0, 1);
  const segs = [], allDay = [];
  for (const o of occurrencesInRange(d0, d1)) {
    if (o.allDay) { allDay.push({ t: o.kind === 'deadline' ? `Teslim: ${o.title}` : o.title, c: o.color, k: o.kind }); continue; }
    const a = Math.max(0, Math.round((o.start - d0) / 60000));
    const b = Math.min(1440, Math.round((o.end - d0) / 60000));
    if (b <= a) continue;
    const seg = { a, b, c: o.color, t: o.kind === 'course' ? (o.ref.code || o.ref.name) : o.title, k: o.kind };
    if (o.kind === 'course') Object.assign(seg, { cid: o.courseId, sid: o.sessionId, sub: o.sub || '' });
    else seg.cat = o.categoryId;
    segs.push(seg);
  }
  return { segs, allDay, at: new Date().toISOString() };
}

// Bir günün kadranı: arşivde varsa oradan, yoksa takvimden
export function dayData(dateKey) {
  const frozen = state.archive[dateKey];
  const d = frozen || snapshot(parseLocal(dateKey));
  const segs = d.segs.map((s) => (s.k === 'course'
    ? { ...s, absent: !!state.courses.find((c) => c.id === s.cid)?.absences.some((x) => x.s === s.sid && x.d === dateKey) }
    : s));
  return { ...d, segs, frozen: !!frozen };
}

export function archiveTick(now = new Date()) {
  let added = 0;
  for (let i = ARCH_FROM; i <= ARCH_DAYS; i++) {
    const k = toDateKey(addDays(now, -i));
    if (state.archive[k]) continue;
    state.archive[k] = snapshot(parseLocal(k));
    added++;
  }
  if (added) commit('archive');
}

function redraw(dateKey) {
  state.archive[dateKey] = snapshot(parseLocal(dateKey));
  commit('archive');
}

// ---------------------------------------------------------------------------
// Defter yazısı
// ---------------------------------------------------------------------------
export function journalText(k) { return state.journal[k]?.text || ''; }
export function setJournal(k, text) {
  if (text.trim()) state.journal[k] = { text, updatedAt: new Date().toISOString() };
  else delete state.journal[k];
  commit('journal'); // sayfa yeniden çizilmez, yalnız kaydedilir
}

function autosave(ta, k, status, onSaved) {
  let timer;
  ta.addEventListener('input', () => {
    status.textContent = 'Yazılıyor…';
    clearTimeout(timer);
    timer = setTimeout(() => { setJournal(k, ta.value); status.textContent = ta.value.trim() ? 'Kaydedildi' : ''; onSaved?.(ta.value); }, 500);
  });
  ta.addEventListener('blur', () => { clearTimeout(timer); if (ta.value !== journalText(k)) { setJournal(k, ta.value); status.textContent = ta.value.trim() ? 'Kaydedildi' : ''; onSaved?.(ta.value); } });
}

// Bugün ekranındaki akşam kartının altına: defterden bir satır
export function journalPrompt(day, { onOpen } = {}) {
  const k = toDateKey(day);
  const ta = h('textarea', { class: 'lined jp-text', rows: 3, placeholder: 'Bugün nasıl geçti? Bir cümle bile yeter.', 'aria-label': 'Bugünün defter yazısı' }, journalText(k));
  const status = h('span', { class: 'muted small jp-st' }, journalText(k) ? 'Defterde' : '');
  autosave(ta, k, status);
  return h('div', { class: 'jp' },
    h('div', { class: 'jp-head' }, h('b', {}, ic('book', { size: 15 }), ' Defterden bir satır'),
      onOpen ? h('button', { type: 'button', class: 'linkish', onclick: () => { focusDay(k); onOpen(); } }, 'Deftere git') : null),
    ta, status);
}

// ---------------------------------------------------------------------------
// Halka (mini kadran): öğlen tepede, gece yarısı altta — Bugün kadranıyla aynı yön
// ---------------------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
};

export function ring(segs, { big = false, thin = false } = {}) {
  const R = big ? 38 : thin ? 43 : 39, W = big ? 13 : thin ? 7 : 15;
  const ang = (m) => ((m / 1440) * 360 + 180) * Math.PI / 180;
  const P = (m, r) => [Math.sin(ang(m)) * r, -Math.cos(ang(m)) * r];
  const f = (n) => n.toFixed(2);
  const arc = (a, b, r) => {
    if (b - a >= 1440) b = a + 1439.5;
    const [x1, y1] = P(a, r), [x2, y2] = P(b, r);
    return `M${f(x1)} ${f(y1)}A${r} ${r} 0 ${b - a > 720 ? 1 : 0} 1 ${f(x2)} ${f(y2)}`;
  };
  const vb = big ? '-58 -58 116 116' : '-50 -50 100 100';
  const svg = svgEl('svg', { viewBox: vb, class: `ring ${big ? 'big' : ''} ${thin ? 'thin' : ''}`, 'aria-hidden': 'true' });
  svg.append(svgEl('circle', { r: R, class: 'rg-track', 'stroke-width': W }));
  const sh = state.settings.dayStartHour ?? 7, eh = state.settings.dayEndHour ?? 24;
  if (sh > 0) svg.append(svgEl('path', { d: arc(0, sh * 60, R), class: 'rg-night', 'stroke-width': W }));
  if (eh < 24) svg.append(svgEl('path', { d: arc(eh * 60, 1440, R), class: 'rg-night', 'stroke-width': W }));
  const trim = big ? 3 : 4;
  for (const s of [...segs].sort((x, y) => (y.b - y.a) - (x.b - x.a))) {
    const t = s.b - s.a > trim * 4 ? trim : 0;
    const p = svgEl('path', { d: arc(s.a + t, s.b - t, R), stroke: s.c, 'stroke-width': W - (big ? 1 : 0), class: `rg-seg ${s.k} ${s.absent ? 'absent' : ''}` });
    if (big) p.append(svgEl('title', {}, `${s.t} ${minToHm(s.a)}–${minToHm(Math.min(s.b, 1439))}`));
    svg.append(p);
  }
  if (big) {
    for (const hr of [0, 6, 12, 18]) {
      const [x, y] = P(hr * 60, R + W / 2 + 7);
      svg.append(svgEl('text', { x: f(x), y: f(y + 2.6), class: 'rg-h' }, String(hr).padStart(2, '0')));
    }
  }
  return svg;
}

// ---------------------------------------------------------------------------
// Defter sayfası
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Pul albümü: geçmiş her güne, o gün en çok zaman ayrılan şeyin pulu basılır
// ---------------------------------------------------------------------------
function dominant(segs) {
  const m = new Map();
  for (const s of segs) {
    let key, icon, color;
    if (s.k === 'course') {
      const c = state.courses.find((x) => x.id === s.cid);
      key = `c:${s.cid}`; icon = ['Lab', 'Uygulama'].includes(s.sub) ? 'chip' : 'cap'; color = c?.color || s.c;
    } else {
      const cat = (s.cat && state.categories.find((x) => x.id === s.cat)) || state.categories.find((x) => x.color?.toLowerCase() === String(s.c).toLowerCase());
      key = `e:${cat?.id || s.c}`; icon = cat?.icon || 'star'; color = cat?.color || s.c;
    }
    const g = m.get(key) || { min: 0, icon, color, name: s.k === 'course' ? s.t : (category(s.cat)?.name || s.t) };
    g.min += s.b - s.a; m.set(key, g);
  }
  return [...m.values()].sort((a, b) => b.min - a.min)[0] || null;
}

const NSV = 'http://www.w3.org/2000/svg';
function postmark(d) {
  const s = document.createElementNS(NSV, 'svg');
  s.setAttribute('viewBox', '0 0 64 40'); s.setAttribute('class', 'postmark'); s.setAttribute('aria-hidden', 'true');
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
  s.innerHTML = `<circle cx="20" cy="20" r="16.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width=".8"/>`
    + `<text x="20" y="18" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor">${dd}.${mm}</text><text x="20" y="26.5" text-anchor="middle" font-size="5.2" fill="currentColor">${d.getFullYear()}</text>`
    + `<path d="M38 13q4-3 8 0t8 0t8 0M38 20q4-3 8 0t8 0t8 0M38 27q4-3 8 0t8 0t8 0" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
  return s;
}

function stampFace(d, data, { past }) {
  const dom = dominant(data.segs);
  const rot = (((d.getDate() * 37 + d.getMonth() * 11) % 7) - 3) * 1.2;
  if (!past) return h('span', { class: 'stamp-slot' }, h('span', { class: 'stamp-d' }, d.getDate()));
  return h('span', { class: `stamp ${dom ? '' : 'blank'}`, style: { '--c': dom?.color || '#9095A8', '--rot': `${rot}deg` }, title: dom ? `En çok: ${dom.name}` : 'Takvimde bir şey yokmuş' },
    h('span', { class: 'stamp-in' }, ic(dom?.icon || 'sun', { size: 28 }), h('span', { class: 'stamp-d' }, d.getDate())));
}

const MODE_KEY = 'vazifedar:defter-mode';
const ui = { sel: toDateKey(new Date()), month: startOfMonth(new Date()), mode: (() => { try { return localStorage.getItem(MODE_KEY) || 'halka'; } catch { return 'halka'; } })() };
export function focusDay(k) { ui.sel = k; ui.month = startOfMonth(parseLocal(k)); }
export const selectedDay = () => ui.sel;

export function renderJournal(root) {
  const rerender = () => {
    const sc = root.scrollTop;
    renderJournal(root);
    root.scrollTop = sc;
  };
  const now = new Date();
  const todayKey = toDateKey(now);
  const ms = ui.month;
  const gs = startOfWeek(ms);
  const weeks = Math.ceil((startOfDay(addDays(new Date(ms.getFullYear(), ms.getMonth() + 1, 0), 1)) - gs) / (7 * 86400000));
  const cells = [];
  let written = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(gs, i);
    const k = toDateKey(d);
    const inMonth = d.getMonth() === ms.getMonth();
    const data = dayData(k);
    const has = !!journalText(k);
    if (has && inMonth) written++;
    const pc = k >= todayKey ? groupsCount(dayGroups(d, now)).open : 0;
    const label = `${d.getDate()} ${AYLAR[d.getMonth()]} ${GUNLER[isoWeekday(d) - 1]}: ${data.segs.length ? `${data.segs.length} kayıt` : 'boş gün'}${has ? ', defter yazılmış' : ''}${pc ? `, ${pc} unutma notu` : ''}`;
    const pul = ui.mode === 'pul';
    cells.push(h('button', {
      type: 'button',
      class: `dj-cell ${pul ? 'pul-cell' : ''} ${inMonth ? '' : 'other'} ${k === todayKey ? 'today' : ''} ${k === ui.sel ? 'sel' : ''} ${has ? 'written' : ''} ${k > todayKey ? 'future' : ''}`,
      'aria-label': label, 'aria-pressed': String(k === ui.sel), title: label,
      onclick: () => { ui.sel = k; if (!inMonth) ui.month = startOfMonth(d); rerender(); },
    }, pul ? [stampFace(d, data, { past: k <= todayKey }), has ? postmark(d) : null]
      : [ring(data.segs), h('span', { class: 'dj-num' }, d.getDate())],
    pc ? h('span', { class: 'dj-pin' }, ic('pin', { size: 11 }), pc) : null));
  }
  const shift = (n) => { ui.month = new Date(ms.getFullYear(), ms.getMonth() + n, 1); rerender(); };

  const month = h('section', { class: 'dj-month' },
    h('div', { class: 'dj-head' },
      h('div', { class: 'nav-arrows' },
        h('button', { class: 'icon-btn', 'aria-label': 'Önceki ay', onclick: () => shift(-1) }, '‹'),
        h('button', { class: 'icon-btn', 'aria-label': 'Sonraki ay', onclick: () => shift(1) }, '›')),
      h('h2', {}, `${AYLAR[ms.getMonth()]} ${ms.getFullYear()}`),
      h('span', { class: 'muted small' }, written ? `${written} sayfa yazıldı` : 'Bu ay henüz yazılmadı'),
      h('div', { class: 'seg compact dj-mode', role: 'radiogroup', 'aria-label': 'Görünüm' }, [['halka', 'Kadranlar'], ['pul', 'Pullar']].map(([m, l]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(ui.mode === m), class: `seg-btn ${ui.mode === m ? 'on' : ''}`,
        onclick: () => { ui.mode = m; try { localStorage.setItem(MODE_KEY, m); } catch { /* yok say */ } rerender(); },
      }, l))),
      ms.getMonth() !== now.getMonth() || ms.getFullYear() !== now.getFullYear()
        ? h('button', { class: 'btn small ghost', onclick: () => { focusDay(todayKey); rerender(); } }, 'Bugün') : null),
    h('div', { class: 'dj-wd', 'aria-hidden': 'true' }, GUNLER_KISA.map((g) => h('span', {}, g))),
    h('div', { class: 'dj-grid' }, cells),
    ui.mode === 'pul'
      ? h('p', { class: 'dj-legend muted small' }, 'Her geçen güne o gün en çok zaman ayırdığın şeyin pulu basılır. Damgalı pullar defter yazılmış günler.')
      : h('p', { class: 'dj-legend muted small' },
        h('span', { class: 'lg-w' }), 'defter yazılmış gün', h('span', { class: 'lg-t' }), 'bugün',
        h('span', { class: 'lg-p' }, ic('pin', { size: 11 })), 'unutma notu'));

  root.replaceChildren(h('div', { class: 'defter' }, month, dayPage(ui.sel, { now, rerender }), allPinsPanel({ onChange: rerender })));
}

function dayPage(k, { now, rerender }) {
  const d = parseLocal(k);
  const todayKey = toDateKey(now);
  const past = k < todayKey, isToday = k === todayKey;
  const data = dayData(k);
  const tw = termWeek(d);
  const go = (n) => { focusDay(toDateKey(addDays(d, n))); rerender(); };

  const segList = data.segs.length || data.allDay.length ? h('ul', { class: 'dj-segs' },
    data.allDay.map((s) => h('li', { style: { '--c': s.c } }, h('span', { class: 'dj-t' }, 'tüm gün'), h('span', {}, s.t))),
    [...data.segs].sort((a, b) => a.a - b.a).map((s) => h('li', { class: s.absent ? 'absent' : '', style: { '--c': s.c } },
      h('span', { class: 'dj-t' }, `${minToHm(s.a)}–${minToHm(Math.min(s.b, 1439))}`),
      h('span', {}, s.t, s.sub && s.sub !== 'Teori' ? h('small', {}, ` ${s.sub}`) : null, s.absent ? h('small', {}, ' · gitmedin') : null))))
    : h('p', { class: 'muted small' }, past ? 'Takvimde bir şey yokmuş.' : 'Takvimde bir şey yok.');

  // O gün bitenler: görevler ve işaretlenen notlar
  const sameKey = (iso) => iso && toDateKey(new Date(iso)) === k;
  const doneTasks = state.tasks.filter((t) => t.done && sameKey(t.doneAt));
  const donePins = state.notes.filter((n) => (n.done && sameKey(n.doneAt)) || Object.values(n.checks || {}).some(sameKey));
  const doneSec = (past || isToday) && (doneTasks.length || donePins.length) ? h('div', { class: 'dj-sec' },
    h('h4', {}, 'O gün bitenler'),
    h('ul', { class: 'dj-done' },
      doneTasks.map((t) => h('li', {}, ic('tick', { size: 13 }), ` ${t.title}`)),
      donePins.map((n) => h('li', { class: 'pin' }, ic('pin', { size: 13 }), ` ${n.text}`)))) : null;

  // Defter yazısı (bugün ve geçmiş günler)
  let writing = null;
  if (!(k > todayKey)) {
    const ta = h('textarea', {
      class: 'lined dj-text', rows: 9, 'aria-label': `${d.getDate()} ${AYLAR[d.getMonth()]} defter yazısı`,
      placeholder: isToday ? 'Bugün neler oldu? Kimle karşılaştın, ne öğrendin, neye güldün… Bir cümle bile yeter.' : 'O gün neler olmuştu?',
    }, journalText(k));
    const upd = state.journal[k]?.updatedAt;
    const status = h('span', { class: 'muted small' }, upd ? `Son düzenleme ${new Date(upd).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : '');
    autosave(ta, k, status, (v) => {
      const cell = document.querySelector('.dj-cell.sel');
      cell?.classList.toggle('written', !!v.trim());
    });
    writing = h('div', { class: 'dj-sec dj-write' }, h('h4', {}, 'Defter'), ta, status);
  }

  const pins = !past ? h('div', { class: 'dj-sec' }, h('h4', {}, isToday ? 'Bugün unutma' : 'O gün unutma'), dayPinsBlock(d, { onChange: rerender })) : null;

  return h('article', { class: 'dj-page', 'aria-label': `${d.getDate()} ${AYLAR[d.getMonth()]} sayfası` },
    h('header', { class: 'dj-ph' },
      h('div', { class: 'dj-pd' },
        h('b', {}, d.getDate()),
        h('span', {}, `${AYLAR[d.getMonth()]} ${d.getFullYear()}`, h('br'), GUNLER[isoWeekday(d) - 1])),
      h('div', { class: 'dj-pnav' },
        h('button', { class: 'icon-btn', 'aria-label': 'Önceki gün', onclick: () => go(-1) }, '‹'),
        h('button', { class: 'icon-btn', 'aria-label': 'Sonraki gün', onclick: () => go(1) }, '›')),
      h('span', { class: 'dj-pw' }, isToday ? 'Bugün' : sameDay(d, addDays(now, -1)) ? 'Dün' : sameDay(d, addDays(now, 1)) ? 'Yarın' : '', tw ? `${isToday || sameDay(d, addDays(now, -1)) || sameDay(d, addDays(now, 1)) ? ' · ' : ''}Dönemin ${tw.n}. haftası` : '')),
    h('div', { class: 'dj-body' },
      h('div', { class: 'dj-dialrow' }, h('div', { class: 'dj-bigring' }, ring(data.segs, { big: true })), segList),
      data.frozen ? h('p', { class: 'dj-frozen muted small' }, 'Bu günün kadranı arşivde. ',
        h('button', { type: 'button', class: 'linkish', onclick: () => { redraw(k); toast('Kadran şimdiki takvimle yeniden çizildi'); } }, 'Takvimden yeniden çiz')) : null,
      pins, doneSec, writing));
}
