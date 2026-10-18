// Ders konuları: her dersin işlenecek konuları ve "bitirdim" işaretleri.
// Konular ders koduna göre okulun müfredatından (mufredat/tobb-etu.json, ABYS'nin "Referans Ders Çizelgesi")
// kendiliğinden gelir; elle de eklenip düzenlenebilir. Konular dersin içinde durur: course.topics.
// Konu: { id, title, w: [ilkHafta, sonHafta] | null, done, doneAt }
// Müfredattan gelen konuların kimliği sıralı (m1, m2…): iki cihaz aynı dersi aynı anda doldurursa çift olmaz.
import { h, toast, celebrate } from './ui.js';
import { state, commit, uid } from './store.js';
import { parseLocal, daysBetween, startOfWeek, addDays, isoWeekday, toDateKey } from './dates.js';
import { tickButton } from './tasks.js';
import { openCourseForm } from './forms.js';

const CATALOG_URL = 'mufredat/tobb-etu.json';
let catalogP = null;
let catalog = null;

// Müfredat dosyası bir kez indirilir (service worker önbelleğe alır, çevrimdışı da açılır)
export function loadCatalog() {
  if (!catalogP) {
    catalogP = fetch(CATALOG_URL).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((d) => { if (d?.dersler) catalog = d; else catalogP = null; return catalog; });
  }
  return catalogP;
}

// "BİL 264L", "bil264l", "İYD - 1" → "BIL264L", "IYD1" (mufredat/guncelle.mjs ile aynı)
export function foldCode(s) {
  return String(s || '').toLocaleUpperCase('tr')
    .replace(/[İI]/g, 'I').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ç/g, 'C').replace(/Ğ/g, 'G')
    .replace(/[^A-Z0-9]/g, '');
}

export async function findLesson(code) {
  const k = foldCode(code);
  if (!k) return null;
  const d = await loadCatalog();
  return d?.dersler?.[k] || null;
}

export function topicsFromLesson(lesson) {
  return lesson.konular.map(([a, b, t], i) => ({ id: `m${i + 1}`, title: t, w: [a, b], done: false, doneAt: null }));
}

// Müfredattan yeniden getir: aynı başlıklı konunun "bitti" işareti korunur, elle eklenenler sona kalır.
export function mergeFromLesson(old = [], lesson) {
  const key = (t) => t.title.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
  const doneBy = new Map(old.filter((t) => t.done).map((t) => [key(t), t.doneAt]));
  const fresh = topicsFromLesson(lesson).map((t) => (doneBy.has(key(t)) ? { ...t, done: true, doneAt: doneBy.get(key(t)) } : t));
  const titles = new Set(fresh.map(key));
  return [...fresh, ...old.filter((t) => !/^m\d+$/.test(t.id) && !titles.has(key(t)))];
}

// Yapıştırılan haftalık planı konulara çevirir: [[ilkHafta, sonHafta, başlık], …]
// Anlar: "1. Hafta: Konu", "1. Hafta Konu", "Hafta 1 - Konu", "1) Konu", "1\tKonu" (tablodan kopya),
// "1. Hafta" satırının altına yazılmış konu, numarasız satırlar (sırayla hafta sayılır).
// Arka arkaya aynı konu ya da "X (devam)" önceki konuyla birleşir; "-" haftalar ve başlık satırları atlanır.
// mufredat/guncelle.mjs'teki weeksToTopics ile aynı kurallar; birini değiştirirsen ötekini de değiştir.
const SYL_HEAD = /^(referans\s+)?(ders\s+)?(çizelgesi|planı|programı|içeriği)$|^haftalık\b|^hafta\s*(no|konu)|^(konu|konular|hafta)$/i;
const SYL_LINE = /^(?:(\d{1,2})\s*\.?\s*hafta|hafta\s*(\d{1,2})|(\d{1,2})\s*(?:[.):\-–]|\t))\s*[:.\-–)]?\s*(.*)$/i;
const stripDevam = (t) => t.replace(/\s*[([]\s*(devam[ıi]?|cont\.?|continued)\s*[)\]]\s*$/i, '').replace(/\s*[-–:]\s*devam[ıi]?\s*$/i, '');
const cleanTitle = (t) => t.replace(/\s+/g, ' ').replace(/^[-–:.•*\s]+/, '').replace(/[,;\s]+$/, '').trim();
export function parseSyllabus(text) {
  const items = [];
  let pending = null;
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = SYL_LINE.exec(line);
    if (m) {
      const w = Number(m[1] || m[2] || m[3]);
      const t = cleanTitle(m[4] || '');
      if (t) { items.push({ w, t }); pending = null; } else pending = w;
    } else if (pending !== null) { items.push({ w: pending, t: cleanTitle(line) }); pending = null; }
    else if (!SYL_HEAD.test(cleanTitle(line))) items.push({ w: (items[items.length - 1]?.w || 0) + 1, t: cleanTitle(line) });
  }
  const key = (t) => t.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const rows = [];
  for (const { w, t } of items) {
    if (!t || /^[-–.?]+$/.test(t)) continue;
    const title = stripDevam(t) || t;
    const last = rows[rows.length - 1];
    // "İşaretçiler (devam)" → önceki "İşaretçiler (pointers)" konusunun devamı
    const same = last && (key(last[2]) === key(title) || (title !== t && key(last[2]).startsWith(`${key(title)} `)));
    if (same && w >= last[0] && w <= last[1] + 1) last[1] = w;
    else rows.push([w, w, title]);
  }
  return rows.slice(0, 40);
}

// Yapıştırılan konular eski listenin yerine geçer; aynı başlıklı konunun "bitti" işareti korunur.
function replaceWithRows(old = [], rows) {
  const key = (t) => t.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
  const doneBy = new Map(old.filter((t) => t.done).map((t) => [key(t.title), t.doneAt]));
  return rows.map(([a, b, title]) => ({ id: uid(), title, w: [a, b], done: doneBy.has(key(title)), doneAt: doneBy.get(key(title)) || null }));
}

export const fmtWeeks = (w) => (!w ? '' : w[0] === w[1] ? `${w[0]}. hafta` : `${w[0]}–${w[1]}. hafta`);
export function parseWeeks(s) {
  const m = /(\d{1,2})\s*(?:[-–—]\s*(\d{1,2}))?/.exec(String(s || ''));
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2] || m[1]);
  return a > 0 ? [Math.min(a, b), Math.max(a, b)] : null;
}

// Dönemin kaçıncı haftası (dönem başlangıcının haftası 1). Tatillerin hafta içi günleri sayılmaz:
// bir haftalık ara tatil programı bir hafta kaydırır, tek günlük bayram kaydırmaz.
export function termWeek(date = new Date()) {
  const t = state.term;
  if (!t?.start) return null;
  const k = toDateKey(date);
  if (k < t.start || (t.end && k > t.end)) return null;
  const s = startOfWeek(parseLocal(t.start));
  let off = 0;
  for (const b of t.breaks || []) {
    for (let d = parseLocal(b.start), e = parseLocal(b.end || b.start); d <= e; d = addDays(d, 1)) {
      if (d >= s && toDateKey(d) < k && isoWeekday(d) <= 5) off++;
    }
  }
  return Math.max(1, Math.floor(daysBetween(s, date) / 7) - Math.floor(off / 5) + 1);
}

export function topicStatus(c, date = new Date()) {
  const list = c.topics || [];
  const wk = termWeek(date);
  return {
    total: list.length,
    done: list.filter((t) => t.done).length,
    wk,
    cur: wk ? list.find((t) => t.w && t.w[0] <= wk && wk <= t.w[1]) || null : null,
    // Programa göre geçen haftalarda işlenmiş ama henüz bitmemiş konular
    behind: wk ? list.filter((t) => t.w && t.w[1] < wk && !t.done).length : 0,
    // Programdan önde: henüz sırası gelmemiş ama bitmiş konular
    ahead: wk ? list.filter((t) => t.w && t.w[0] > wk && t.done).length : 0,
    next: list.find((t) => !t.done) || null,
  };
}

export function toggleTopic(c, t) {
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  const all = c.topics.length && c.topics.every((x) => x.done);
  commit('courses');
  if (t.done && all) celebrate(`${c.code || c.name}: bütün konular bitti!`);
}

// Kodu müfredatta olan ve konusu hiç ayarlanmamış dersleri doldurur (bir kez; sonra kullanıcıya kalır)
let autoRunning = false;
export async function autoFillTopics() {
  if (autoRunning || !state.courses.some((c) => c.topics === undefined && foldCode(c.code))) return;
  autoRunning = true;
  try {
    const d = await loadCatalog();
    if (!d) return;
    const filled = [];
    for (const c of state.courses) {
      if (c.topics !== undefined) continue;
      const l = d.dersler[foldCode(c.code)];
      if (l) { c.topics = topicsFromLesson(l); filled.push(c.code || c.name); }
    }
    if (filled.length) {
      commit('courses');
      toast(filled.length === 1 ? `${filled[0]} konuları okulun müfredatından getirildi` : `${filled.length} dersin konuları okulun müfredatından getirildi`);
    }
  } finally { autoRunning = false; }
}

// ---------------------------------------------------------------------------
// Ders programı sayfasındaki "Konular" paneli
// ---------------------------------------------------------------------------
const openCards = new Set(); // açık kartlar (sayfa yeniden çizilince kapanmasın)

function dial(c, s) {
  return h('span', { class: 'tp-dial', style: { '--p': s.total ? s.done / s.total : 0 }, 'aria-hidden': 'true' },
    h('b', {}, String(s.done)), h('small', {}, `/${s.total}`));
}

function topicRow(c, t, s) {
  const cur = s.cur === t;
  return h('li', { class: `tp-item ${t.done ? 'done' : ''} ${cur ? 'cur' : ''}` },
    tickButton(t.done, () => toggleTopic(c, t), t.done ? `${t.title}: bitmedi olarak işaretle` : `${t.title}: bitti olarak işaretle`),
    h('span', { class: 'tp-title' }, t.title),
    h('span', { class: 'tp-w' }, cur ? h('i', { class: 'tp-now' }, 'bu hafta') : null, fmtWeeks(t.w)));
}

function courseCard(c) {
  const s = topicStatus(c);
  const open = openCards.has(c.id);
  const toggle = () => { if (open) openCards.delete(c.id); else openCards.add(c.id); card.replaceWith(courseCard(c)); };
  const complete = s.total && s.done === s.total;
  // Geride uyarısı yalnız takibe başlanmış derste (hiç işaret yokken her ders ilk günden "geride" görünmesin)
  const flag = s.behind && s.done ? h('span', { class: 'tp-flag behind' }, `${s.behind} konu geride`)
    : s.ahead ? h('span', { class: 'tp-flag ahead' }, 'programın önünde') : null;
  const card = h('li', { class: `tp-card ${open ? 'open' : ''} ${complete ? 'complete' : ''}`, style: { '--c': c.color } },
    h('div', { class: 'tp-head' },
      h('button', { type: 'button', class: 'tp-toggle', 'aria-expanded': String(open), onclick: toggle,
        'aria-label': `${c.code || c.name}: ${s.done}/${s.total} konu bitti${open ? '' : ', konuları göster'}` },
      dial(c, s),
      h('span', { class: 'tp-main' },
        h('span', { class: 'tp-name' }, h('strong', {}, c.code || c.name), c.code && c.name ? h('span', {}, c.name) : null, flag),
        h('span', { class: 'tp-next' }, complete ? 'Bütün konular bitti' : s.next ? ['Sıradaki: ', h('em', {}, s.next.title)] : '')),
      h('span', { class: 'tp-chev', 'aria-hidden': 'true' })),
      s.next ? tickButton(false, () => toggleTopic(c, s.next), `Sıradaki konuyu bitir: ${s.next.title}`) : null),
    open ? h('div', { class: 'tp-body' },
      h('ol', { class: 'tp-items' }, c.topics.map((t) => topicRow(c, t, s))),
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => openCourseForm(c.id, { focus: 'topics' }) }, 'Konuları düzenle')) : null);
  return card;
}

export function topicsPanel() {
  if (!state.courses.length) return null;
  const withT = state.courses.filter((c) => c.topics?.length);
  const without = state.courses.filter((c) => !c.topics?.length);
  const wk = termWeek();
  // Henüz bitmemişler üstte, bitenler altta
  const sorted = [...withT].sort((a, b) => {
    const da = a.topics.every((t) => t.done), db = b.topics.every((t) => t.done);
    return Number(da) - Number(db);
  });
  return h('section', { class: 'panel topics-panel' },
    h('div', { class: 'panel-head' }, h('h3', {}, 'Konular'), wk ? h('span', { class: 'tp-week' }, `Dönemin ${wk}. haftası`) : null),
    withT.length
      ? h('ul', { class: 'tp-list' }, sorted.map(courseCard))
      : h('p', { class: 'muted small' }, 'Derslerin işlenecek konuları burada listelenir; çalıştıkça bitirdiklerini işaretlersin. Ders kodu okulun müfredatında varsa konular kendiliğinden gelir, yoksa dersi düzenleyip kendin ekleyebilirsin.'),
    without.length ? h('p', { class: 'muted small tp-missing' }, withT.length ? 'Konusu olmayan: ' : 'Konu ekle: ',
      without.map((c, i) => [i ? ', ' : '', h('button', { type: 'button', class: 'linkish', onclick: () => openCourseForm(c.id, { focus: 'topics' }) }, c.code || c.name)])) : null);
}

// ---------------------------------------------------------------------------
// Takvimde bir ders oturumuna tıklanınca: bu haftanın konusu ve sıradaki konu
// ---------------------------------------------------------------------------
export function occurrenceTopics(c, date) {
  if (!c.topics?.length) return null;
  const wrap = h('div', { class: 'occ-tasks occ-topics' });
  const draw = () => {
    const s = topicStatus(c, date);
    const rows = [];
    if (s.cur) rows.push(['Programa göre bu hafta', s.cur]);
    if (s.next && s.next !== s.cur) rows.push(['Sıradaki konun', s.next]);
    wrap.replaceChildren(
      h('div', { class: 'occ-tasks-head' }, h('strong', {}, 'Konular'), h('span', { class: 'muted small' }, `${s.done}/${s.total} bitti`)),
      rows.length ? h('ul', { class: 'occ-tp' }, rows.map(([label, t]) => h('li', { class: `occ-tp-row ${t.done ? 'done' : ''}`, style: { '--c': c.color } },
        tickButton(t.done, () => { toggleTopic(c, t); draw(); }, t.done ? `${t.title}: bitmedi olarak işaretle` : `${t.title}: bitti olarak işaretle`),
        h('span', {}, h('small', { class: 'muted' }, label), h('span', { class: 'tp-title' }, t.title)))))
        : h('p', { class: 'muted small' }, 'Bütün konular bitti.'));
  };
  draw();
  return wrap;
}

// ---------------------------------------------------------------------------
// Ders formundaki konu düzenleyici. c: formun üzerinde çalıştığı kopya (c.topics doğrudan değişir).
// ---------------------------------------------------------------------------
// Ders kodunun ön ekine göre ABYS program kimliği (mufredat/guncelle.mjs'teki ONEK ile aynı); bilinmiyorsa EEM.
// Ders sayfası programa bağlı: başka bölümün verdiği ortak derste bağlantı açılmayabilir.
const ABYS_PROG = {
  BIL: 5, FIZ: 5, TUR: 5, AIT: 5, OEG: 5, IYD: 5, ELE: 7, MAT: 7, KIM: 7, END: 9, YAP: 176, MAK: 178, BMM: 180, MBN: 182,
  TDE: 185, TAR: 187, IDE: 189, PSI: 191, ISL: 194, ING: 194, IKT: 196, UGI: 200, UGIR: 200, SUI: 204, YBS: 65921,
  ICT: 207, EUT: 209, GIT: 211, GRT: 211, BLT: 211, MIM: 213, SAT: 213, HUK: 216, MTA: 216, TIP: 219,
};
export function abysUrl(code) {
  const raw = String(code || '').toLocaleUpperCase('tr').replace(/[\s-]+/g, '');
  const p = ABYS_PROG[foldCode(code).match(/^[A-Z]+/)?.[0]] || 7;
  return `https://abys.etu.edu.tr/public/lesson.jsp?program=${p}&lang=tr&lesson=${encodeURIComponent(raw)}`;
}

export function topicsEditor(c, { code, name, isNew }) {
  const list = h('ol', { class: 'tp-edit' });
  const hint = h('span', { class: 'field-hint' });
  // Ders kodu alanının yanındaki düğme (forms.js yerleştirir): müfredattan konuları getirir/yeniler
  const fetchBtn = h('button', { type: 'button', class: 'btn small ghost tp-fetch' }, 'İçeriği getir');
  // Müfredatta yoksa okulun ABYS ders sayfası (haftalık planı oradan kopyalayıp yapıştırmak için)
  const siteLink = h('a', { class: 'linkish tp-site', target: '_blank', rel: 'noopener', hidden: true }, 'Okulun ders sayfasını aç ↗');
  let lesson = null;

  // Yapıştır: ders sayfasındaki haftalık planı kopyala, buraya bırak; konular haftalarına yerleşir
  let parsed = [];
  const ta = h('textarea', { rows: 6, spellcheck: false, 'aria-label': 'Haftalık plan',
    placeholder: 'Ders sayfasındaki haftalık planı buraya yapıştır:\n1. Hafta: Programlamaya giriş\n2. Hafta: Değişkenler, operatörler\n…' });
  const preview = h('div', { class: 'tp-paste-pre' });
  const applyBtn = h('button', { type: 'button', class: 'btn small primary', disabled: true });
  const pasteBox = h('div', { class: 'tp-paste', hidden: true }, ta, preview,
    h('div', { class: 'row' }, applyBtn, h('button', { type: 'button', class: 'btn small ghost', onclick: () => closePaste() }, 'Vazgeç')));
  const closePaste = () => { pasteBox.hidden = true; pasteBtn.hidden = false; ta.value = ''; showParsed(); };
  const showParsed = () => {
    parsed = parseSyllabus(ta.value);
    applyBtn.disabled = !parsed.length;
    applyBtn.textContent = c.topics?.length ? `${parsed.length || ''} konuyla değiştir`.trim() : `${parsed.length || ''} konuyu ekle`.trim();
    if (!ta.value.trim()) { preview.replaceChildren(); return; }
    preview.replaceChildren(parsed.length
      ? h('ol', {}, parsed.map(([a, b, t]) => h('li', {}, h('span', {}, t), h('i', {}, fmtWeeks([a, b])))))
      : h('p', { class: 'muted small' }, 'Konu bulunamadı. Her hafta ayrı satırda olmalı ("1. Hafta: …").'));
  };
  ta.addEventListener('input', showParsed);
  applyBtn.onclick = () => {
    if (!parsed.length) return;
    const had = c.topics?.some((t) => t.done);
    c.topics = replaceWithRows(c.topics || [], parsed);
    hint.textContent = `${parsed.length} konu haftalarına yerleşti${had ? '; bitirdiklerin işaretli kaldı' : ''}. Kaydetmeyi unutma.`;
    closePaste(); setFound(lesson); draw();
  };
  const pasteBtn = h('button', { type: 'button', class: 'btn small ghost', onclick: () => { pasteBox.hidden = false; pasteBtn.hidden = true; showParsed(); ta.focus(); } }, 'Yapıştır');

  const draw = () => {
    const topics = c.topics || [];
    list.replaceChildren(...topics.map((t, i) => {
      const ti = h('input', { type: 'text', value: t.title, placeholder: 'Konu', 'aria-label': `${i + 1}. konu` });
      const wi = h('input', { type: 'text', value: t.w ? (t.w[0] === t.w[1] ? String(t.w[0]) : `${t.w[0]}-${t.w[1]}`) : '', placeholder: 'hafta', class: 'tp-wi', inputmode: 'numeric', 'aria-label': `${i + 1}. konunun haftası` });
      ti.oninput = () => { t.title = ti.value; };
      wi.onchange = () => { t.w = parseWeeks(wi.value); };
      return h('li', { class: t.done ? 'done' : '' }, ti, wi,
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Yukarı taşı', disabled: i === 0, onclick: () => { topics.splice(i - 1, 0, ...topics.splice(i, 1)); draw(); } }, '↑'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Konuyu kaldır', onclick: () => { topics.splice(i, 1); draw(); } }, '✕'));
    }));
  };

  const setFound = (l) => { lesson = l; };

  // Düğmeye basınca kod kutusu odağı kaybeder, "change" de gelir: aynı kod için ikinci kez bakma
  let fetchedCode = '';
  const lookup = async (auto) => {
    if (auto && fetchedCode && foldCode(code.value) === fetchedCode) return;
    if (foldCode(code.value) && !(await loadCatalog())) { hint.textContent = 'Müfredat dosyası indirilemedi; internet gelince "İçeriği getir"e bas.'; return; }
    const l = await findLesson(code.value);
    if (auto && fetchedCode && foldCode(code.value) === fetchedCode) return;
    setFound(l);
    if (!l) { hint.textContent = foldCode(code.value) ? 'Bu kod okulun müfredatında bulunamadı. Ders sayfasındaki haftalık planı kopyalayıp "Yapıştır"a bırakabilir ya da konuları tek tek ekleyebilirsin.' : 'Ders kodunu yazıp "İçeriği getir"e basınca konular okulun müfredatından gelir. Haftalık planı kopyalayıp "Yapıştır"a da bırakabilirsin.'; return; }
    hint.textContent = `Okulun müfredatında var: ${l.kod} ${l.ad}.${c.topics?.length ? '' : ' Konuları eklemek için "İçeriği getir"e bas.'}`;
    if (auto && isNew && !c.topics?.length) {
      c.topics = topicsFromLesson(l);
      if (!name.value.trim() && l.ad) name.value = l.ad;
      hint.textContent = `${l.konular.length} konu okulun müfredatından eklendi (${l.kod} ${l.ad}). Silebilir, düzenleyebilirsin.`;
      setFound(l); draw();
    }
  };

  const notFound = () => {
    hint.textContent = 'Bu ders okulun müfredat dosyasında yok. Okulun sitesi seçmeli derslerin çoğunun haftalık planını yayımlamıyor; dersin izlencesindeki (syllabus) haftalık planı kopyalayıp açılan kutuya yapıştırabilirsin.';
    siteLink.href = abysUrl(code.value);
    siteLink.hidden = false;
    if (pasteBox.hidden) { pasteBox.hidden = false; pasteBtn.hidden = true; showParsed(); }
  };

  fetchBtn.onclick = async () => {
    if (!foldCode(code.value)) { hint.textContent = 'Önce ders kodunu yaz (ör. ELE 224), sonra "İçeriği getir"e bas.'; code.focus(); return; }
    fetchedCode = foldCode(code.value);
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Getiriliyor…';
    try {
      const d = await loadCatalog();
      if (!d) { hint.textContent = 'Müfredat dosyası indirilemedi. İnternet bağlantını kontrol edip yeniden dene.'; return; }
      const l = d.dersler[foldCode(code.value)] || null;
      setFound(l);
      if (!l) { notFound(); return; }
      siteLink.hidden = true;
      const had = c.topics?.length;
      c.topics = mergeFromLesson(c.topics || [], l);
      if (!name.value.trim() && l.ad) name.value = l.ad;
      hint.textContent = had
        ? `Konular okulun müfredatından getirildi (${l.kod} ${l.ad}, ${l.konular.length} konu); bitirdiklerin işaretli kaldı. Kaydetmeyi unutma.`
        : `${l.konular.length} konu okulun müfredatından eklendi (${l.kod} ${l.ad}). Kaydetmeyi unutma.`;
      draw();
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = 'İçeriği getir';
    }
  };
  code.addEventListener('change', () => lookup(true));
  code.addEventListener('input', () => { siteLink.hidden = true; fetchedCode = ''; });
  // Kod kutusunda Enter = İçeriği getir (form gönderilmesin)
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fetchBtn.click(); } });

  draw();
  lookup(false);
  const el = h('div', { class: 'field tp-editor', role: 'group', 'aria-label': 'Konular' },
    h('span', { class: 'field-label' }, 'Konular'),
    list,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => {
        c.topics = c.topics || [];
        const last = c.topics[c.topics.length - 1];
        const w = last?.w ? last.w[1] + 1 : null;
        c.topics.push({ id: uid(), title: '', w: w ? [w, w] : null, done: false, doneAt: null });
        draw();
        list.lastElementChild?.querySelector('input')?.focus();
      } }, '+ Konu ekle'),
      pasteBtn),
    pasteBox,
    hint,
    siteLink);
  // Kaydetmeden önce boş başlıklı konuları at
  const clean = () => { if (c.topics) c.topics = c.topics.filter((t) => t.title.trim()).map((t) => ({ ...t, title: t.title.trim() })); };
  return { el, clean, fetchBtn };
}
