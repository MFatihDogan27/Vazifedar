// Namaz vakitleri: Diyanet yöntemiyle cihazda hesaplanır (internet gerekmez).
// İmsak 18°, Yatsı 17°, İkindi gölge = 1 boy (asr-ı evvel); Diyanet temkinleri:
// Güneş −7 dk, Öğle +5 dk, İkindi +4 dk, Akşam +7 dk. Sonuçlar dakikaya yuvarlanır.
import { state } from './store.js';
import { toDateKey, addDays, startOfDay } from './dates.js';

export const VAKITLER = [
  { id: 'imsak', name: 'İmsak', dative: 'İmsak\'a' },
  { id: 'gunes', name: 'Güneş', dative: 'Güneş\'e' },
  { id: 'ogle', name: 'Öğle', dative: 'Öğle\'ye' },
  { id: 'ikindi', name: 'İkindi', dative: 'İkindi\'ye' },
  { id: 'aksam', name: 'Akşam', dative: 'Akşam\'a' },
  { id: 'yatsi', name: 'Yatsı', dative: 'Yatsı\'ya' },
];
export const vakitName = (id) => VAKITLER.find((v) => v.id === id)?.name || id;

// 81 il merkezi [ad, enlem, boylam]
export const ILLER = [
  ['Adana', 37.0, 35.3213], ['Adıyaman', 37.7648, 38.2786], ['Afyonkarahisar', 38.7507, 30.5567], ['Ağrı', 39.7191, 43.0503],
  ['Aksaray', 38.3687, 34.037], ['Amasya', 40.6499, 35.8353], ['Ankara', 39.9334, 32.8597], ['Antalya', 36.8969, 30.7133],
  ['Ardahan', 41.1105, 42.7022], ['Artvin', 41.1828, 41.8183], ['Aydın', 37.856, 27.8416], ['Balıkesir', 39.6484, 27.8826],
  ['Bartın', 41.6344, 32.3375], ['Batman', 37.8812, 41.1351], ['Bayburt', 40.2552, 40.2249], ['Bilecik', 40.1451, 29.9799],
  ['Bingöl', 38.8847, 40.4939], ['Bitlis', 38.4006, 42.1095], ['Bolu', 40.7392, 31.6089], ['Burdur', 37.7203, 30.2908],
  ['Bursa', 40.1885, 29.061], ['Çanakkale', 40.1553, 26.4142], ['Çankırı', 40.6013, 33.6134], ['Çorum', 40.5506, 34.9556],
  ['Denizli', 37.7765, 29.0864], ['Diyarbakır', 37.9144, 40.2306], ['Düzce', 40.8438, 31.1565], ['Edirne', 41.6818, 26.5623],
  ['Elazığ', 38.6748, 39.2225], ['Erzincan', 39.75, 39.5], ['Erzurum', 39.9055, 41.2658], ['Eskişehir', 39.7767, 30.5206],
  ['Gaziantep', 37.0662, 37.3833], ['Giresun', 40.9128, 38.3895], ['Gümüşhane', 40.4386, 39.5086], ['Hakkari', 37.5744, 43.7408],
  ['Hatay', 36.2021, 36.1603], ['Iğdır', 39.9237, 44.045], ['Isparta', 37.7648, 30.5566], ['İstanbul', 41.0082, 28.9784],
  ['İzmir', 38.4237, 27.1428], ['Kahramanmaraş', 37.5858, 36.9371], ['Karabük', 41.2061, 32.6204], ['Karaman', 37.1759, 33.2287],
  ['Kars', 40.6013, 43.0975], ['Kastamonu', 41.3887, 33.7827], ['Kayseri', 38.7312, 35.4787], ['Kırıkkale', 39.8468, 33.5153],
  ['Kırklareli', 41.7333, 27.2167], ['Kırşehir', 39.1425, 34.1709], ['Kilis', 36.7184, 37.1212], ['Kocaeli', 40.7654, 29.9408],
  ['Konya', 37.8746, 32.4932], ['Kütahya', 39.4167, 29.9833], ['Malatya', 38.3552, 38.3095], ['Manisa', 38.6191, 27.4289],
  ['Mardin', 37.3212, 40.7245], ['Mersin', 36.8121, 34.6415], ['Muğla', 37.2153, 28.3636], ['Muş', 38.9462, 41.7539],
  ['Nevşehir', 38.6939, 34.6857], ['Niğde', 37.9667, 34.6833], ['Ordu', 40.9839, 37.8764], ['Osmaniye', 37.0742, 36.2478],
  ['Rize', 41.0201, 40.5234], ['Sakarya', 40.7569, 30.3783], ['Samsun', 41.2928, 36.3313], ['Siirt', 37.9333, 41.95],
  ['Sinop', 42.0231, 35.1531], ['Sivas', 39.7477, 37.0179], ['Şanlıurfa', 37.1591, 38.7969], ['Şırnak', 37.4187, 42.4918],
  ['Tekirdağ', 40.9781, 27.511], ['Tokat', 40.3167, 36.55], ['Trabzon', 41.0015, 39.7178], ['Tunceli', 39.1079, 39.5401],
  ['Uşak', 38.6823, 29.4082], ['Van', 38.4891, 43.4089], ['Yalova', 40.65, 29.2667], ['Yozgat', 39.8181, 34.8147],
  ['Zonguldak', 41.4564, 31.7987],
];

// ---- Güneş konumu (PrayTimes.org / ABD Deniz Rasathanesi yaklaşık formülleri) ----
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(rad(d));
const cos = (d) => Math.cos(rad(d));
const tan = (d) => Math.tan(rad(d));
const asin = (x) => deg(Math.asin(x));
const acos = (x) => deg(Math.acos(Math.max(-1, Math.min(1, x))));
const atan2 = (y, x) => deg(Math.atan2(y, x));
const acot = (x) => deg(Math.atan(1 / x));
const fix = (a, b) => { const r = a - b * Math.floor(a / b); return r < 0 ? r + b : r; };

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
  return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - RA };
}

// Saatler (yerel güneş saati, kesirli) — sonra UT'ye çevrilir
function rawTimes(y, m, d, lat, lng) {
  const jd = julian(y, m, d) - lng / (15 * 24);
  const midDay = (t) => fix(12 - sunPosition(jd + t).eqt, 24);
  const angleTime = (angle, t, ccw) => {
    const { decl } = sunPosition(jd + t);
    const x = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return midDay(t) + (ccw ? -x : x);
  };
  const asr = (factor, t) => {
    const { decl } = sunPosition(jd + t);
    return angleTime(-acot(factor + tan(Math.abs(lat - decl))), t);
  };
  let t = { imsak: 5, gunes: 6, ogle: 12, ikindi: 13, aksam: 18, yatsi: 18 };
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / 24]));
    t = {
      imsak: angleTime(18, p.imsak, true),
      gunes: angleTime(0.833, p.gunes, true),
      ogle: midDay(p.ogle),
      ikindi: asr(1, p.ikindi),
      aksam: angleTime(0.833, p.aksam),
      yatsi: angleTime(17, p.yatsi),
    };
  }
  return t;
}

const TEMKIN = { imsak: 0, gunes: -7, ogle: 5, ikindi: 4, aksam: 7, yatsi: 0 };

// Belirli bir yer ve gün için vakitler: { imsak: Date, gunes: Date, ... }
export function computeTimes(date, lat, lng, offsets = {}) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const raw = rawTimes(y, m, d, lat, lng);
  const base = Date.UTC(y, m - 1, d);
  // Türkiye saati sabit UTC+3; tarayıcı başka saat diliminde olsa da gösterim yerel saate çevrilir
  const out = {};
  for (const v of VAKITLER) {
    const utMin = (raw[v.id] - lng / 15) * 60 + TEMKIN[v.id] + (Number(offsets[v.id]) || 0);
    out[v.id] = new Date(base + Math.round(utMin) * 60000);
  }
  return out;
}

// ---- Uygulama ayarlarıyla ----
export function prayerSettings() { return state.settings.prayer || {}; }
export function prayerEnabled() { return !!prayerSettings().enabled; }

const cache = new Map();
export function timesFor(date) {
  const p = prayerSettings();
  const key = `${toDateKey(date)}|${p.lat}|${p.lng}|${JSON.stringify(p.offsets || {})}`;
  if (!cache.has(key)) {
    if (cache.size > 120) cache.clear();
    cache.set(key, computeTimes(date, Number(p.lat), Number(p.lng), p.offsets));
  }
  return cache.get(key);
}

// [{ id, name, at: Date }] — bir aralıktaki tüm vakitler
export function prayersInRange(from, to) {
  const out = [];
  for (let d = startOfDay(addDays(from, -1)); d < to; d = addDays(d, 1)) {
    const t = timesFor(d);
    for (const v of VAKITLER) if (t[v.id] >= from && t[v.id] < to) out.push({ ...v, at: t[v.id] });
  }
  return out;
}

// Şu anki vakit ve sıradaki vakit
export function prayerNow(now = new Date()) {
  const list = prayersInRange(addDays(startOfDay(now), -1), addDays(startOfDay(now), 2));
  const i = list.findIndex((x) => x.at > now);
  return { current: list[i - 1] || null, next: list[i] || null };
}

export function locationLabel() {
  const p = prayerSettings();
  return p.city || `${Number(p.lat).toFixed(2)}°, ${Number(p.lng).toFixed(2)}°`;
}
