// Tekrarlayan planlar: kural açılımı, açıklama metni ve Google için RRULE.
import {
  parseLocal, toDateKey, addDays, startOfDay, isoWeekday, startOfWeek, daysBetween,
  GUNLER, AYLAR, fmtDateShort,
} from './dates.js';

export const SIKLIK = [
  ['', 'Tekrarlanmaz'], ['daily', 'Her gün'], ['weekly', 'Her hafta'], ['monthly', 'Her ay'], ['yearly', 'Her yıl'],
];

const GUN_TR_COK = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'];
const RR_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export function isRecurring(ev) { return !!ev?.recur?.freq; }

function interval(r) { return Math.max(1, Number(r.interval) || 1); }
function byDays(r, s0) {
  return r.freq === 'weekly' && r.byDay?.length ? r.byDay.map(Number) : [isoWeekday(s0)];
}

function matches(r, s0, d) {
  const n = interval(r);
  switch (r.freq) {
    case 'daily': return daysBetween(s0, d) % n === 0;
    case 'weekly':
      return byDays(r, s0).includes(isoWeekday(d))
        && Math.round(daysBetween(startOfWeek(s0), startOfWeek(d)) / 7) % n === 0;
    case 'monthly': {
      const m = (d.getFullYear() - s0.getFullYear()) * 12 + d.getMonth() - s0.getMonth();
      return d.getDate() === s0.getDate() && m % n === 0;
    }
    case 'yearly':
      return d.getMonth() === s0.getMonth() && d.getDate() === s0.getDate() && (d.getFullYear() - s0.getFullYear()) % n === 0;
    default: return false;
  }
}

// [from, to) aralığına düşen tekrarları döndürür: [{ start, end, dateKey }]
export function expand(ev, from, to) {
  const r = ev.recur;
  const s0 = parseLocal(ev.start), e0 = parseLocal(ev.end);
  const dur = e0 - s0;
  const out = [];
  const untilEnd = r.until ? addDays(parseLocal(r.until), 1) : null;
  const ex = new Set(ev.exdates || []);
  let d = startOfDay(new Date(Math.max(s0.getTime(), from.getTime() - dur - 86400000)));
  if (d < startOfDay(s0)) d = startOfDay(s0);
  for (let guard = 0; d < to && guard < 5000; d = addDays(d, 1), guard++) {
    if (untilEnd && d >= untilEnd) break;
    if (!matches(r, s0, d)) continue;
    const k = toDateKey(d);
    if (ex.has(k)) continue;
    const st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), s0.getHours(), s0.getMinutes());
    const en = new Date(st.getTime() + dur);
    if (en > from && st < to) out.push({ start: st, end: en, dateKey: k });
  }
  return out;
}

// Haftalık kuralda başlangıç günü seçili günlerden biri değilse ilk uygun güne kaydır
export function alignStart(startStr, r) {
  if (r?.freq !== 'weekly' || !r.byDay?.length) return startStr;
  let d = parseLocal(startStr);
  for (let i = 0; i < 7 && !r.byDay.map(Number).includes(isoWeekday(d)); i++) d = addDays(d, 1);
  return `${toDateKey(d)}T${startStr.split('T')[1] || '00:00'}`;
}

export function describe(r, startStr) {
  if (!r?.freq) return '';
  const s0 = parseLocal(startStr);
  const n = interval(r);
  let t;
  if (r.freq === 'daily') t = n === 1 ? 'Her gün' : `${n} günde bir`;
  else if (r.freq === 'weekly') {
    const days = byDays(r, s0).slice().sort((a, b) => a - b).map((x) => GUN_TR_COK[x - 1]);
    const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} ve ${days[days.length - 1]}` : days[0];
    t = n === 1 ? `Her ${list}` : `${n} haftada bir ${list}`;
  } else if (r.freq === 'monthly') t = n === 1 ? `Her ay ${s0.getDate()}'inde` : `${n} ayda bir, ${s0.getDate()}'inde`;
  else t = `Her yıl ${s0.getDate()} ${AYLAR[s0.getMonth()]}`;
  if (r.until) t += `, ${fmtDateShort(parseLocal(r.until))} tarihine kadar`;
  return t;
}

function utcStamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

// Google Takvim için RRULE + EXDATE satırları
export function toRecurrence(ev, tz) {
  const r = ev.recur;
  let rule = `RRULE:FREQ=${r.freq.toUpperCase()}`;
  if (interval(r) > 1) rule += `;INTERVAL=${interval(r)}`;
  if (r.freq === 'weekly') rule += `;BYDAY=${byDays(r, parseLocal(ev.start)).map((x) => RR_DAYS[x - 1]).join(',')}`;
  if (r.until) {
    rule += ev.allDay
      ? `;UNTIL=${r.until.replace(/-/g, '')}`
      : `;UNTIL=${utcStamp(new Date(parseLocal(`${r.until}T23:59`).getTime() + 59000))}`;
  }
  const out = [rule];
  const ex = ev.exdates || [];
  if (ex.length) {
    if (ev.allDay) out.push(`EXDATE;VALUE=DATE:${ex.map((k) => k.replace(/-/g, '')).join(',')}`);
    else {
      const hm = ev.start.split('T')[1].replace(':', '');
      out.push(`EXDATE;TZID=${tz}:${ex.map((k) => `${k.replace(/-/g, '')}T${hm}00`).join(',')}`);
    }
  }
  return out;
}

export { GUNLER };
