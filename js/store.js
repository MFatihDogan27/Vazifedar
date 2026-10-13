// Uygulama durumu, kalıcılık (localStorage) ve sorgular.
import {
  parseLocal, toLocalISO, toDateKey, addDays, startOfDay, isoWeekday,
  hmToMin, overlaps, addMinutes, timeStr,
} from './dates.js';
import { expand, isRecurring } from './recurrence.js';
import { iconKey } from './icons.js';

const KEY = 'vazifedar:v1';

export const PALET = ['#2B47B9', '#0E8C8A', '#E8553A', '#3FA34D', '#F2B33D', '#7A4C8F',
  '#4C7BE0', '#C8622A', '#0B6E5C', '#B0569E', '#6B7088', '#C2366A'];

export const ONCELIKLER = [
  { id: 'acil', name: 'Acil', color: '#E8553A', hint: 'Hemen ilgilen' },
  { id: 'yuksek', name: 'Yüksek', color: '#F2B33D', hint: 'Bu hafta' },
  { id: 'orta', name: 'Orta', color: '#0E8C8A', hint: 'Yakında' },
  { id: 'dusuk', name: 'Düşük', color: '#9095A8', hint: 'Bir ara' },
];

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}
export { uid };

function defaultState() {
  return {
    version: 1,
    events: [],
    courses: [],
    term: { start: '', end: '', breaks: [] },
    tasks: [],
    notes: [],      // derse / plana / güne bağlı "unutma" notları
    journal: {},    // 'YYYY-MM-DD' → { text, updatedAt } — defter
    archive: {},    // 'YYYY-MM-DD' → { segs, allDay } — kadran arşivi (gün bitince donar)
    categories: [
      { id: 'sinav', name: 'Sınav', color: '#E8553A', icon: 'exam', duration: 120, reminder: 1440 },
      { id: 'konser', name: 'Konser', color: '#7A4C8F', icon: 'music', duration: 180, reminder: 120 },
      { id: 'halisaha', name: 'Halısaha', color: '#3FA34D', icon: 'ball', duration: 60, reminder: 60 },
      { id: 'arkadas', name: 'Arkadaşlar', color: '#F2B33D', icon: 'cup', duration: 120, reminder: 30 },
      { id: 'roket', name: 'Roket takımı', color: '#2B47B9', icon: 'rocket', duration: 120, reminder: 30 },
      { id: 'gorev', name: 'Görev zamanı', color: '#0E8C8A', icon: 'check', duration: 60, reminder: 10 },
      { id: 'diger', name: 'Diğer', color: '#6B7088', icon: 'pin', duration: 60, reminder: 30 },
    ],
    taskCategories: [
      { id: 'ders', name: 'Ders', color: '#2B47B9' },
      { id: 'roket', name: 'Roket takımı', color: '#4C7BE0' },
      { id: 'kisisel', name: 'Kişisel', color: '#3FA34D' },
      { id: 'isler', name: 'İşler', color: '#C8622A' },
    ],
    settings: {
      googleClientId: '',
      googleCalendarId: 'primary',
      googleCalendarName: '',
      googleConnected: false,
      tasksToGoogle: 'odev', // ödev teslimleri Google Takvim'e: odev | hepsi | kapali
      autoSyncMin: 10,
      lastSync: null,
      dayStartHour: 7,
      dayEndHour: 24,
      defaultReminder: 30,
      showCoursesInMonth: false,
      theme: 'auto',
      palette: 'firuze',
      kadran: true,
      accent: '',
      pattern: 'soft',
      freeSlotStart: '09:00',
      freeSlotEnd: '22:00',
      prayer: {
        enabled: true, city: 'Ankara', lat: 39.9334, lng: 32.8597,
        onDial: true, inWeek: true,
        notifyMin: null, notifyIds: ['imsak', 'ogle', 'ikindi', 'aksam', 'yatsi'],
        offsets: {},
      },
      pins: {
        showFrom: '18:00',  // Bugün ekranında bu saatten sonra yarının çantası
        notify: true,
        notifyAt: '21:00',  // akşam çanta bildirimi
        beforeMin: 60,      // dersten/plandan önce hatırlat (null: kapalı)
      },
    },
  };
}

function migrate(s) {
  const d = defaultState();
  const out = { ...d, ...s };
  out.settings = { ...d.settings, ...(s.settings || {}) };
  out.settings.prayer = { ...d.settings.prayer, ...(s.settings?.prayer || {}) };
  out.settings.prayer.offsets = { ...(out.settings.prayer.offsets || {}) };
  out.settings.pins = { ...d.settings.pins, ...(s.settings?.pins || {}) };
  out.notes = Array.isArray(out.notes) ? out.notes : [];
  for (const n of out.notes) { n.checks = n.checks || {}; n.target = n.target || { type: 'date', date: '' }; }
  out.journal = out.journal && typeof out.journal === 'object' ? out.journal : {};
  out.archive = out.archive && typeof out.archive === 'object' ? out.archive : {};
  out.term = { ...d.term, ...(s.term || {}) };
  out.term.breaks = out.term.breaks || [];
  for (const c of out.courses) {
    c.sessions = c.sessions || []; c.skips = c.skips || []; c.absences = c.absences || [];
    if (c.absenceUnit === undefined) c.absenceUnit = 'saat';
    if (c.absenceLimit === undefined) c.absenceLimit = '';
  }
  for (const c of out.categories) c.icon = iconKey(c.icon);
  for (const t of out.tasks) { if (t.courseId === undefined) t.courseId = ''; if (t.dueTime === undefined) t.dueTime = ''; }
  // Kadran görünümüne geçiş: eski varsayılan renkleri yeni paletle değiştir (bir kez)
  if (!s.settings?.kadran) {
    const map = {
      '#1d4e9e': '#2B47B9', '#1f9aa0': '#0E8C8A', '#c8372d': '#E8553A', '#3e8e5b': '#3FA34D', '#d9a21b': '#F2B33D',
      '#6b3e75': '#7A4C8F', '#2f6fd6': '#4C7BE0', '#b5562e': '#C8622A', '#0e7c66': '#0B6E5C', '#8a5a9e': '#B0569E',
      '#5b6b82': '#6B7088', '#a23b72': '#C2366A',
    };
    const fix = (o) => { const n = map[String(o.color || '').toLowerCase()]; if (n) o.color = n; };
    out.categories.forEach(fix); out.taskCategories.forEach(fix); out.courses.forEach(fix);
    const roket = out.categories.find((c) => c.id === 'roket'); if (roket && roket.color === '#4C7BE0') roket.color = '#2B47B9';
    out.settings.palette = { kobalt: 'firuze', lale: 'mercan', zumrut: 'firuze', gece: 'murekkep' }[out.settings.palette] || out.settings.palette;
    out.settings.kadran = true;
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('Kayıt okunamadı', e); }
  return defaultState();
}

export const state = load();
const listeners = new Set();
let saveTimer = null;

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function commit(reason = 'change', opts = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 150);
  for (const fn of listeners) fn(reason, opts);
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
}
export function replaceState(next) {
  const m = migrate(next);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, m);
  commit('import');
}
export function resetState() { replaceState(defaultState()); }

// ---------- Kategoriler ----------
export function category(id) {
  return state.categories.find((c) => c.id === id) || state.categories.find((c) => c.id === 'diger') || state.categories[0];
}
export function taskCategory(id) {
  return state.taskCategories.find((c) => c.id === id) || { id: '', name: 'Kategorisiz', color: '#9095A8' };
}
export function priority(id) {
  return ONCELIKLER.find((p) => p.id === id) || ONCELIKLER[2];
}

// ---------- Etkinlikler ----------
export function visibleEvents() { return state.events.filter((e) => !e.deleted); }

export function upsertEvent(data) {
  const now = new Date().toISOString();
  let ev = state.events.find((e) => e.id === data.id);
  if (ev) {
    Object.assign(ev, data, { updatedAt: now, dirty: !!(data.syncToGoogle ?? ev.syncToGoogle) });
  } else {
    ev = {
      id: uid(), title: '', categoryId: 'diger', start: '', end: '', allDay: false,
      location: '', notes: '', reminderMin: state.settings.defaultReminder,
      googleId: null, googleUpdated: null, syncToGoogle: false, source: 'local',
      createdAt: now, ...data,
    };
    ev.id = data.id || uid();
    ev.updatedAt = now;
    ev.dirty = !!ev.syncToGoogle;
    state.events.push(ev);
  }
  commit('events', { pushGoogle: ev.dirty });
  return ev;
}

export function deleteEvent(id) {
  const ev = state.events.find((e) => e.id === id);
  if (!ev) return;
  if (ev.googleId && ev.syncToGoogle) {
    ev.deleted = true; ev.dirty = true; // Google'dan da silinecek
  } else {
    state.events.splice(state.events.indexOf(ev), 1);
  }
  for (const t of state.tasks) if (t.scheduledEventId === id) t.scheduledEventId = null;
  commit('events', { pushGoogle: !!ev.deleted });
}

// ---------- Ders programı ----------
export function inTerm(date) {
  const { start, end } = state.term;
  const k = toDateKey(date);
  if (start && k < start) return false;
  if (end && k > end) return false;
  return true;
}
export function breakOn(date) {
  const k = toDateKey(date);
  return state.term.breaks.find((b) => b.start <= k && k <= (b.end || b.start));
}

// Bir tarih aralığındaki tüm "görünür" kayıtlar (etkinlik + ders oturumu + ödev teslimi)
export function occurrencesInRange(from, to, { includeCourses = true, includeDeadlines = true } = {}) {
  const out = [];
  for (const ev of visibleEvents()) {
    const cat = category(ev.categoryId);
    const base = {
      kind: 'event', title: ev.title, allDay: !!ev.allDay, color: cat.color, icon: cat.icon,
      categoryId: ev.categoryId, location: ev.location, google: !!ev.googleId, ref: ev,
    };
    if (isRecurring(ev)) {
      for (const x of expand(ev, from, to)) {
        out.push({ ...base, id: `${ev.id}@${x.dateKey}`, start: x.start, end: x.end, occDate: x.dateKey, recurring: true });
      }
      continue;
    }
    const s = parseLocal(ev.start), e = parseLocal(ev.end);
    if (!overlaps(s, e, from, to)) continue;
    out.push({ ...base, id: ev.id, start: s, end: e });
  }
  if (includeCourses) {
    for (let d = startOfDay(from); d < to; d = addDays(d, 1)) {
      if (!inTerm(d) || breakOn(d)) continue;
      const wd = isoWeekday(d);
      const dk = toDateKey(d);
      for (const c of state.courses) {
        for (const s of c.sessions) {
          if (Number(s.day) !== wd || !s.start || !s.end) continue;
          if (c.skips.includes(`${s.id}|${dk}`)) continue;
          const st = addMinutes(d, hmToMin(s.start));
          const en = addMinutes(d, hmToMin(s.end));
          if (!overlaps(st, en, from, to)) continue;
          out.push({
            kind: 'course', id: `${c.id}:${s.id}:${dk}`, courseId: c.id, sessionId: s.id, dateKey: dk,
            title: c.code ? `${c.code} ${c.name}` : c.name, start: st, end: en, allDay: false,
            color: c.color || '#2B47B9', icon: 'cap', location: s.location, sub: s.type, ref: c,
            absent: c.absences.some((a) => a.s === s.id && a.d === dk),
          });
        }
      }
    }
  }
  if (includeDeadlines) {
    for (const t of state.tasks) {
      if (!t.courseId || !t.due) continue;
      const due = dueDate(t);
      const day = startOfDay(due);
      if (!overlaps(day, addDays(day, 1), from, to)) continue;
      const c = state.courses.find((x) => x.id === t.courseId);
      out.push({
        kind: 'deadline', id: `task:${t.id}`, taskId: t.id, title: `${c?.code || c?.name || ''} ${t.title}`.trim(),
        start: day, end: addMinutes(day, 24 * 60 - 1), due, allDay: true, done: t.done,
        color: c?.color || '#2B47B9', icon: 'book', location: '', ref: t,
      });
    }
  }
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  return out;
}

export function dueDate(t) {
  return parseLocal(`${t.due}T${t.dueTime || '23:59'}`);
}

// Çakışma kontrolü: yeni/düzenlenen bir zaman aralığıyla çakışanları döndürür.
export function findConflicts(startStr, endStr, { excludeEventId = null, allDay = false } = {}) {
  if (allDay) return [];
  const s = parseLocal(startStr), e = parseLocal(endStr);
  if (!(e > s)) return [];
  return occurrencesInRange(addDays(s, -1), addDays(e, 1))
    .filter((o) => !o.allDay && !(excludeEventId && o.ref?.id === excludeEventId) && overlaps(s, e, o.start, o.end));
}

// Tekrarlayan bir plan için önümüzdeki tekrarlardaki çakışmalar (her biri .on tarihiyle)
export function findConflictsFor(data, { excludeEventId = null, horizonDays = 120 } = {}) {
  if (data.allDay) return [];
  if (!isRecurring(data)) return findConflicts(data.start, data.end, { excludeEventId });
  const from = parseLocal(data.start);
  const insts = expand({ ...data, exdates: data.exdates || [] }, from, addDays(from, horizonDays));
  const out = [];
  for (const x of insts) {
    for (const c of findConflicts(toLocalISO(x.start), toLocalISO(x.end), { excludeEventId })) out.push({ ...c, on: x.start });
  }
  return out;
}
// Bir ders oturumunun diğer derslerle çakışması
export function courseSessionConflicts(courseId, session) {
  const out = [];
  if (!session.start || !session.end) return out;
  const a = hmToMin(session.start), b = hmToMin(session.end);
  for (const c of state.courses) {
    for (const s of c.sessions) {
      if (c.id === courseId && s.id === session.id) continue;
      if (Number(s.day) !== Number(session.day) || !s.start || !s.end) continue;
      if (a < hmToMin(s.end) && hmToMin(s.start) < b) out.push({ course: c, session: s });
    }
  }
  return out;
}

// Belirli süre için ilk boş zaman dilimini bulur
export function findFreeSlot(durationMin, after = new Date(), { days = 21 } = {}) {
  const dayStart = hmToMin(state.settings.freeSlotStart || '09:00');
  const dayEnd = hmToMin(state.settings.freeSlotEnd || '22:00');
  let cursor = new Date(after);
  // 15 dakikalık katlara yuvarla
  const r = cursor.getMinutes() % 15;
  if (r) cursor = addMinutes(cursor, 15 - r);
  cursor.setSeconds(0, 0);
  const limit = addDays(startOfDay(after), days);
  const busy = occurrencesInRange(startOfDay(after), limit).filter((o) => !o.allDay);
  while (cursor < limit) {
    const day = startOfDay(cursor);
    const minOfDay = cursor.getHours() * 60 + cursor.getMinutes();
    if (minOfDay < dayStart) { cursor = addMinutes(day, dayStart); continue; }
    if (minOfDay + durationMin > dayEnd) { cursor = addMinutes(addDays(day, 1), dayStart); continue; }
    const end = addMinutes(cursor, durationMin);
    const clash = busy.find((o) => overlaps(cursor, end, o.start, o.end));
    if (!clash) return { start: new Date(cursor), end };
    cursor = new Date(Math.max(clash.end.getTime(), cursor.getTime() + 15 * 60000));
    const rr = cursor.getMinutes() % 15;
    if (rr) cursor = addMinutes(cursor, 15 - rr);
  }
  return null;
}

// ---------- Görevler ----------
export function upsertTask(data) {
  let t = state.tasks.find((x) => x.id === data.id);
  if (t) Object.assign(t, data);
  else {
    t = {
      id: uid(), title: '', priority: 'orta', categoryId: '', due: '', estimateMin: 60,
      notes: '', done: false, doneAt: null, createdAt: new Date().toISOString(),
      scheduledEventId: null, courseId: '', dueTime: '', ...data,
    };
    t.id = data.id || uid();
    state.tasks.push(t);
  }
  commit('tasks');
  return t;
}
export function deleteTask(id) {
  const i = state.tasks.findIndex((t) => t.id === id);
  if (i >= 0) state.tasks.splice(i, 1);
  commit('tasks');
}

export { toLocalISO };

// ---------- Devamsızlık ----------
// Ders saati: 50 dk ders + 10 dk ara (ör. 09:30–11:20 = 2 saat)
export function sessionHours(session) {
  if (!session?.start || !session?.end) return 1;
  return Math.max(1, Math.round((hmToMin(session.end) - hmToMin(session.start) + 10) / 60));
}
export function absenceUsed(c) {
  return c.absenceUnit === 'oturum' ? c.absences.length : c.absences.reduce((a, x) => a + (x.h || 1), 0);
}
export function absenceInfo(c) {
  const used = absenceUsed(c);
  const limit = Number(c.absenceLimit) || 0;
  const unit = c.absenceUnit === 'oturum' ? 'ders' : 'saat';
  const ratio = limit ? used / limit : 0;
  return { used, limit, unit, ratio, left: limit ? limit - used : null, level: !limit ? '' : ratio >= 1 ? 'over' : ratio >= 0.75 ? 'warn' : 'ok' };
}
export function toggleAbsence(courseId, sessionId, dateKey) {
  const c = state.courses.find((x) => x.id === courseId);
  if (!c) return null;
  const i = c.absences.findIndex((a) => a.s === sessionId && a.d === dateKey);
  if (i >= 0) c.absences.splice(i, 1);
  else c.absences.push({ s: sessionId, d: dateKey, h: sessionHours(c.sessions.find((x) => x.id === sessionId)) });
  commit('courses');
  return i < 0;
}
// Dönemdeki toplam ders saatinin belli bir oranı (ör. %30) — öneri olarak
export function suggestAbsenceLimit(c, ratio = 0.3) {
  let weeks = 14;
  if (state.term.start && state.term.end) weeks = Math.max(1, Math.round((parseLocal(state.term.end) - parseLocal(state.term.start)) / (7 * 86400000)));
  const weekly = c.absenceUnit === 'oturum' ? c.sessions.length : c.sessions.reduce((a, x) => a + sessionHours(x), 0);
  return Math.floor(weekly * weeks * ratio);
}
export { timeStr };

// ---------- Tekrarlayan plan işlemleri ----------
function markDirty(ev) { if (ev.syncToGoogle) ev.dirty = true; ev.updatedAt = new Date().toISOString(); }
// Serideki tek bir tekrarı atla
export function skipOccurrence(eventId, dateKey) {
  const ev = state.events.find((e) => e.id === eventId);
  if (!ev) return;
  ev.exdates = [...new Set([...(ev.exdates || []), dateKey])];
  markDirty(ev);
  commit('events', { pushGoogle: ev.dirty });
}
// Seriyi bu tarihten önce bitir (bu ve sonrakileri sil)
export function endSeriesBefore(eventId, dateKey) {
  const ev = state.events.find((e) => e.id === eventId);
  if (!ev?.recur) return;
  const prev = toDateKey(addDays(parseLocal(dateKey), -1));
  if (prev < ev.start.slice(0, 10)) { deleteEvent(eventId); return; }
  ev.recur = { ...ev.recur, until: prev };
  markDirty(ev);
  commit('events', { pushGoogle: ev.dirty });
}
