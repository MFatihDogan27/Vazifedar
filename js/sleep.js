// Uyku: varsayılan saatler + gün gün değişiklikler, uyku düzeni penceresi, Bugün kartı.
//
// Veri:
//   state.sleepDef = { bed: 'HH:mm', wake: 'HH:mm', updatedAt }      varsayılan (her gece)
//   state.sleep[dateKey] = { wake?, bed?, updatedAt }               o güne özel değişiklik
//     wake: o sabah kalkış saati; bed: o gece yatış saati.
// Yatış 12:00'den önceyse gece yarısını geçmiş sayılır (ertesi güne düşer): '01:30' → ertesi gün 01:30.
// "Gece" bir günün yatışından ertesi günün kalkışına kadardır; anahtarı yatılan günün tarihidir.
import { h, toast, openModal } from './ui.js';
import { state, commit } from './store.js';
import {
  addDays, addMinutes, startOfDay, toDateKey, hmToMin, timeStr, durationText,
  GUNLER, GUNLER_KISA, AYLAR, sameDay,
} from './dates.js';
import { ic } from './icons.js';

const BED_SPLIT = 12 * 60;
const pad = (n) => String(n).padStart(2, '0');
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const nextKey = (k) => toDateKey(addDays(parseKey(k), 1));
const validHm = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);

export function sleepDef() {
  const d = state.sleepDef || {};
  return { bed: validHm(d.bed) ? d.bed : '00:00', wake: validHm(d.wake) ? d.wake : '07:00' };
}

// Bir günün kalkış ve yatış saati (değiştirilmemişse varsayılan)
export function daySleep(key) {
  const d = sleepDef();
  const r = state.sleep?.[key] || {};
  return { wake: validHm(r.wake) ? r.wake : d.wake, bed: validHm(r.bed) ? r.bed : d.bed, wakeSet: validHm(r.wake), bedSet: validHm(r.bed) };
}

function bedAt(key) {
  const m = hmToMin(daySleep(key).bed);
  return addMinutes(m < BED_SPLIT ? addDays(parseKey(key), 1) : parseKey(key), m);
}
function wakeAt(key) { return addMinutes(parseKey(key), hmToMin(daySleep(key).wake)); }

// key gününün gecesi: o günün yatışı → ertesi günün kalkışı
export function night(key) {
  const nk = nextKey(key);
  const start = bedAt(key), end = wakeAt(nk);
  const a = daySleep(key), b = daySleep(nk);
  return { key, start, end, min: Math.max(0, Math.round((end - start) / 60000)), bedSet: a.bedSet, wakeSet: b.wakeSet, set: a.bedSet || b.wakeSet };
}

// [from, to) aralığına değen geceler (sıfır süreli geceler atlanır)
export function nightsInRange(from, to) {
  const out = [];
  for (let d = addDays(startOfDay(from), -1); d < to; d = addDays(d, 1)) {
    const n = night(toDateKey(d));
    if (n.min > 0 && n.end > from && n.start < to) out.push(n);
  }
  return out;
}

// Bir günün içindeki uyku dilimleri, gün başından dakika olarak ([{ a, b, n }])
export function sleepSpans(dayOrKey) {
  const d0 = typeof dayOrKey === 'string' ? parseKey(dayOrKey) : startOfDay(dayOrKey);
  const d1 = addDays(d0, 1);
  return nightsInRange(d0, d1).map((n) => ({
    a: Math.max(0, (n.start - d0) / 60000), b: Math.min(1440, (n.end - d0) / 60000), n,
  })).filter((s) => s.b > s.a);
}

// Gün belirtilmeden (ör. ders çizelgesindeki halkalar): varsayılan saatlerle bir günün uyku dilimleri
export function defaultSpans() {
  const d = sleepDef();
  const b = hmToMin(d.bed), w = hmToMin(d.wake);
  if (b < BED_SPLIT) return [{ a: Math.min(b, w), b: w }].filter((s) => s.b > s.a); // gece yarısından sonra yatış
  return [{ a: 0, b: w }, { a: b, b: 1440 }].filter((s) => s.b > s.a);
}

// Bir geceyi değiştir: yatış key gününe, kalkış ertesi güne yazılır. Varsayılana eşit olan alan silinir.
export function setNight(key, { bed, wake }) {
  const def = sleepDef();
  const now = new Date().toISOString();
  state.sleep = state.sleep || {};
  const put = (k, field, v) => {
    const cur = { ...(state.sleep[k] || {}) };
    if (!validHm(v) || v === def[field]) delete cur[field]; else cur[field] = v;
    delete cur.updatedAt;
    if (Object.keys(cur).length) state.sleep[k] = { ...cur, updatedAt: now };
    else if (state.sleep[k]) state.sleep[k] = { updatedAt: now }; // silindi bilgisi eşitlemede kaybolmasın
  };
  if (bed !== undefined) put(key, 'bed', bed);
  if (wake !== undefined) put(nextKey(key), 'wake', wake);
  commit('sleep');
}

export function setSleepDef({ bed, wake }) {
  const d = sleepDef();
  state.sleepDef = { bed: validHm(bed) ? bed : d.bed, wake: validHm(wake) ? wake : d.wake, updatedAt: new Date().toISOString() };
  commit('sleep');
}

// ---------------------------------------------------------------------------
// İstatistik: son n gece (bitmiş geceler)
// ---------------------------------------------------------------------------
// Saatleri gece ortasına göre ortala (23:50 ile 00:10'un ortalaması 00:00 olsun)
const bedMin = (n) => { const m = n.start.getHours() * 60 + n.start.getMinutes(); return m < BED_SPLIT ? m + 1440 : m; };
const wakeMin = (n) => n.end.getHours() * 60 + n.end.getMinutes();
const hmOf = (m) => `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(Math.round(m) % 60)}`;
const sd = (xs) => { const m = xs.reduce((a, x) => a + x, 0) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length); };

export function lastNights(count, now = new Date()) {
  // Bitmiş son geceler: dün gece en sonda
  const out = [];
  let d = addDays(startOfDay(now), -1);
  if (night(toDateKey(d)).end > now) d = addDays(d, -1);
  for (let i = 0; i < count; i++, d = addDays(d, -1)) out.unshift(night(toDateKey(d)));
  return out.filter((n) => n.min > 0);
}

export function sleepStats(nights) {
  if (!nights.length) return null;
  const avg = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
  const beds = nights.map(bedMin), wakes = nights.map(wakeMin);
  const spread = Math.round((sd(beds) + sd(wakes)) / 2);
  return {
    avgMin: Math.round(avg(nights.map((n) => n.min))),
    avgBed: hmOf(Math.round(avg(beds))), avgWake: hmOf(Math.round(avg(wakes))),
    spread, set: nights.filter((n) => n.set).length,
    shortest: nights.reduce((a, n) => (n.min < a.min ? n : a)),
    latest: nights.reduce((a, n) => (bedMin(n) > bedMin(a) ? n : a)),
  };
}
const spreadWord = (m) => (m <= 30 ? 'Düzenli' : m <= 60 ? 'Biraz oynak' : 'Dağınık');
const nightLabel = (n) => {
  const d = parseKey(n.key), e = addDays(d, 1);
  return `${GUNLER_KISA[(d.getDay() + 6) % 7]} → ${GUNLER_KISA[(e.getDay() + 6) % 7]}`;
};
const nightTitle = (key) => {
  const d = parseKey(key), e = addDays(d, 1);
  const today = startOfDay(new Date());
  if (sameDay(d, today)) return 'Bu gece';
  if (sameDay(e, today)) return 'Dün gece';
  return d.getMonth() === e.getMonth()
    ? `${d.getDate()}–${e.getDate()} ${AYLAR[e.getMonth()]} gecesi`
    : `${d.getDate()} ${AYLAR[d.getMonth()]} – ${e.getDate()} ${AYLAR[e.getMonth()]} gecesi`;
};

// ---------------------------------------------------------------------------
// Bir geceyi düzenle
// ---------------------------------------------------------------------------
export function openNight(key, { onDone } = {}) {
  const n = night(key);
  const d = parseKey(key), e = addDays(d, 1);
  const def = sleepDef();
  const bed = h('input', { type: 'time', value: daySleep(key).bed, step: 300 });
  const wake = h('input', { type: 'time', value: daySleep(toDateKey(e)).wake, step: 300 });
  const sum = h('p', { class: 'sl-sum' });
  const draw = () => {
    if (!bed.value || !wake.value) { sum.textContent = ''; return; }
    const b = hmToMin(bed.value), w = hmToMin(wake.value);
    const start = b < BED_SPLIT ? 1440 + b : b, end = 1440 + w;
    const min = end - start;
    sum.replaceChildren(ic('moon', { size: 16 }), min > 0 ? ` ${durationText(min)} uyku` : ' Kalkış yatıştan sonra olmalı');
    sum.classList.toggle('bad', min <= 0);
  };
  bed.addEventListener('input', draw); wake.addEventListener('input', draw);
  draw();
  const dayName = (x) => `${GUNLER[(x.getDay() + 6) % 7]} ${x.getDate()} ${AYLAR[x.getMonth()]}`;
  openModal({
    title: nightTitle(key),
    body: h('div', { class: 'sl-edit' },
      h('div', { class: 'grid-2' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Yatış'), bed, h('span', { class: 'field-hint' }, `${dayName(d)} gecesi`)),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Kalkış'), wake, h('span', { class: 'field-hint' }, dayName(e)))),
      sum,
      h('p', { class: 'muted small sl-def' }, n.set ? `Varsayılan: ${def.bed} yatış, ${def.wake} kalkış.` : `Bu gece varsayılan saatlerde (${def.bed}–${def.wake}). Değiştirirsen yalnız bu gece değişir.`)),
    actions: [
      ...(n.set ? [{ label: 'Varsayılana döndür', onClick: (_, close) => { setNight(key, { bed: '', wake: '' }); close(); toast(`${nightTitle(key)} varsayılana döndü`); onDone?.(); } }] : []),
      { label: 'Kaydet', kind: 'primary', onClick: (_, close) => {
        const b = hmToMin(bed.value || def.bed), w = hmToMin(wake.value || def.wake);
        if (1440 + w - (b < BED_SPLIT ? 1440 + b : b) <= 0) { toast('Kalkış yatıştan sonra olmalı', { kind: 'warn' }); return; }
        setNight(key, { bed: bed.value || def.bed, wake: wake.value || def.wake });
        close(); onDone?.();
      } },
    ],
  });
}

// ---------------------------------------------------------------------------
// Uyku düzeni penceresi: son geceler çubuk çubuk, ortalamalar, varsayılan saatler
// ---------------------------------------------------------------------------
let range = 14;
export function openSleepPanel() {
  const body = h('div', { class: 'sl-panel' });
  const m = openModal({ title: 'Uyku düzeni', body, wide: true });
  const draw = () => {
    const now = new Date();
    const past = lastNights(range, now);
    const st = sleepStats(past);
    const tonight = night(toDateKey(startOfDay(now)));
    // Bugünün gecesi henüz bitmediyse (yatılmadıysa ya da uyunuyorsa) plan olarak en altta
    const rows = [...past, ...(tonight.end > now && tonight.min > 0 ? [{ ...tonight, plan: true }] : [])];
    // Eksen: en erken yatıştan en geç kalkışa (saat başına yuvarlanmış), en az 20:00–12:00
    let lo = 20 * 60, hi = 36 * 60;
    for (const n of rows) { lo = Math.min(lo, Math.floor(bedMin(n) / 60) * 60); hi = Math.max(hi, Math.ceil((wakeMin(n) + 1440) / 60) * 60); }
    const span = hi - lo;
    const pct = (x) => `${((x - lo) / span) * 100}%`;
    const def = sleepDef();
    const defBed = hmToMin(def.bed) < BED_SPLIT ? hmToMin(def.bed) + 1440 : hmToMin(def.bed);
    const defWake = hmToMin(def.wake) + 1440;
    const ticks = [];
    for (let t = Math.ceil(lo / 120) * 120; t <= hi; t += 120) ticks.push(t);

    const chart = h('div', { class: 'sl-chart', style: { '--def-a': pct(defBed), '--def-b': pct(defWake) } },
      rows.map((n) => {
        const a = bedMin(n), b = wakeMin(n) + 1440;
        const isToday = n.plan;
        return h('button', {
          type: 'button', class: `sl-row ${n.set ? 'set' : 'def'} ${isToday ? 'plan' : ''}`,
          'aria-label': `${nightTitle(n.key)}: ${timeStr(n.start)} yatış, ${timeStr(n.end)} kalkış, ${durationText(n.min)}${n.set ? '' : ' (varsayılan)'}`,
          onclick: () => openNight(n.key, { onDone: draw }),
        },
        h('span', { class: 'sl-day' }, isToday ? 'Bu gece' : nightLabel(n), h('small', {}, `${parseKey(n.key).getDate()} ${AYLAR[parseKey(n.key).getMonth()].slice(0, 3)}`)),
        h('span', { class: 'sl-track' },
          h('span', { class: 'sl-bar', style: { left: pct(a), width: `${((b - a) / span) * 100}%` } },
            h('span', { class: 'sl-t' }, timeStr(n.start)), h('span', { class: 'sl-t' }, timeStr(n.end)))),
        h('span', { class: 'sl-dur' }, durationText(n.min).replace(' dk', '')));
      }),
      h('div', { class: 'sl-axis', 'aria-hidden': 'true' }, h('span'), h('span', { class: 'sl-ticks' },
        ticks.map((t) => h('i', { style: { left: pct(t) } }, pad(Math.floor(t / 60) % 24)))), h('span')));

    const tiles = st ? h('div', { class: 'sl-tiles' },
      h('div', {}, h('b', {}, durationText(st.avgMin)), h('span', {}, 'ortalama uyku')),
      h('div', {}, h('b', {}, st.avgBed), h('span', {}, 'ortalama yatış')),
      h('div', {}, h('b', {}, st.avgWake), h('span', {}, 'ortalama kalkış')),
      h('div', {}, h('b', {}, spreadWord(st.spread)), h('span', {}, st.spread ? `saatler ±${st.spread} dk oynuyor` : 'saatler hiç oynamıyor'))) : null;

    const note = st ? h('p', { class: 'muted small' },
      st.set ? `Son ${past.length} gecenin ${st.set} tanesini girdin; kalanlar varsayılan saatlerle (${def.bed}–${def.wake}) sayılıyor. ` : `Henüz hiçbir geceyi değiştirmedin; hepsi varsayılan saatlerle (${def.bed}–${def.wake}). `,
      `En kısa: ${nightTitle(st.shortest.key).toLocaleLowerCase('tr')}, ${durationText(st.shortest.min)}. En geç yatış: ${timeStr(st.latest.start)}.`) : null;

    const rangeSeg = h('div', { class: 'seg compact', role: 'radiogroup', 'aria-label': 'Kaç gece' }, [7, 14, 30].map((v) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(range === v), class: `seg-btn ${range === v ? 'on' : ''}`,
      autofocus: range === v ? '' : null, // pencere açılınca en alttaki saat kutusuna kaymasın
      onclick: () => { range = v; draw(); },
    }, `${v} gece`)));

    const db = h('input', { type: 'time', value: def.bed, step: 300 });
    const dw = h('input', { type: 'time', value: def.wake, step: 300 });
    const saveDef = () => {
      if (!db.value || !dw.value) return;
      const b = hmToMin(db.value), w = hmToMin(dw.value);
      if (1440 + w - (b < BED_SPLIT ? 1440 + b : b) <= 0) { toast('Kalkış yatıştan sonra olmalı', { kind: 'warn' }); db.value = def.bed; dw.value = def.wake; return; }
      setSleepDef({ bed: db.value, wake: dw.value });
      toast(`Varsayılan uyku: ${db.value}–${dw.value}`);
      draw();
    };
    db.addEventListener('change', saveDef); dw.addEventListener('change', saveDef);

    body.replaceChildren(
      tiles,
      h('div', { class: 'sl-head' }, h('h3', {}, 'Geceler'), rangeSeg),
      chart,
      h('p', { class: 'muted small sl-tip' }, 'Bir geceye dokun: o geceki yatış ve kalkışını düzelt.'),
      note,
      h('div', { class: 'sl-defbox' },
        h('div', {}, h('h3', {}, 'Varsayılan uyku'), h('p', { class: 'muted small' }, 'Değiştirmediğin her gece bu saatlerle sayılır. Değiştirdiğin geceler aynen kalır.')),
        h('div', { class: 'grid-2' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Yatış'), db),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Kalkış'), dw))));
  };
  draw();
  return m;
}

// ---------------------------------------------------------------------------
// Bugün ekranı kartı: dün gece ne kadar uyudun, bu gece ne zaman yatıyorsun
// ---------------------------------------------------------------------------
export function sleepCard(now = new Date()) {
  const todayKey = toDateKey(startOfDay(now));
  const prevKey = toDateKey(addDays(startOfDay(now), -1));
  const last = night(prevKey);
  const tonight = night(todayKey);
  const asleepNow = last.end > now && last.start <= now;  // gece yarısından sonra, hâlâ dün gecenin içinde
  const week = lastNights(7, now);
  const max = Math.max(9 * 60, ...week.map((n) => n.min));
  const line = (n, label) => h('button', { type: 'button', class: `sl-line ${n.set ? 'set' : ''}`, title: 'Değiştirmek için dokun', onclick: () => openNight(n.key) },
    h('span', { class: 'sl-l' }, label),
    h('span', { class: 'sl-v' }, `${timeStr(n.start)} → ${timeStr(n.end)}`),
    h('span', { class: 'sl-d' }, durationText(n.min)));
  return h('section', { class: 'card sleep-card' },
    h('div', { class: 'card-head' }, h('h3', {}, ic('moon', { size: 16, cls: 'sl-moon' }), ' Uyku'),
      h('button', { type: 'button', class: 'link', onclick: () => openSleepPanel() }, 'Uyku düzeni')),
    h('div', { class: 'sl-lines' },
      asleepNow ? line(last, 'Bu gece') : line(last, 'Dün gece'),
      asleepNow ? null : line(tonight, 'Bu gece')),
    week.length ? h('button', { type: 'button', class: 'sl-mini', 'aria-label': 'Son 7 gece: uyku düzenini aç', onclick: () => openSleepPanel() },
      week.map((n) => h('span', { class: `sl-mb ${n.set ? 'set' : ''}`, title: `${nightLabel(n)}: ${durationText(n.min)}` },
        h('i', { style: { height: `${Math.round((n.min / max) * 100)}%` } }),
        h('small', {}, GUNLER_KISA[(parseKey(n.key).getDay() + 6) % 7])))) : null);
}
