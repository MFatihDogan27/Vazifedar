// Hızlı ekleme: "cuma 20:00 halısaha", "her salı 21-23 halısaha @Gölbaşı",
// "28 ekim 13:30 elektronik vize", "ELE 271 ödev 3 cuma teslim".
import { state, category } from './store.js';
import {
  addDays, startOfDay, startOfWeek, isoWeekday, toDateKey, toLocalISO, addMinutes, parseLocal,
} from './dates.js';

const lower = (s) => s.toLocaleLowerCase('tr');
const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
const SFX = "(?:'?\\p{L}{0,6})"; // Türkçe ekler: cumaya, salı'ya, 20'de, ekimde …
const GUNLER = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'];
const GUN_RE = '(pazartesi|salı|çarşamba|perşembe|cumartesi|cuma|pazar)';
const AYLAR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const AY_RE = `(${AYLAR.join('|')})`;
const SAYI = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5 };

const KATEGORI_IPUCU = [
  ['sinav', /sınav|vize|final|quiz|bütünleme|midterm/],
  ['konser', /konser|festival|sahne/],
  ['halisaha', /halı ?saha|futbol|maç(?![\p{L}])/u],
  ['roket', /roket|teknofest|aviyonik|avionik|ukb/],
  ['arkadas', /arkadaş|kahve|yemek|buluşma|sinema|parti|doğum günü partisi/],
];
const ODEV_RE = new RegExp(`${B}(ödev\\p{L}*|proje\\p{L}*|rapor\\p{L}*|föy\\p{L}*|teslim\\p{L}*|hw)${E}`, 'u');

function rx(src) { return new RegExp(src, 'giu'); }

export function parseQuick(input, now = new Date()) {
  const orig = input.trim();
  const t = lower(orig);
  const used = []; // [başlangıç, bitiş]
  const free = (a, b) => !used.some(([x, y]) => a < y && x < b);
  const take = (m) => { used.push([m.index, m.index + m[0].length]); };
  const first = (re, pred = () => true) => {
    for (const m of t.matchAll(re)) if (free(m.index, m.index + m[0].length) && pred(m)) return m;
    return null;
  };

  const r = { title: '', categoryId: null, date: null, time: null, endTime: null, durationMin: null, allDay: false, recur: null, location: '', courseId: '', isHomework: false, notes: [] };

  // --- Tekrar ---
  let m = first(rx(`${B}her\\s+gün${E}`));
  if (m) { r.recur = { freq: 'daily', interval: 1, byDay: [] }; take(m); }
  if (!r.recur && (m = first(rx(`${B}(?:her\\s+)?hafta\\s*içi(?:\\s+her\\s+gün)?${E}`), (x) => /her/.test(x[0]) || /her\s+gün/.test(t)))) {
    r.recur = { freq: 'weekly', interval: 1, byDay: [1, 2, 3, 4, 5] }; take(m);
  }
  if (!r.recur && (m = first(rx(`${B}her\\s+${GUN_RE}${SFX}((?:\\s*(?:,|ve)\\s*${GUN_RE}${SFX})*)${E}`)))) {
    const days = [...m[0].matchAll(rx(GUN_RE))].map((x) => GUNLER.indexOf(x[1]) + 1);
    r.recur = { freq: 'weekly', interval: 1, byDay: [...new Set(days)] }; take(m);
  }
  if (!r.recur && (m = first(rx(`${B}(\\d+|bir|iki|üç|dört)\\s+haftada\\s+bir${E}`)))) {
    r.recur = { freq: 'weekly', interval: Number(m[1]) || SAYI[m[1]] || 1, byDay: [] }; take(m);
  }
  if (!r.recur && (m = first(rx(`${B}her\\s+(hafta|ay|yıl|sene)${E}`)))) {
    r.recur = { freq: { hafta: 'weekly', ay: 'monthly', yıl: 'yearly', sene: 'yearly' }[m[1]], interval: 1, byDay: [] }; take(m);
  }
  if (r.recur) {
    // "… kadar" bitişi
    let u = first(rx(`${B}(\\d{1,2})\\s+${AY_RE}${SFX}(?:\\s+(\\d{4}))?(?:\\s+tarihine)?\\s+kadar${E}`));
    if (u) {
      const mon = AYLAR.indexOf(u[2]);
      let y = u[3] ? Number(u[3]) : now.getFullYear();
      let d = new Date(y, mon, Number(u[1]));
      if (!u[3] && d < startOfDay(now)) d = new Date(y + 1, mon, Number(u[1]));
      r.recur.until = toDateKey(d); take(u);
    } else if ((u = first(rx(`${B}dönem\\s+sonu\\p{L}*\\s+kadar${E}`)))) {
      if (state.term.end) r.recur.until = state.term.end;
      take(u);
    }
  }

  // --- Tüm gün ---
  if ((m = first(rx(`${B}(tüm|bütün)\\s+gün${E}`)))) { r.allDay = true; take(m); }

  // --- Süre ("2 saat", "90 dk", "1.5 saat", "yarım saat") ---
  if ((m = first(rx(`${B}(\\d+(?:[.,]\\d+)?|yarım|bir\\s+buçuk|iki\\s+buçuk)\\s*(saat|sa|dk|dakika)(?:lik)?${E}(?!\\s*\\d)`)))) {
    const n = { yarım: 0.5, 'bir buçuk': 1.5, 'iki buçuk': 2.5 }[m[1].replace(/\s+/g, ' ')] ?? Number(m[1].replace(',', '.'));
    r.durationMin = Math.round(/^d/.test(m[2]) ? n : n * 60);
    take(m);
  }

  // --- Tarih ---
  // 15/10, 15/10/2026, 15.10.2026
  if ((m = first(rx(`${B}(\\d{1,2})(?:/(\\d{1,2})(?:/(\\d{2,4}))?|\\.(\\d{1,2})\\.(\\d{2,4}))${SFX}${E}`)))) {
    const d = Number(m[1]); const mo = Number(m[2] || m[4]) - 1; const yRaw = m[3] || m[5];
    if (mo >= 0 && mo < 12 && d >= 1 && d <= 31) {
      let y = yRaw ? Number(yRaw.length === 2 ? `20${yRaw}` : yRaw) : now.getFullYear();
      let dt = new Date(y, mo, d);
      if (!yRaw && dt < addDays(startOfDay(now), -1)) dt = new Date(y + 1, mo, d);
      r.date = dt; take(m);
    }
  }
  // 15 ekim, 15 ekim 2026, 15 ekimde
  if (!r.date && (m = first(rx(`${B}(\\d{1,2})\\s+${AY_RE}${SFX}(?:\\s+(\\d{4}))?${E}`)))) {
    const mo = AYLAR.indexOf(m[2]);
    let y = m[3] ? Number(m[3]) : now.getFullYear();
    let dt = new Date(y, mo, Number(m[1]));
    if (!m[3] && dt < addDays(startOfDay(now), -1)) dt = new Date(y + 1, mo, Number(m[1]));
    r.date = dt; take(m);
  }
  if (!r.date && (m = first(rx(`${B}(bugün|bu\\s+akşam|bu\\s+gece|yarın|öbür\\s+gün|ertesi\\s+gün|yarından\\s+sonra)${SFX}${E}`)))) {
    const w = m[1].replace(/\s+/g, ' ');
    r.date = addDays(startOfDay(now), w === 'yarın' ? 1 : ['öbür gün', 'ertesi gün', 'yarından sonra'].includes(w) ? 2 : 0);
    if (w === 'bu akşam') r.daypart = 'akşam';
    if (w === 'bu gece') r.daypart = 'gece';
    take(m);
  }
  if (!r.date && (m = first(rx(`${B}(\\d+|bir|iki|üç)\\s+(gün|hafta)\\s+sonra${E}`)))) {
    const n = Number(m[1]) || SAYI[m[1]] || 1;
    r.date = addDays(startOfDay(now), m[2] === 'gün' ? n : n * 7); take(m);
  }
  if (!r.date && !(r.recur?.byDay?.length) && (m = first(rx(`${B}(?:(haftaya|gelecek\\s+hafta|önümüzdeki|bu)\\s+)?${GUN_RE}${SFX}(?:\\s+günü)?${E}`)))) {
    const wd = GUNLER.indexOf(m[2]) + 1;
    const today = startOfDay(now);
    let dt;
    if (m[1] && /hafta|önümüzdeki/.test(m[1]) && m[1] !== 'önümüzdeki') dt = addDays(startOfWeek(today), 7 + wd - 1);
    else {
      dt = addDays(today, (wd - isoWeekday(today) + 7) % 7);
      if (m[1] === 'önümüzdeki' && dt.getTime() === today.getTime()) dt = addDays(dt, 7);
    }
    r.date = dt; r.dateFromWeekday = dt.getTime() === today.getTime(); take(m);
  }

  // --- Saat ---
  const DP = '(sabah|öğlen|öğle|öğleden\\s+sonra|akşam|gece)';
  // aralık: 14:00-16:00, 14-16, 21.00–23.00, "saat 14 ile 16 arası"
  if ((m = first(rx(`${B}(?:saat\\s+)?(?:${DP}\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:-|–|ile)\\s*(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*arası)?${SFX}${E}`),
    (x) => Number(x[2]) <= 24 && Number(x[4]) <= 24 && (x[3] || x[5] || /saat|ile/.test(x[0]) || x[1] || (Number(x[2]) >= 7 && Number(x[4]) >= 7))))) {
    const dp = m[1]?.replace(/\s+/g, ' ');
    r.time = adjustHour(Number(m[2]), dp, true) * 60 + Number(m[3] || 0);
    let endMin = adjustHour(Number(m[4]), dp, true) * 60 + Number(m[5] || 0);
    if (endMin <= r.time && endMin + 720 > r.time) endMin += 720;
    if (endMin <= r.time) endMin += 1440;
    r.endTime = endMin; take(m);
  }
  if (r.time === null && (m = first(rx(`${B}(?:saat\\s+)?(?:${DP}\\s+(?:saat\\s+)?)?(\\d{1,2})[:.](\\d{2})${SFX}${E}`), (x) => Number(x[2]) < 24 && Number(x[3]) < 60))) {
    r.time = adjustHour(Number(m[2]), m[1]?.replace(/\s+/g, ' '), false) * 60 + Number(m[3]); take(m);
  }
  if (r.time === null && (m = first(rx(`${B}(?:${DP}\\s+)?saat\\s+(\\d{1,2})${SFX}${E}`), (x) => Number(x[2]) <= 24))) {
    r.time = adjustHour(Number(m[2]), m[1]?.replace(/\s+/g, ' '), true) * 60; take(m);
  }
  if (r.time === null && (m = first(rx(`${B}${DP}\\s+(\\d{1,2})${SFX}${E}`), (x) => Number(x[2]) <= 12))) {
    r.time = adjustHour(Number(m[2]), m[1].replace(/\s+/g, ' '), true) * 60; take(m);
  }
  if (r.time === null && (m = first(rx(`${B}${DP}${SFX}${E}`)))) {
    r.time = { sabah: 9, öğlen: 12, öğle: 12, 'öğleden sonra': 15, akşam: 19, gece: 22 }[m[1].replace(/\s+/g, ' ')] * 60; take(m);
  }
  if (r.time === null && r.daypart) r.time = (r.daypart === 'akşam' ? 19 : 22) * 60;

  // --- Ders ve ödev ---
  for (const c of state.courses) {
    const code = c.code ? lower(c.code).replace(/\s+/g, '') : '';
    let cm = null;
    if (code) {
      const parts = code.match(/^(\p{L}+)(\d+)$/u);
      const src = parts ? `${B}${parts[1]}\\s*${parts[2]}${SFX}${E}` : `${B}${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${E}`;
      cm = first(rx(src));
    }
    if (!cm && c.name && c.name.length >= 4) cm = first(rx(`${B}${lower(c.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${SFX}${E}`));
    if (cm) { r.courseId = c.id; r.courseSpan = [cm.index, cm.index + cm[0].length]; break; }
  }
  if (r.courseId && ODEV_RE.test(t)) {
    r.isHomework = true;
    used.push(r.courseSpan);
    const tm = first(rx(`${B}teslim(?:i|\\s+tarihi)?${E}`));
    if (tm) take(tm);
  }

  // --- #kategori ---
  if ((m = first(rx(`#(\\p{L}+)`)))) {
    const tag = m[1];
    const cat = state.categories.find((c) => lower(c.name).replace(/\s+/g, '').startsWith(tag) || c.id === tag);
    if (cat) { r.categoryId = cat.id; take(m); }
  }

  // --- @konum: bir sonraki tanınan parçaya, virgüle ya da sona kadar ---
  const at = t.indexOf('@');
  if (at >= 0 && free(at, at + 1)) {
    let endAt = t.length;
    const comma = t.indexOf(',', at); if (comma >= 0) endAt = comma;
    for (const [a] of used) if (a > at && a < endAt) endAt = a;
    r.location = orig.slice(at + 1, endAt).trim();
    used.push([at, endAt]);
  }

  // --- Başlık: tanınmayan kısımlar ---
  const keep = [];
  for (let i = 0; i < orig.length; i++) if (free(i, i + 1)) keep.push(orig[i]);
  let title = keep.join('').replace(/\s*[,–-]\s*$/g, '').replace(/^\s*[,–-]\s*/g, '').replace(/\s{2,}/g, ' ').trim();
  title = title.replace(/^(saat|de|da|ve)\s+/i, '').replace(/\s+(saat|de|da|ve)$/i, '').trim();
  if (r.isHomework) title = title.replace(/^ödevi(?=\s|$)/i, 'Ödev');

  if (!r.categoryId) {
    const tt = lower(title || t);
    for (const [id, re] of KATEGORI_IPUCU) if (re.test(tt) && state.categories.some((c) => c.id === id)) { r.categoryId = id; break; }
    if (!r.categoryId) {
      const byName = state.categories.find((c) => c.id !== 'diger' && tt.includes(lower(c.name)));
      r.categoryId = byName?.id || 'diger';
    }
  }
  if (r.courseId && !r.isHomework && r.categoryId === 'diger') r.categoryId = 'diger';
  r.title = title ? title.charAt(0).toLocaleUpperCase('tr') + title.slice(1) : '';
  return finalize(r, now);
}

// akşam/gece/öğleden sonra → 12 ekle; tek başına "saat 3" → 15
function adjustHour(hh, daypart, bare) {
  if (daypart === 'akşam' || daypart === 'öğleden sonra') return hh < 12 ? hh + 12 : hh;
  if (daypart === 'gece') return hh >= 6 && hh < 12 ? hh + 12 : hh === 12 ? 0 : hh;
  if (daypart === 'öğlen' || daypart === 'öğle') return hh < 6 ? hh + 12 : hh;
  if (daypart === 'sabah') return hh;
  if (bare && hh >= 1 && hh < 7) return hh + 12;
  return hh === 24 ? 0 : hh;
}

function finalize(r, now) {
  const out = {
    type: r.isHomework ? 'odev' : 'event', title: r.title, categoryId: r.categoryId, location: r.location,
    courseId: r.courseId, recur: r.recur, allDay: false, start: null, end: null, due: '', dueTime: '',
    ok: false, hasWhen: !!(r.date || r.time !== null || r.recur),
  };
  const today = startOfDay(now);

  if (out.type === 'odev') {
    const d = r.date || (r.time !== null ? today : null);
    if (d) { out.due = toDateKey(d); out.dueTime = r.time !== null ? minToHm(r.time) : '23:59'; }
    if (!out.title) out.title = 'Ödev';
    out.ok = !!out.due;
    return out;
  }

  let date = r.date;
  if (!date && r.recur) {
    // İlk tekrarın tarihi
    date = today;
    if (r.recur.freq === 'weekly' && r.recur.byDay.length) {
      for (let i = 0; i < 8; i++) {
        const d = addDays(today, i);
        const passed = i === 0 && r.time !== null && r.time <= now.getHours() * 60 + now.getMinutes();
        if (r.recur.byDay.includes(isoWeekday(d)) && !passed) { date = d; break; }
      }
    }
  }
  if (!date && r.time !== null) {
    date = r.time > now.getHours() * 60 + now.getMinutes() ? today : addDays(today, 1);
  } else if (date && r.dateFromWeekday && r.time !== null && r.time <= now.getHours() * 60 + now.getMinutes()) {
    date = addDays(date, 7); // "cuma 20:00" cuma 21'de yazıldıysa: gelecek cuma
  }
  if (r.recur?.freq === 'weekly' && !r.recur.byDay.length && date) r.recur.byDay = [isoWeekday(date)];
  if (!date) return out;

  if (r.allDay || (r.time === null)) {
    out.allDay = true;
    out.start = `${toDateKey(date)}T00:00`;
    out.end = `${toDateKey(date)}T23:59`;
  } else {
    const st = addMinutes(date, r.time);
    const dur = r.endTime !== null ? r.endTime - r.time : (r.durationMin || category(r.categoryId).duration || 60);
    out.start = toLocalISO(st);
    out.end = toLocalISO(addMinutes(st, dur));
  }
  if (!out.title && r.categoryId === 'diger') return out; // ne olduğu anlaşılmadı
  if (!out.title) out.title = category(r.categoryId).name;
  out.ok = true;
  return out;
}

function minToHm(min) {
  return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export { parseLocal };
