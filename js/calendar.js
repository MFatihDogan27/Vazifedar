// Takvim görünümleri: Hafta, Ay, Ajanda
import { h, toast, openModal } from './ui.js';
import { state, occurrencesInRange, breakOn, category, commit, upsertEvent, priority, ONCELIKLER, dueDate } from './store.js';
import {
  startOfWeek, startOfMonth, addDays, startOfDay, sameDay, toLocalISO, toDateKey, timeStr,
  GUNLER_KISA, GUNLER, AYLAR, addMinutes, fmtDateLong, relativeDays, isoWeekday, overlaps, hmToMin, durationText, fmtDateShort,
} from './dates.js';
import { openEventForm, openOccurrence, moveOccurrence } from './forms.js';
import { openCount } from './notes.js';
import { applyTexture, textureKey } from './themes.js';
import { ic } from './icons.js';
import { prayerEnabled, prayerSettings, prayersInRange } from './prayer.js';
import { ring, dayData } from './journal.js';
import { hijri, holyDay, moonPhaseOn, moonGlyph, HICRI_AYLAR } from './hicri.js';

// Telefonda haftalık görünüm "mercek" düzenine geçer: üstte haftanın 7 gün halkası, altında yan yana
// kayan gün sütunları (ekranda tek gün, kaydırınca öteki gün). Şeritteki mercek o an görünen günün üstünde durur.
export const NARROW_WEEK = '(max-width: 640px)';
export const isNarrowWeek = () => !!window.matchMedia?.(NARROW_WEEK).matches;
const narrowPos = { ws: '', left: null }; // haftada nerede kalındı (dakikalık yeniden çizimde kaybolmasın)
let narrowFocus = null; // telefonda hafta açılınca gidilecek gün (aydan bir güne dokunup "Haftada gör" denince)
let moSel = null;       // telefonda ayda seçili gün ('YYYY-MM-DD')
// "Bugün" gibi bilinçli bir dönüşte kalınan yer unutulur: görünüm bugünün sütunundan açılır
export function forgetWeekPos() { narrowPos.ws = ''; narrowPos.left = null; }

const PX_PER_HOUR = 52;  // dolu saat
const PX_PER_HOUR_NARROW = 40; // telefonda dolu saat (52'de bir saatlik kayıt ekranda çok yer kaplıyordu)
const QUIET_PX = 20;     // haftanın hiçbir gününde kaydı olmayan saat (esnek eksen)
const SLEEP_PX = 30;     // uyku aralığının tamamı tek ince şerit (esnek eksen)

export function calendarTitle(mode, anchor) {
  if (mode === 'month') return `${AYLAR[anchor.getMonth()]} ${anchor.getFullYear()}`;
  if (mode === 'agenda') return `${anchor.getDate()} ${AYLAR[anchor.getMonth()]} itibarıyla`;
  const s = startOfWeek(anchor), e = addDays(s, 6);
  if (s.getMonth() === e.getMonth()) return `${s.getDate()} – ${e.getDate()} ${AYLAR[s.getMonth()]} ${s.getFullYear()}`;
  if (s.getFullYear() === e.getFullYear()) return `${s.getDate()} ${AYLAR[s.getMonth()]} – ${e.getDate()} ${AYLAR[e.getMonth()]} ${e.getFullYear()}`;
  return `${s.getDate()} ${AYLAR[s.getMonth()]} ${s.getFullYear()} – ${e.getDate()} ${AYLAR[e.getMonth()]} ${e.getFullYear()}`;
}

export function shiftAnchor(mode, anchor, dir) {
  if (mode === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  if (mode === 'agenda') return addDays(anchor, 30 * dir);
  return addDays(anchor, 7 * dir);
}

const openOcc = (o) => openOccurrence(o);
const setSetting = (k, v) => { state.settings[k] = v; commit('settings'); };

// Kısa etiket: ikon, tekrar işareti, teslim saati
function chipText(o) {
  if (o.kind === 'deadline') return [ic(o.icon, { size: 13 }), ` ${timeStr(o.due)} ${o.title}`];
  return [ic(o.icon, { size: 13 }), ` ${o.title}`, o.recurring ? ic('repeat', { size: 12, cls: 'ic-rep', label: 'tekrarlayan' }) : null];
}

// Zamanlı kayıtlar arasında çakışanları işaretle
function markClashes(items) {
  const timed = items.filter((o) => !o.allDay);
  const clash = new Set();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (timed[j].start >= timed[i].end) continue;
      if (overlaps(timed[i].start, timed[i].end, timed[j].start, timed[j].end)) { clash.add(timed[i].id); clash.add(timed[j].id); }
    }
  }
  return clash;
}

// ---------------------------------------------------------------------------
// Esnek saat ekseni: dolu saatler geniş, haftanın hiçbir gününde kaydı olmayan saatler ince,
// uyku aralığı tek bir gece şeridi. Düz eksende eskisi gibi her saat aynı boyda.
// ---------------------------------------------------------------------------
function timeAxis(items, ws, sh, eh, elastic, pxHour = PX_PER_HOUR) {
  const busy = new Array(24).fill(false);
  for (const o of items) {
    if (o.allDay) continue;
    for (let i = 0; i < 7; i++) {
      const ds = addDays(ws, i), de = addDays(ds, 1);
      if (o.end <= ds || o.start >= de) continue;
      const a = (Math.max(o.start, ds) - ds) / 60000, b = (Math.min(o.end, de) - ds) / 60000;
      for (let hh = Math.floor(a / 60); hh < Math.ceil(b / 60) && hh < 24; hh++) busy[hh] = true;
    }
  }
  const rows = [];
  for (let hh = 0; hh < 24; hh++) {
    const inDay = hh >= sh && hh < eh;
    let type;
    if (!elastic) type = inDay ? 'busy' : 'hidden';
    else if (busy[hh]) type = 'busy';
    else type = inDay ? 'quiet' : 'sleep';
    rows.push({ hh, type, h: 0, top: 0 });
  }
  // Uyku aralıkları: ardışık uyku saatleri tek şerit
  const runs = [];
  for (let i = 0; i < 24; i++) {
    if (rows[i].type !== 'sleep') continue;
    let j = i; while (j + 1 < 24 && rows[j + 1].type === 'sleep') j++;
    runs.push({ from: i, to: j + 1 });
    for (let k = i; k <= j; k++) rows[k].h = SLEEP_PX / (j - i + 1);
    i = j;
  }
  let y = 0;
  for (const r of rows) {
    if (r.type === 'busy') r.h = pxHour;
    else if (r.type === 'quiet') r.h = QUIET_PX;
    else if (r.type === 'hidden') r.h = 0;
    r.top = y; y += r.h;
  }
  const total = y;
  const yOf = (min) => {
    if (min >= 1440) return total;
    const r = rows[Math.max(0, Math.floor(min / 60))];
    return r.top + ((min - r.hh * 60) / 60) * r.h;
  };
  const minOf = (yy) => {
    if (yy <= 0) return rows.find((r) => r.h > 0)?.hh * 60 || 0;
    for (const r of rows) if (r.h > 0 && yy < r.top + r.h) return r.hh * 60 + ((yy - r.top) / r.h) * 60;
    return 1440;
  };
  const rowAt = (min) => rows[Math.min(23, Math.max(0, Math.floor(min / 60)))];
  const shown = rows.filter((r) => r.h > 0);
  const visFrom = shown.length ? shown[0].hh * 60 : 0;
  const visTo = shown.length ? shown[shown.length - 1].hh * 60 + 60 : 1440;
  return { rows, runs, total, yOf, minOf, rowAt, visFrom, visTo };
}

// Günün boşlukları (görev yerleştirme saatleri içinde, en az 1 saat)
function dayGaps(d, timed, now) {
  const day = startOfDay(d);
  const winStart = addMinutes(day, hmToMin(state.settings.freeSlotStart || '09:00'));
  const winEnd = addMinutes(day, hmToMin(state.settings.freeSlotEnd || '22:00'));
  let cursor = new Date(Math.max(winStart, now));
  if (cursor >= winEnd) return [];
  const r = cursor.getMinutes() % 15; if (r) cursor = addMinutes(cursor, 15 - r);
  cursor.setSeconds(0, 0);
  const out = [];
  const busy = timed.filter((o) => o.end > cursor && o.start < winEnd).sort((a, b) => a.start - b.start);
  const push = (s, e) => { if (e - s >= 60 * 60000) out.push({ start: new Date(s), end: new Date(e) }); };
  for (const o of busy) {
    if (o.start > cursor) push(cursor, Math.min(o.start, winEnd));
    if (o.end > cursor) cursor = new Date(o.end);
  }
  if (cursor < winEnd) push(cursor, winEnd);
  return out;
}

// Boşluğa ne koyalım: sığan açık görevler, ya da yeni plan
function openGapPicker(gap) {
  const mins = Math.round((gap.end - gap.start) / 60000);
  const scheduled = (t) => t.scheduledEventId && state.events.some((e) => e.id === t.scheduledEventId && !e.deleted);
  const order = (id) => ONCELIKLER.findIndex((p) => p.id === id);
  const tasks = state.tasks.filter((t) => !t.done && !scheduled(t))
    .sort((a, b) => order(a.priority) - order(b.priority) || (a.due ? dueDate(a) : Infinity) - (b.due ? dueDate(b) : Infinity));
  const fit = tasks.filter((t) => (t.estimateMin || 60) <= mins);
  const rest = tasks.length - fit.length;
  let m;
  const place = (t) => {
    const st = gap.start, en = addMinutes(st, t.estimateMin || 60);
    const ev = upsertEvent({ title: t.title, categoryId: 'gorev', start: toLocalISO(st), end: toLocalISO(en), notes: t.notes, taskId: t.id, reminderMin: 10, syncToGoogle: !!state.settings.googleConnected });
    t.scheduledEventId = ev.id; commit('tasks');
    m.close();
    toast(`"${t.title}" ${timeStr(st)}–${timeStr(en)} arasına yerleştirildi`);
  };
  const body = h('div', { class: 'gap-pick' },
    h('p', { class: 'muted' }, `${fmtDateLong(gap.start)}, ${timeStr(gap.start)}–${timeStr(gap.end)}: ${durationText(mins)} boş.`),
    fit.length
      ? h('ul', { class: 'gap-list' }, fit.map((t) => {
        const p = priority(t.priority);
        return h('li', {}, h('button', { type: 'button', class: 'gap-task', style: { '--c': p.color }, onclick: () => place(t) },
          h('span', { class: 'gap-dot', title: p.name }),
          h('span', { class: 'gap-t' }, t.title),
          h('span', { class: 'muted small' }, [durationText(t.estimateMin || 60), t.due ? `son ${fmtDateShort(dueDate(t))}` : ''].filter(Boolean).join(' · ')),
          h('span', { class: 'gap-go' }, 'Buraya koy')));
      }))
      : h('p', {}, tasks.length ? 'Açık görevlerin hiçbiri bu boşluğa sığmıyor.' : 'Açık görev yok.'),
    rest && fit.length ? h('p', { class: 'muted small' }, `${rest} görev daha uzun sürdüğü için listede yok.`) : null);
  m = openModal({
    title: 'Boşluğa ne koyalım?', body, actions: [
      { label: 'Bu saate plan ekle', kind: 'primary', onClick: (_, close) => { close(); openEventForm({ start: toLocalISO(gap.start), end: toLocalISO(gap.end) }); } },
    ],
  });
}

// Geçmiş kayıtlara mürekkep damgası
function pastStamp(o) {
  if (o.kind === 'course') {
    return o.absent ? h('span', { class: 'ev-stamp absent', 'aria-hidden': 'true' }, 'GİTMEDİM')
      : o.absentPart ? h('span', { class: 'ev-stamp absent', 'aria-hidden': 'true' }, `${o.absentPart} SAAT YOK`)
      : h('span', { class: 'ev-stamp seal', title: 'Ders işlendi' }, ic('tick', { size: 11 }));
  }
  const rot = ((o.start.getDate() * 7 + o.start.getHours()) % 13) - 6;
  return h('span', { class: 'ev-stamp pul', style: { '--rot': `${rot}deg` }, title: 'Geride kaldı' }, h('span', { class: 'pul-in' }, ic(o.icon, { size: 11 })));
}

const STAPLE_D = 'M2.5 8.5V3.2A1.7 1.7 0 0 1 4.2 1.5h17.6a1.7 1.7 0 0 1 1.7 1.7v5.3';
const STAPLE = `<svg viewBox="0 0 26 10" aria-hidden="true"><path class="s-out" d="${STAPLE_D}" fill="none" stroke-width="3.6" stroke-linecap="round"/><path class="s-in" d="${STAPLE_D}" fill="none" stroke-width="1.5" stroke-linecap="round"/></svg>`;

// Başlıktaki gün halkası: o günün kadranı, ortasında tarih
function dayHeadRing(d, today) {
  const data = dayData(toDateKey(d));
  const min = data.segs.reduce((a, s) => a + (s.b - s.a), 0);
  const wrap = h('span', { class: 'wk-dd', title: min ? `${Math.round(min / 6) / 10} saat dolu` : 'Boş gün' }, ring(data.segs, { thin: true }), h('b', {}, d.getDate()));
  if (sameDay(d, today)) {
    // Şimdi: halkanın üstünde küçük bir ibre ucu
    const a = ((today.getHours() * 60 + today.getMinutes()) / 1440) * 360 + 180;
    wrap.append(h('i', { class: 'wk-dd-now', style: { transform: `rotate(${a}deg)` } }));
  }
  return wrap;
}

// ---------------------------------------------------------------------------
// HAFTA
// ---------------------------------------------------------------------------
export function renderWeek(root, anchor) {
  const ws = startOfWeek(anchor);
  const we = addDays(ws, 7);
  const items = occurrencesInRange(ws, we);
  const clash = markClashes(items);
  const sh = state.settings.dayStartHour, eh = state.settings.dayEndHour;
  const elastic = state.settings.weekElastic !== false;
  const today = new Date();
  const narrow = isNarrowWeek();
  const ax = timeAxis(items, ws, sh, eh, elastic, narrow ? PX_PER_HOUR_NARROW : PX_PER_HOUR);

  // Haftalık özet
  const exams = items.filter((o) => o.kind === 'event' && o.categoryId === 'sinav').length;
  const courseMin = items.filter((o) => o.kind === 'course').reduce((a, o) => a + (o.end - o.start) / 60000, 0);
  const plans = items.filter((o) => o.kind === 'event' && o.categoryId !== 'sinav').length;
  const summary = h('div', { class: 'week-summary' },
    exams ? h('span', { class: 'pill red' }, `${exams} sınav`) : null,
    h('span', { class: 'pill' }, `${plans} plan`),
    courseMin ? h('span', { class: 'pill' }, `${String(Math.round(courseMin / 60 * 10) / 10).replace('.', ',')} `, h('span', { class: 'lng' }, 'saat'), h('span', { class: 'shr' }, 'sa'), ' ders') : null,
    clash.size ? h('span', { class: 'pill warn' }, `${clash.size} `, h('span', { class: 'lng' }, 'kayıt çakışıyor'), h('span', { class: 'shr' }, 'çakışma')) : null,
    h('span', { class: 'ws-gap' }),
    h('button', {
      type: 'button', class: `pill-tg ${elastic ? 'on' : ''}`, 'aria-pressed': String(elastic),
      title: elastic ? 'Boş saatler ince, uyku saatleri tek şerit. Düz eksene dönmek için tıkla.' : 'Her saat aynı boyda. Esnek eksene geçmek için tıkla.',
      onclick: () => setSetting('weekElastic', !elastic),
    }, h('span', { class: 'tg-ic', 'aria-hidden': 'true' }), elastic ? 'Esnek' : 'Düz', h('span', { class: 'tg-more' }, 'eksen')));

  const days = [...Array(7)].map((_, i) => addDays(ws, i));

  const head = h('div', { class: 'wk-head' }, h('div', { class: 'wk-gutter' }),
    days.map((d) => {
      const br = breakOn(d);
      const holy = holyDay(d);
      const moon = moonPhaseOn(d);
      return h('div', { class: `wk-day-h ${sameDay(d, today) ? 'today' : ''} ${isoWeekday(d) >= 6 ? 'weekend' : ''}`, 'data-date': toDateKey(d) },
        h('span', { class: 'wk-dn' }, GUNLER_KISA[isoWeekday(d) - 1], moon ? moonGlyph(moon, 12) : null),
        dayHeadRing(d, today),
        br ? h('span', { class: 'wk-break', title: br.label }, br.label || 'Tatil') : null,
        holy ? h('span', { class: `wk-holy ${holy.kind}`, title: `${holy.name} (hicri takvime göre, ±1 gün)` }, holy.name) : null);
    }));

  // Tüm gün satırı
  const allDayItems = items.filter((o) => o.allDay);
  const adChips = (d) => allDayItems.filter((o) => o.start < addDays(d, 1) && o.end > d)
    .map((o) => h('button', { class: `ad-chip ${o.kind} ${o.done ? 'done' : ''}`, style: { '--c': o.color }, title: o.kind === 'deadline' ? `Teslim: ${o.title} (${timeStr(o.due)})` : o.title, onclick: () => openOcc(o) }, chipText(o)));
  const newAllDay = (d) => (e) => { if (e.target === e.currentTarget) openEventForm({ start: `${toDateKey(d)}T00:00`, end: `${toDateKey(d)}T23:59`, allDay: true }); };
  const adRow = h('div', { class: 'wk-allday' }, h('div', { class: 'wk-gutter small muted' }, 'tüm gün'),
    days.map((d) => h('div', { class: 'wk-ad-cell', onclick: newAllDay(d) }, adChips(d))));

  // Saat cetveli: dolu saatler tam, sessiz saatler ince, uyku tek şerit
  const gutter = h('div', { class: 'wk-gutter hours', style: { height: `${ax.total}px` } });
  const lines = h('div', { class: 'wk-lines', 'aria-hidden': 'true' });
  for (const r of ax.rows) {
    if (!r.h || r.type === 'sleep') continue;
    gutter.append(h('div', { class: `hr-label ${r.type} ${r.top === 0 ? 'first' : ''}`, style: { top: `${r.top}px`, height: `${r.h}px` } }, r.type === 'quiet' ? String(r.hh).padStart(2, '0') : `${String(r.hh).padStart(2, '0')}:00`));
    lines.append(h('div', { class: `wk-row ${r.type}`, style: { top: `${r.top}px`, height: `${r.h}px` } }));
  }
  for (const run of ax.runs) {
    const top = ax.rows[run.from].top, height = ax.rows[run.to - 1].top + ax.rows[run.to - 1].h - top;
    const label = `${String(run.from).padStart(2, '0')}–${String(run.to % 24).padStart(2, '0')}`;
    gutter.append(h('div', { class: 'hr-label sleep', style: { top: `${top}px`, height: `${height}px` }, title: `${label} uyku` }, ic('moon', { size: 12 }), h('span', {}, label)));
    lines.append(h('div', { class: 'wk-row sleep', style: { top: `${top}px`, height: `${height}px` } }));
  }

  const cols = days.map((d) => {
    const d0 = startOfDay(d);
    const dayEnd = addDays(d0, 1);
    const visStart = addMinutes(d0, ax.visFrom), visEnd = addMinutes(d0, ax.visTo);
    const timed = items.filter((o) => !o.allDay && overlaps(o.start, o.end, d0, dayEnd));
    const segs = timed.filter((o) => overlaps(o.start, o.end, visStart, visEnd)).map((o) => ({
      o, s: Math.max(o.start, visStart), e: Math.min(o.end, visEnd),
    }));
    layoutColumns(segs);
    const yAt = (t) => ax.yOf((t - d0) / 60000);
    const col = h('div', {
      class: `wk-col ${sameDay(d, today) ? 'today' : ''} ${breakOn(d) ? 'holiday' : ''}`, style: { height: `${ax.total}px` }, 'data-date': toDateKey(d),
      onclick: (e) => {
        if (e.target !== col) return;
        if (col._suppress) { col._suppress = false; return; }
        const min = ax.minOf(e.offsetY);
        if (ax.rowAt(min).type === 'sleep') return;
        const st = addMinutes(d0, Math.floor(min / 30) * 30);
        openEventForm({ start: toLocalISO(st) });
      },
    });
    col.addEventListener('pointerdown', (e) => dragCreate(e, col, d, ax));
    // Namaz vakitleri: kayıtların altında ince kesik çizgi
    if (prayerEnabled() && prayerSettings().inWeek !== false) {
      for (const p of prayersInRange(d0, dayEnd)) {
        const min = (p.at - d0) / 60000;
        const r = ax.rowAt(min);
        if (r.type === 'sleep' || r.type === 'hidden') continue;
        col.append(h('div', { class: `pr-mark ${p.id} ${r.type}`, style: { top: `${ax.yOf(min)}px` }, 'aria-hidden': 'true' },
          h('span', {}, `${p.name} ${timeStr(p.at)}`)));
      }
    }
    // Boşluk cepleri: 1 saatten uzun boş zamanlar, tıklayınca görev ya da plan konur
    if (dayEnd > today) {
      for (const g of dayGaps(d, timed, today)) {
        const top = yAt(g.start), height = yAt(g.end) - top;
        if (height < 18) continue;
        const mins = Math.round((g.end - g.start) / 60000);
        col.append(h('div', { class: `gap-pocket ${height < 34 ? 'thin' : ''}`, style: { top: `${top + 2}px`, height: `${height - 4}px` } },
          h('button', { type: 'button', class: 'gap-chip', title: `${timeStr(g.start)}–${timeStr(g.end)} boş · tıkla: görev ya da plan koy`, onclick: (e) => { e.stopPropagation(); openGapPicker(g); } },
            `${durationText(mins)} boş`)));
      }
    }
    for (const g of segs) {
      const top = yAt(g.s);
      const height = Math.max(18, yAt(g.e) - top - 2);
      const w = 100 / g.cols;
      const o = g.o;
      const short = height < 34;
      const isClash = clash.has(o.id);
      const past = o.end < today;
      const el = h('button', {
        class: `ev ${o.kind} ${isClash ? 'clash' : ''} ${short ? 'short' : ''} ${past ? 'past' : ''} ${o.absent ? 'absent' : ''}`,
        style: { top: `${top}px`, height: `${height}px`, left: `calc(${g.col * w}% + 2px)`, width: `calc(${g.col === g.cols - 1 ? w : Math.min(100 - g.col * w, w * 1.7)}% - 4px)`, zIndex: String(g.col + 1), '--c': o.color, '--tilt': isClash ? (g.col % 2 ? '1.4deg' : '-1.1deg') : null },
        title: `${o.title}\n${timeStr(o.start)}–${timeStr(o.end)}${o.location ? `\n${o.location}` : ''}${o.recurring ? '\n↻ Tekrarlayan plan' : ''}${o.absent ? '\n✕ Gitmedin' : o.absentPart ? `\n✕ ${o.absentPart} saatine gitmedin` : ''}${isClash ? '\n⚠ Çakışma var' : ''}`,
        onclick: (e) => { e.stopPropagation(); if (el._dragged) { el._dragged = false; return; } openOcc(o); },
      },
      h('span', { class: 'ev-title' }, isClash ? ic('alert', { size: 12, cls: 'ic-warn', label: 'çakışma' }) : null, o.absent ? ic('x', { size: 12, label: 'gitmedin' }) : null, openCount(o) ? ic('pin', { size: 12, cls: 'ic-pin', label: 'unutma notu var' }) : null, o.kind === 'event' ? ic(o.icon, { size: 13 }) : null, ` ${o.title}`, o.recurring ? ic('repeat', { size: 12, cls: 'ic-rep', label: 'tekrarlayan' }) : null),
      short ? null : h('span', { class: 'ev-meta' }, `${timeStr(o.start)}–${timeStr(o.end)}`, o.location ? ` · ${o.location}` : '', o.sub && o.sub !== 'Teori' ? ` · ${o.sub}` : '', o.absent ? ' · gitmedin' : o.absentPart ? ` · ${o.absentPart} saat gitmedin` : ''),
      o.google ? h('span', { class: 'ev-g', title: 'Google Takvim ile eşitli' }, 'G') : null,
      past && height >= 30 ? pastStamp(o) : null);
      if (height >= 26) applyTexture(el, textureKey(o));
      if (o.kind === 'event' && !o.allDay) {
        el.classList.add('draggable');
        el.addEventListener('pointerdown', (e) => dragEvent(e, el, o, 'move', ax));
        const grip = h('span', { class: 'ev-resize', 'aria-hidden': 'true' });
        grip.addEventListener('pointerdown', (e) => { e.stopPropagation(); dragEvent(e, el, o, 'resize', ax); });
        el.append(grip);
      }
      col.append(el);
      // Çakışan iki kâğıt: üstteki, alttakine zımbayla tutturulmuş
      if (isClash && g.col > 0) {
        const st = h('span', { class: 'staple', style: { top: `${top + 7}px`, left: `calc(${g.col * w}% - 9px)`, zIndex: String(g.col + 2) }, title: 'Çakışma' });
        st.innerHTML = STAPLE;
        col.append(st);
      }
    }
    if (sameDay(d, today)) {
      const nowMin = today.getHours() * 60 + today.getMinutes();
      if (ax.rowAt(nowMin).h > 0) col.append(h('div', { class: 'now-line', style: { top: `${ax.yOf(nowMin)}px` } }));
    }
    return col;
  });

  const body = h('div', { class: 'wk-body' }, gutter, h('div', { class: 'wk-cols' }, lines, cols));
  const scrollToNow = (scroller, extra = 0) => {
    const target = sameDay(startOfWeek(today), ws) ? Math.max(sh, today.getHours() - 2) : Math.max(sh, 8);
    scroller.scrollTop = ax.yOf(target * 60) - (elastic ? 24 : 0) + extra;
  };

  if (narrow) {
    // Telefonda tek gün göründüğü için bugün değilse o günün ilk kaydına kaydır
    const scrollToDay = (scroller, d) => {
      if (sameDay(d, today)) { scrollToNow(scroller); return; }
      const d0 = startOfDay(d), dn = addDays(d0, 1);
      const first = items.filter((o) => !o.allDay && o.start < dn && o.end > d0).reduce((m, o) => Math.min(m, o.start < d0 ? 0 : (o.start - d0) / 60000), Infinity);
      const min = first === Infinity ? Math.max(sh, 8) * 60 : Math.max(sh * 60, first - 30);
      scroller.scrollTop = ax.yOf(min) - (elastic ? 24 : 0);
    };
    root.replaceChildren(summary, narrowWeek({ ws, days, today, elastic, body, adChips, newAllDay, scrollToNow, scrollToDay }));
    return;
  }
  const scroller = h('div', { class: 'wk-scroll' }, body);
  root.replaceChildren(summary, h('div', { class: `week ${elastic ? 'elastic' : ''}` }, head, adRow, scroller));

  // Uygun saate kaydır
  requestAnimationFrame(() => scrollToNow(scroller));
}

// ---------------------------------------------------------------------------
// Telefonda hafta: "mercek"
// Üstte 7 gün halkası (haftanın yükü bir bakışta), altında yan yana kayan gün sütunları; ekranda tek gün.
// Sütun başlıkları (gün adı, tüm gün kayıtları, ödev teslimleri) ve saat cetveli kaydırırken yerinde
// kalır. Şeritteki mercek o an ekranda olan günlerin üstüne kayar; bir halkaya dokununca o güne gider.
// ---------------------------------------------------------------------------
function narrowWeek({ ws, days, today, elastic, body, adChips, newAllDay, scrollToNow, scrollToDay }) {
  const wsKey = toDateKey(ws);
  const lens = h('span', { class: 'wk-lens', 'aria-hidden': 'true' });
  const scroller = h('div', { class: 'wk-scroll' });
  const colW = () => scroller.querySelector('.wk-col')?.getBoundingClientRect().width || 1;
  const goDay = (i, smooth = true) => scroller.scrollTo({ left: i * colW(), behavior: smooth && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });

  const strip = h('div', { class: 'wk-strip', role: 'tablist', 'aria-label': 'Haftanın günleri' }, lens,
    days.map((d, i) => h('button', {
      type: 'button', role: 'tab', class: `wk-sd ${sameDay(d, today) ? 'today' : ''} ${isoWeekday(d) >= 6 ? 'weekend' : ''} ${breakOn(d) ? 'holiday' : ''}`,
      'data-date': toDateKey(d), 'aria-label': `${GUNLER[isoWeekday(d) - 1]} ${d.getDate()} ${AYLAR[d.getMonth()]}`,
      onclick: () => goDay(i),
    }, h('span', { class: 'wk-dn' }, GUNLER_KISA[isoWeekday(d) - 1]), dayHeadRing(d, today))));

  const mhead = h('div', { class: 'wk-mhead' }, h('div', { class: 'wk-corner' }),
    days.map((d) => {
      const br = breakOn(d);
      const holy = holyDay(d);
      const moon = moonPhaseOn(d);
      return h('div', { class: `wk-ch ${sameDay(d, today) ? 'today' : ''} ${isoWeekday(d) >= 6 ? 'weekend' : ''}`, 'data-date': toDateKey(d), onclick: newAllDay(d) },
        h('div', { class: 'wk-ch-t' },
          h('b', {}, GUNLER[isoWeekday(d) - 1]), h('span', {}, `${d.getDate()} ${AYLAR[d.getMonth()]}`),
          sameDay(d, today) ? h('i', { class: 'wk-ch-now' }, 'bugün') : null, moon ? moonGlyph(moon, 12) : null),
        br ? h('span', { class: 'wk-break', title: br.label }, br.label || 'Tatil') : null,
        holy ? h('span', { class: `wk-holy ${holy.kind}` }, holy.name) : null,
        adChips(d));
    }));
  scroller.append(h('div', { class: 'wk-mgrid' }, mhead, body));

  // Mercek: görünen günlerin üstünde
  let raf = 0;
  const syncLens = () => {
    raf = 0;
    if (!scroller.isConnected) return; // bu çizim yerini yenisine bıraktı
    const w = colW();
    const first = scroller.scrollLeft / w;
    const vis = Math.min(7, (scroller.clientWidth - (scroller.querySelector('.wk-gutter.hours')?.offsetWidth || 0)) / w);
    lens.style.left = `${(first / 7) * 100}%`;
    lens.style.width = `${(vis / 7) * 100}%`;
    strip.querySelectorAll('.wk-sd').forEach((b, i) => {
      const on = i + 1 > first + 0.35 && i < first + vis - 0.35;
      b.classList.toggle('in', on);
      b.setAttribute('aria-selected', String(on));
    });
    narrowPos.ws = wsKey; narrowPos.left = scroller.scrollLeft;
  };
  scroller.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(syncLens); }, { passive: true });

  requestAnimationFrame(() => {
    // Açılışta görünüm art arda iki kez çizilebilir: ekrandan kalkmış çizim yeri bozmasın
    if (!scroller.isConnected) return;
    // Aynı haftada kalındıysa yerini koru; yoksa bu haftaysa bugüne, değilse pazartesiye
    const ti = days.findIndex((d) => sameDay(d, today));
    const fi = narrowFocus ? days.findIndex((d) => sameDay(d, narrowFocus)) : -1;
    narrowFocus = null;
    if (fi >= 0) { scroller.scrollLeft = fi * colW(); scrollToDay(scroller, days[fi]); }
    else if (narrowPos.ws === wsKey && narrowPos.left !== null) { scroller.scrollLeft = narrowPos.left; scrollToNow(scroller); }
    else { scroller.scrollLeft = Math.max(0, ti) * colW(); scrollToDay(scroller, days[Math.max(0, ti)]); }
    syncLens();
  });
  return h('div', { class: `week narrow ${elastic ? 'elastic' : ''}` }, strip, scroller);
}

// ---- Sürükle-bırak ----
const snap = (min, step = 15) => Math.round(min / step) * step;
const minIn = (t) => t.getHours() * 60 + t.getMinutes();

// Planı taşı (mode 'move') ya da alt kenarından uzat/kısalt (mode 'resize'). Esnek eksende
// fare konumu saat cetveline göre çevrilir.
function dragEvent(e, el, o, mode, ax) {
  if (e.button !== 0 || e.pointerType === 'touch') return;
  const colsEl = el.closest('.wk-cols');
  if (!colsEl) return;
  const colW = colsEl.getBoundingClientRect().width / 7;
  const x0 = e.clientX, y0 = e.clientY;
  const durMin = Math.round((o.end - o.start) / 60000);
  const sMin = minIn(o.start), eMin = sameDay(o.start, o.end) ? minIn(o.end) : 1440;
  const baseH = el.offsetHeight;
  let moved = false, dMin = 0, dDay = 0, badge = null;
  const calc = () => {
    if (mode === 'move') return { ns: addMinutes(addDays(o.start, dDay), dMin), ne: addMinutes(addDays(o.end, dDay), dMin) };
    return { ns: o.start, ne: addMinutes(o.start, Math.max(15, durMin + dMin)) };
  };
  const onMove = (ev) => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) {
      moved = true;
      el.classList.add('dragging');
      badge = h('span', { class: 'ev-drag-time' });
      el.append(badge);
    }
    if (mode === 'move') {
      dMin = snap(ax.minOf(ax.yOf(sMin) + dy)) - sMin;
      dDay = Math.round(dx / colW);
      el.style.transform = `translate(${dDay * colW}px, ${ax.yOf(sMin + dMin) - ax.yOf(sMin)}px)`;
    } else {
      dMin = Math.max(15 - durMin, snap(ax.minOf(ax.yOf(eMin) + dy)) - eMin);
      el.style.height = `${Math.max(18, ax.yOf(Math.min(1440, eMin + dMin)) - ax.yOf(sMin) - 2)}px`;
    }
    const { ns, ne } = calc();
    badge.textContent = `${dDay ? `${GUNLER_KISA[isoWeekday(ns) - 1]} ` : ''}${timeStr(ns)}–${timeStr(ne)}`;
  };
  const onUp = async () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    if (!moved) return;
    el._dragged = true;
    const { ns, ne } = calc();
    const reset = () => { el.classList.remove('dragging'); el.style.transform = ''; badge?.remove(); };
    if (ns.getTime() === o.start.getTime() && ne.getTime() === o.end.getTime()) { reset(); return; }
    const ok = await moveOccurrence(o, ns, ne);
    if (!ok) { reset(); el.style.height = `${baseH}px`; }
  };
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
}

// Boş alanda sürükleyerek yeni plan için saat aralığı seç
function dragCreate(e, col, d, ax) {
  if (e.target !== col || e.button !== 0 || e.pointerType === 'touch') return;
  const rect = col.getBoundingClientRect();
  const yToMin = (y) => ax.minOf(Math.max(0, Math.min(ax.total, y - rect.top)));
  const m0 = Math.floor(yToMin(e.clientY) / 30) * 30;
  if (ax.rowAt(m0).type === 'sleep') return;
  let m1 = m0 + 30, moved = false, sel = null;
  const base = startOfDay(d);
  const onMove = (ev) => {
    if (!moved && Math.abs(ev.clientY - e.clientY) < 8) return;
    if (!moved) { moved = true; sel = h('div', { class: 'ev-sel' }, h('span', {})); col.append(sel); }
    m1 = Math.min(1440, Math.max(m0 + 15, snap(yToMin(ev.clientY))));
    sel.style.top = `${ax.yOf(m0)}px`;
    sel.style.height = `${ax.yOf(m1) - ax.yOf(m0)}px`;
    sel.firstChild.textContent = `${timeStr(addMinutes(base, m0))}–${timeStr(addMinutes(base, m1))}`;
  };
  const onUp = () => {
    col.removeEventListener('pointermove', onMove);
    col.removeEventListener('pointerup', onUp);
    col.removeEventListener('pointercancel', onUp);
    if (!moved) return;
    col._suppress = true;
    setTimeout(() => { col._suppress = false; }, 50);
    sel?.remove();
    openEventForm({ start: toLocalISO(addMinutes(base, m0)), end: toLocalISO(addMinutes(base, m1)) });
  };
  col.setPointerCapture(e.pointerId);
  col.addEventListener('pointermove', onMove);
  col.addEventListener('pointerup', onUp);
  col.addEventListener('pointercancel', onUp);
}

// Çakışan kutuları yan yana yerleştir
function layoutColumns(segs) {
  segs.sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [], clusterEnd = 0;
  const flush = () => {
    const colsEnd = [];
    for (const g of cluster) {
      let c = colsEnd.findIndex((end) => end <= g.s);
      if (c === -1) { c = colsEnd.length; colsEnd.push(0); }
      colsEnd[c] = g.e; g.col = c;
    }
    for (const g of cluster) g.cols = colsEnd.length;
    cluster = [];
  };
  for (const g of segs) {
    if (cluster.length && g.s >= clusterEnd) flush();
    cluster.push(g);
    clusterEnd = Math.max(clusterEnd, g.e);
    if (cluster.length === 1) clusterEnd = g.e;
  }
  if (cluster.length) flush();
}

// ---------------------------------------------------------------------------
// AY
// ---------------------------------------------------------------------------
function hijriRange(ms) {
  const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
  const a = hijri(ms), b = hijri(me);
  if (!a || !b) return '';
  if (a.m === b.m) return `${a.name} ${a.y}`;
  return a.y === b.y ? `${a.name} – ${b.name} ${b.y}` : `${a.name} ${a.y} – ${b.name} ${b.y}`;
}

export function renderMonth(root, anchor, opts = {}) {
  if (isNarrowWeek()) { narrowMonth(root, anchor, opts); return; }
  const { onDayOpen } = opts;
  const ms = startOfMonth(anchor);
  const gs = startOfWeek(ms);
  const ge = addDays(gs, 42);
  const items = occurrencesInRange(gs, ge, { includeCourses: state.settings.showCoursesInMonth });
  // Yoğunluk: derslerle birlikte o günün dolu saatleri
  const loadItems = state.settings.showCoursesInMonth ? items : occurrencesInRange(gs, ge);
  const loadOf = (d, dn) => loadItems.reduce((a, o) => (o.allDay || o.end <= d || o.start >= dn) ? a : a + (Math.min(o.end, dn) - Math.max(o.start, d)) / 60000, 0);
  const level = (min) => (min <= 0 ? 0 : min <= 120 ? 1 : min <= 240 ? 2 : min <= 360 ? 3 : 4);
  const today = new Date();
  const head = h('div', { class: 'mo-head' }, GUNLER_KISA.map((g) => h('div', {}, g)));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gs, i);
    const dn = addDays(d, 1);
    const dayItems = items.filter((o) => o.start < dn && o.end > d);
    const clash = markClashes(dayItems);
    const max = 3;
    const br = breakOn(d);
    const load = loadOf(d, dn);
    const holy = holyDay(d);
    const moon = moonPhaseOn(d);
    const hj = hijri(d);
    const hjFirst = hj && hj.d === 1 ? `1 ${hj.name}` : null;
    const cell = h('div', {
      class: `mo-cell ${d.getMonth() !== ms.getMonth() ? 'other' : ''} ${sameDay(d, today) ? 'today' : ''} ${br ? 'holiday' : ''} load-${level(load)}`,
      'data-date': toDateKey(d),
      title: load ? `${Math.round(load / 60 * 10) / 10} saat dolu` : '',
      onclick: (e) => { if (e.target === cell || e.target.classList.contains('mo-num')) openEventForm({ start: `${toDateKey(d)}T18:00` }); },
    },
    h('div', { class: 'mo-top' }, h('span', { class: 'mo-num' }, d.getDate()), moon ? moonGlyph(moon, 13) : null,
      br ? h('span', { class: 'mo-break', title: br.label }, br.label || 'Tatil') : null,
      holy ? h('span', { class: `mo-holy ${holy.kind}`, title: `${holy.name} (hicri takvime göre, ±1 gün)` }, holy.name)
        : hjFirst ? h('span', { class: 'mo-hj', title: `Hicri ay başı: ${hjFirst} ${hj.y}` }, hjFirst) : null),
    dayItems.slice(0, max).map((o) => h('button', {
      class: `mo-chip ${o.allDay && o.kind !== 'deadline' ? 'allday' : ''} ${o.kind} ${clash.has(o.id) ? 'clash' : ''} ${o.done ? 'done' : ''}`, style: { '--c': o.color },
      onclick: (e) => { e.stopPropagation(); openOcc(o); },
      title: o.title,
    }, o.allDay ? '' : h('span', { class: 'mo-time' }, `${timeStr(o.start)} `), chipText(o))),
    dayItems.length > max ? h('button', { class: 'mo-more', onclick: (e) => { e.stopPropagation(); onDayOpen?.(d, e); } }, `+${dayItems.length - max} daha`) : null);
    cells.push(cell);
  }
  const hr = hijriRange(ms);
  const bar = hr ? h('div', { class: 'mo-bar' },
    h('span', { class: 'mo-hijri', title: 'Hicri takvim (Ümmü\'l-Kurâ hesabı; Diyanet takvimiyle bir gün fark olabilir)' }, ic('moon', { size: 14 }), hr),
    h('span', { class: 'muted small mo-tip' }, 'Ctrl + tekerlek: yakınlaş/uzaklaş')) : null;
  const legend = h('div', { class: 'mo-legend' }, h('span', {}, 'Boş'),
    [0, 1, 2, 3, 4].map((l) => h('i', { class: `load-${l}`, title: ['boş', '2 saate kadar', '2–4 saat', '4–6 saat', '6 saatten fazla'][l] })), h('span', {}, 'Dolu'),
    h('span', { class: 'muted' }, '· günün rengi derslerle birlikte planlı saatleri gösterir'));
  root.replaceChildren(...[bar, h('div', { class: 'month' }, head, h('div', { class: 'mo-grid' }, cells)), legend].filter(Boolean));
}

// ---------------------------------------------------------------------------
// Telefonda ay: hücrelerde yazı yok, yalnız renkli noktalar. Bir güne dokununca o günün kayıtları
// ızgaranın altında listelenir (ekleme o günün listesinden yapılır, yanlış dokunuşta form açılmaz).
// ---------------------------------------------------------------------------
function agItem(o, clash) {
  return h('button', { class: `ag-item ${o.kind} ${clash ? 'clash' : ''} ${o.done ? 'done' : ''} ${o.absent ? 'absent' : ''}`, style: { '--c': o.color }, onclick: () => openOcc(o) },
    h('span', { class: 'ag-time' }, o.kind === 'deadline' ? `teslim ${timeStr(o.due)}` : o.allDay ? 'tüm gün' : `${timeStr(o.start)}–${timeStr(o.end)}`),
    h('span', { class: 'ag-title' }, ic(o.icon, { size: 15, cls: 'ag-ic' }), ` ${o.title}`, o.recurring ? ic('repeat', { size: 13, cls: 'ic-rep', label: 'tekrarlayan' }) : null),
    h('span', { class: 'muted small' }, [o.kind === 'event' ? category(o.categoryId).name : o.kind === 'deadline' ? (o.done ? 'Ödev · teslim edildi' : 'Ödev teslimi') : (o.absent ? 'Ders · gitmedin' : o.absentPart ? `Ders · ${o.absentPart} saat gitmedin` : 'Ders'), o.location].filter(Boolean).join(', ')),
    clash ? h('span', { class: 'pill warn' }, 'çakışma') : null);
}

function narrowMonth(root, anchor, opts) {
  const { onDayOpen } = opts;
  const ms = startOfMonth(anchor);
  const gs = startOfWeek(ms);
  const ge = addDays(gs, 42);
  const today = new Date();
  // Seçili gün bu ayda değilse: bugün bu aydaysa bugün, değilse ayın biri
  if (!moSel || parseKey(moSel).getMonth() !== ms.getMonth() || parseKey(moSel).getFullYear() !== ms.getFullYear()) {
    moSel = toDateKey(today.getMonth() === ms.getMonth() && today.getFullYear() === ms.getFullYear() ? today : ms);
  }
  const items = occurrencesInRange(gs, ge, { includeCourses: state.settings.showCoursesInMonth });
  const head = h('div', { class: 'mo-head' }, GUNLER_KISA.map((g) => h('div', {}, g)));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gs, i);
    const dn = addDays(d, 1);
    const key = toDateKey(d);
    const dayItems = items.filter((o) => o.start < dn && o.end > d);
    const br = breakOn(d);
    const holy = holyDay(d);
    const sel = key === moSel;
    cells.push(h('button', {
      type: 'button',
      class: `mo-cell nm ${d.getMonth() !== ms.getMonth() ? 'other' : ''} ${sameDay(d, today) ? 'today' : ''} ${br ? 'holiday' : ''} ${sel ? 'sel' : ''}`,
      'data-date': key, 'aria-pressed': String(sel),
      'aria-label': `${d.getDate()} ${AYLAR[d.getMonth()]}${dayItems.length ? `, ${dayItems.length} kayıt` : ''}${holy ? `, ${holy.name}` : ''}`,
      onclick: () => {
        if (d.getMonth() !== ms.getMonth() && opts.onMonth) { moSel = key; opts.onMonth(d); return; }
        moSel = key; narrowMonth(root, anchor, opts);
      },
    },
    h('span', { class: 'mo-num' }, d.getDate()),
    h('span', { class: 'mo-dots', 'aria-hidden': 'true' },
      dayItems.slice(0, 4).map((o) => h('i', { class: o.kind === 'deadline' ? 'ring' : '', style: { '--c': o.color } })),
      holy ? h('i', { class: `holy ${holy.kind}` }) : null)));
  }
  // Seçili günün listesi
  const sd = parseKey(moSel);
  const sdn = addDays(sd, 1);
  const L = occurrencesInRange(sd, sdn).filter((o) => o.start < sdn && o.end > sd);
  const clash = markClashes(L);
  const br = breakOn(sd), holy = holyDay(sd);
  const panel = h('section', { class: `mo-day ${sameDay(sd, today) ? 'today' : ''}` },
    h('div', { class: 'mo-day-h' },
      h('div', { class: 'mo-day-t' }, h('b', {}, `${sd.getDate()} ${AYLAR[sd.getMonth()]}`), h('span', {}, `${GUNLER[isoWeekday(sd) - 1]} · ${relativeDays(sd)}`)),
      h('div', { class: 'mo-day-a' },
        h('button', { class: 'btn small', onclick: (e) => { narrowFocus = sd; onDayOpen?.(sd, e); } }, 'Haftada gör'),
        h('button', { class: 'icon-btn mo-add', 'aria-label': 'Bu güne plan ekle', onclick: () => openEventForm({ start: `${moSel}T18:00` }) }, '+'))),
    (br || holy) ? h('div', { class: 'mo-day-tags' }, br ? h('span', { class: 'mo-break' }, br.label || 'Tatil') : null, holy ? h('span', { class: `mo-holy ${holy.kind}` }, holy.name) : null) : null,
    L.length ? h('ul', { class: 'ag-list' }, L.map((o) => h('li', {}, agItem(o, clash.has(o.id)))))
      : h('p', { class: 'muted mo-day-empty' }, 'Bu gün boş.'));
  const hr = hijriRange(ms);
  root.replaceChildren(...[
    hr ? h('div', { class: 'mo-bar' }, h('span', { class: 'mo-hijri' }, ic('moon', { size: 14 }), hr)) : null,
    h('div', { class: 'month narrow' }, head, h('div', { class: 'mo-grid' }, cells)),
    panel,
  ].filter(Boolean));
}

const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

// ---------------------------------------------------------------------------
// AJANDA
// ---------------------------------------------------------------------------
export function renderAgenda(root, anchor) {
  const from = startOfDay(anchor);
  const to = addDays(from, 30);
  const items = occurrencesInRange(from, to, { includeCourses: state.settings.showCoursesInMonth });
  const byDay = new Map();
  for (const o of items) {
    for (let d = startOfDay(o.start < from ? from : o.start); d < o.end && d < to; d = addDays(d, 1)) {
      const k = toDateKey(d);
      if (!byDay.has(k)) byDay.set(k, { d, list: [] });
      byDay.get(k).list.push(o);
    }
  }
  if (!byDay.size) {
    root.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'Önümüzdeki 30 günde plan yok.'), h('button', { class: 'btn primary', onclick: () => openEventForm({}) }, 'Plan ekle')));
    return;
  }
  const list = h('div', { class: 'agenda' }, [...byDay.values()].map(({ d, list: L }) => {
    const clash = markClashes(L);
    return h('section', { class: `ag-day ${sameDay(d, new Date()) ? 'today' : ''}`, 'data-date': toDateKey(d) },
      h('div', { class: 'ag-date' }, h('span', { class: 'ag-num' }, d.getDate()), h('span', {}, `${AYLAR[d.getMonth()]}, ${GUNLER[isoWeekday(d) - 1]}`), h('span', { class: 'muted small' }, relativeDays(d))),
      h('ul', { class: 'ag-list' }, L.map((o) => h('li', {}, agItem(o, clash.has(o.id))))));
  }));
  root.replaceChildren(list);
}

export { fmtDateLong, HICRI_AYLAR };
