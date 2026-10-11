// Hicri takvim, mübarek günler ve ay evreleri.
// Hicri tarih tarayıcının Ümmü'l-Kurâ takviminden gelir (internet gerekmez); Diyanet'in takvimiyle
// bir gün fark olabilir. Ay evreleri ortalama sinodik aya göre hesaplanır (yarım güne kadar sapabilir).
import { addDays, startOfDay } from './dates.js';

export const HICRI_AYLAR = ['Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir', 'Cemaziyelevvel', 'Cemaziyelahir',
  'Recep', 'Şaban', 'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce'];

let fmt = null;
const cache = new Map();
export function hijri(d) {
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (cache.has(key)) return cache.get(key);
  let out = null;
  try {
    fmt ||= new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const p = {};
    for (const x of fmt.formatToParts(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12))) p[x.type] = x.value;
    const m = parseInt(p.month, 10);
    if (m >= 1 && m <= 12) out = { d: parseInt(p.day, 10), m, y: parseInt(p.year, 10), name: HICRI_AYLAR[m - 1] };
  } catch { out = null; }
  cache.set(key, out);
  return out;
}

// Mübarek gün ve geceler. Kandiller, hicri günün başladığı akşamdır: miladi takvimde bir önceki gün.
export function holyDay(d) {
  const t = hijri(d), n = hijri(addDays(d, 1));
  if (!t || !n) return null;
  const is = (x, day, month) => x.d === day && x.m === month;
  if (is(n, 12, 3)) return { name: 'Mevlid Kandili', kind: 'kandil' };
  if (n.m === 7 && n.d <= 7 && addDays(d, 1).getDay() === 5) return { name: 'Regaib Kandili', kind: 'kandil' };
  if (is(n, 27, 7)) return { name: 'Miraç Kandili', kind: 'kandil' };
  if (is(n, 15, 8)) return { name: 'Berat Kandili', kind: 'kandil' };
  if (is(n, 27, 9)) return { name: 'Kadir Gecesi', kind: 'kandil' };
  if (is(t, 1, 9)) return { name: 'Ramazan başı', kind: 'gun' };
  if (is(n, 1, 10)) return { name: 'Ramazan Bayramı arifesi', kind: 'arife' };
  if (t.m === 10 && t.d <= 3) return { name: `Ramazan Bayramı ${t.d}. gün`, kind: 'bayram' };
  if (is(t, 9, 12)) return { name: 'Kurban Bayramı arifesi', kind: 'arife' };
  if (t.m === 12 && t.d >= 10 && t.d <= 13) return { name: `Kurban Bayramı ${t.d - 9}. gün`, kind: 'bayram' };
  if (is(t, 1, 1)) return { name: 'Hicri yılbaşı', kind: 'gun' };
  if (is(t, 10, 1)) return { name: 'Aşure günü', kind: 'gun' };
  return null;
}

// Ay evresi: 0 yeni ay, .25 ilk dördün, .5 dolunay, .75 son dördün
const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14) / 86400000; // 6 Ocak 2000 yeni ayı
export const moonAge = (date) => {
  const x = ((date.getTime() / 86400000 - NEW_MOON_REF) / SYNODIC) % 1;
  return x < 0 ? x + 1 : x;
};
const PHASES = [
  { at: 0, id: 'yeni', name: 'Yeni ay' },
  { at: 0.25, id: 'ilk', name: 'İlk dördün' },
  { at: 0.5, id: 'dolun', name: 'Dolunay' },
  { at: 0.75, id: 'son', name: 'Son dördün' },
];
// O gün içinde dört ana evreden birine geçiliyorsa onu döndürür
export function moonPhaseOn(d) {
  const a = moonAge(startOfDay(d)), b = moonAge(addDays(startOfDay(d), 1));
  for (const p of PHASES) {
    if (p.at === 0 ? b < a : a < p.at && b >= p.at) return p;
  }
  return null;
}

// Küçük ay simgesi (kuzey yarımküre görünüşü)
export function moonGlyph(phase, size = 14) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 20 20'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('class', `moon moon-${phase.id}`); s.setAttribute('role', 'img'); s.setAttribute('aria-label', phase.name);
  const lit = {
    yeni: '',
    ilk: '<path d="M10 2.5a7.5 7.5 0 0 1 0 15z" class="moon-lit"/>',
    dolun: '<circle cx="10" cy="10" r="7.5" class="moon-lit"/>',
    son: '<path d="M10 2.5a7.5 7.5 0 0 0 0 15z" class="moon-lit"/>',
  }[phase.id];
  s.innerHTML = `<circle cx="10" cy="10" r="7.5" class="moon-disc"/>${lit}<title>${phase.name} (yaklaşık)</title>`;
  return s;
}
