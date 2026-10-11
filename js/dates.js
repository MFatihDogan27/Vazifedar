// Tarih yardımcıları. Uygulama tüm zamanları yerel saat olarak
// "YYYY-MM-DDTHH:mm" biçiminde saklar.

export const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const GUNLER_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz',
  'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const pad = (n) => String(n).padStart(2, '0');

export function toLocalISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function toDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseLocal(s) {
  // "YYYY-MM-DD" veya "YYYY-MM-DDTHH:mm"
  const [datePart, timePart = '00:00'] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}
export function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
export function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
export function addMinutes(d, n) {
  return new Date(d.getTime() + n * 60000);
}
// Pazartesi = 1 ... Pazar = 7
export function isoWeekday(d) {
  const w = d.getDay(); return w === 0 ? 7 : w;
}
export function startOfWeek(d) {
  const x = startOfDay(d); return addDays(x, 1 - isoWeekday(x));
}
export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function hmToMin(hm) {
  const [h, m] = hm.split(':').map(Number); return h * 60 + (m || 0);
}
export function minToHm(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
export function fmtDateLong(d) {
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}, ${GUNLER[isoWeekday(d) - 1]}`;
}
export function fmtDateShort(d) {
  return `${d.getDate()} ${AYLAR[d.getMonth()]}`;
}
export function fmtRange(start, end, allDay) {
  if (allDay) {
    if (sameDay(start, end)) return `${fmtDateShort(start)}, tüm gün`;
    return `${fmtDateShort(start)} – ${fmtDateShort(end)}, tüm gün`;
  }
  if (sameDay(start, end)) return `${fmtDateShort(start)}, ${timeStr(start)}–${timeStr(end)}`;
  return `${fmtDateShort(start)} ${timeStr(start)} – ${fmtDateShort(end)} ${timeStr(end)}`;
}
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}
export function relativeDays(target, now = new Date()) {
  const n = daysBetween(now, target);
  if (n === 0) return 'bugün';
  if (n === 1) return 'yarın';
  if (n === -1) return 'dün';
  if (n > 0) return `${n} gün sonra`;
  return `${-n} gün önce`;
}
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
export function durationText(min) {
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}
