// Hatırlatmalar: sayfa açıkken tarayıcı bildirimi (izin yoksa uygulama içi uyarı).
import { state, occurrencesInRange, dueDate } from './store.js';
import { timeStr, relativeDays, addDays, toLocalISO } from './dates.js';
import { toast } from './ui.js';
import { showSystemNotification } from './pwa.js';
import { prayersInRange, prayerSettings, prayerEnabled, locationLabel } from './prayer.js';
import { dayGroups, pinsForOcc } from './notes.js';
import { startOfDay, toDateKey, hmToMin } from './dates.js';

const KEY = 'vazifedar:notified';

function loadSent() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
}
function saveSent(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set].slice(-300))); } catch { /* yok say */ }
}

export function notificationsSupported() { return 'Notification' in window; }
export function permission() { return notificationsSupported() ? Notification.permission : 'unsupported'; }
export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

function show(title, body) {
  const inApp = () => toast(`Hatırlatma: ${title} — ${body}`, { ms: 10000 });
  if (permission() !== 'granted') { inApp(); return; }
  // Service worker üstünden (Android'de tek yol), olmazsa doğrudan; ikisi de olmazsa uygulama içi
  showSystemNotification(title, body, title + body).then((ok) => { if (!ok) inApp(); });
}

export function checkReminders(now = new Date()) {
  const sent = loadSent();
  let changed = false;
  const fire = (key, title, body) => {
    if (sent.has(key)) return;
    sent.add(key); changed = true;
    show(title, body);
  };
  // Planlar (tekrarlayanların her tekrarı dahil)
  for (const o of occurrencesInRange(addDays(now, -1), addDays(now, 8), { includeCourses: false, includeDeadlines: false })) {
    const ev = o.ref;
    if (ev.reminderMin === null || ev.reminderMin === undefined) continue;
    const fireAt = new Date(o.start.getTime() - ev.reminderMin * 60000);
    if (now < fireAt || now > new Date(o.start.getTime() + 5 * 60000)) continue;
    const when = o.allDay ? relativeDays(o.start, now) : `${relativeDays(o.start, now)} ${timeStr(o.start)}`;
    fire(`${ev.id}|${toLocalISO(o.start)}|${ev.reminderMin}`, ev.title, `${when}${ev.location ? ` · ${ev.location}` : ''}`);
  }
  // Ödev teslimleri: 1 gün ve 3 saat önce
  for (const t of state.tasks) {
    if (!t.courseId || !t.due || t.done) continue;
    const due = dueDate(t);
    for (const [min, label] of [[180, '3 saat içinde'], [1440, '24 saat içinde']]) {
      const at = new Date(due.getTime() - min * 60000);
      if (now < at || now > due) continue;
      const c = state.courses.find((x) => x.id === t.courseId);
      fire(`hw|${t.id}|${t.due}T${t.dueTime}|${min}`, `Teslim ${label}: ${c?.code || c?.name || ''} ${t.title}`, `${relativeDays(due, now)} ${timeStr(due)}`);
      break;
    }
  }
  // Namaz vakitleri
  const p = prayerSettings();
  if (prayerEnabled() && p.notifyMin !== null && p.notifyMin !== undefined && p.notifyMin !== '') {
    const before = Number(p.notifyMin) || 0;
    for (const x of prayersInRange(addDays(now, -1), addDays(now, 1))) {
      if (!(p.notifyIds || []).includes(x.id)) continue;
      const at = new Date(x.at.getTime() - before * 60000);
      if (now < at || now > new Date(x.at.getTime() + 5 * 60000)) continue;
      const sun = x.id === 'gunes';
      const title = before
        ? (sun ? `Güneşin doğmasına ${before} dk` : `${x.name} vaktine ${before} dk`)
        : (sun ? 'Güneş doğuyor' : `${x.name} vakti girdi`);
      const body = sun ? `${timeStr(x.at)} · sabah namazının vakti çıkıyor` : `${timeStr(x.at)} · ${locationLabel()}`;
      fire(`namaz|${toLocalISO(x.at)}|${before}`, title, body);
    }
  }
  // Unutma notları: akşam yarının çantası, bir de dersten/plandan önce
  const pins = state.settings.pins || {};
  if (pins.notify !== false && state.notes.length) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (pins.notifyAt && nowMin >= hmToMin(pins.notifyAt)) {
      const tomorrow = addDays(startOfDay(now), 1);
      const dg = dayGroups(tomorrow, now);
      const parts = [
        ...dg.groups.map((g) => ({ g, open: g.items.filter((x) => !x.checked) })).filter((x) => x.open.length)
          .map(({ g, open }) => `${g.o.allDay ? '' : `${timeStr(g.o.start)} `}${g.o.kind === 'course' ? (g.o.ref.code || g.o.ref.name) : g.o.title}: ${open.map((x) => x.n.text).join(', ')}`),
        ...(dg.date.some((x) => !x.checked) ? [dg.date.filter((x) => !x.checked).map((x) => x.n.text).join(', ')] : []),
      ];
      if (parts.length) fire(`bag|${toDateKey(tomorrow)}`, 'Yarının çantası', parts.join(' · '));
    }
    const before = pins.beforeMin;
    if (before !== null && before !== undefined && before !== '') {
      for (const o of occurrencesInRange(now, addDays(now, 1), { includeDeadlines: false })) {
        if (o.allDay) continue;
        const at = new Date(o.start.getTime() - Number(before) * 60000);
        if (now < at || now >= o.start) continue;
        const open = pinsForOcc(o, now).filter((x) => !x.checked);
        if (!open.length) continue;
        const name = o.kind === 'course' ? `${o.ref.code || o.ref.name}${o.sub && o.sub !== 'Teori' ? ` ${o.sub}` : ''}` : o.title;
        fire(`pin|${o.id}|${before}`, `Unutma: ${name} ${timeStr(o.start)}`, open.map((x) => x.n.text).join(', '));
      }
    }
  }
  if (changed) saveSent(sent);
}

export function startReminderLoop() {
  checkReminders();
  setInterval(checkReminders, 30000);
}
