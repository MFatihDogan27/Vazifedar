// Otomatik yedek.
// Chrome / Edge: seçilen klasöre her gün bir JSON yedeği yazar (değişiklikten ~1 dk sonra, aynı günün
// dosyasının üstüne). Son 30 günün yedeği ve daha eskilerden her ayın ilk yedeği tutulur.
// Klasöre yazamayan tarayıcılarda (telefon, Firefox, Safari) 7 günde bir "yedek indir" hatırlatır.
import { state, subscribe } from './store.js';
import { h, toast } from './ui.js';
import { toDateKey, timeStr } from './dates.js';

const META_KEY = 'vazifedar:backup';
const KEEP_DAYS = 30;
const NAG_DAYS = 7;
const FILE_RE = /^vazifedar-yedek-(\d{4})-(\d{2})-(\d{2})\.json$/;

export const fsSupported = () => typeof window.showDirectoryPicker === 'function';

// ---------- küçük kalıcı bilgiler (localStorage) ----------
function meta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
}
function setMeta(patch) {
  const m = { ...meta(), ...patch };
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* yok say */ }
  return m;
}

// ---------- IndexedDB: klasör tutamacı localStorage'a yazılamaz ----------
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('vazifedar', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kv(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => { db.close(); res(req?.result); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}
const idbGet = (k) => kv('readonly', (s) => s.get(k));
const idbSet = (k, v) => kv('readwrite', (s) => s.put(v, k));
const idbDel = (k) => kv('readwrite', (s) => s.delete(k));

// ---------- durum ----------
let dir = null;          // FileSystemDirectoryHandle
let perm = 'none';       // none | granted | prompt | denied | missing
let pending = null;
let busy = false;
const listeners = new Set();
export function onBackupChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) fn(); renderBar(); }

export function backupStatus() {
  const m = meta();
  return { supported: fsSupported(), folder: dir?.name || m.dirName || '', perm, lastAt: m.lastAt || null, lastKind: m.lastKind || '', lastFile: m.lastFile || '' };
}

const json = () => JSON.stringify(state, null, 1);
const hasData = () => state.events.some((e) => !e.deleted) || state.tasks.length || state.courses.length || state.notes.length || Object.keys(state.journal).length;
const fileName = (d = new Date()) => `vazifedar-yedek-${toDateKey(d)}.json`;

// ---------- elle indirme (her tarayıcıda) ----------
export function downloadBackup() {
  const blob = new Blob([json()], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: fileName() });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  setMeta({ lastAt: new Date().toISOString(), lastKind: 'manual', lastFile: a.download, nagAt: null });
  emit();
}

// ---------- klasöre yazma ----------
export async function chooseFolder() {
  let d;
  try {
    d = await window.showDirectoryPicker({ id: 'vazifedar-yedek', mode: 'readwrite', startIn: 'documents' });
  } catch (e) {
    if (e.name !== 'AbortError') toast(`Klasör seçilemedi: ${e.message}`, { kind: 'warn' });
    return false;
  }
  // Uygulamanın kendi klasörü seçildiyse içine "yedekler" klasörü aç
  try {
    let isApp = false;
    for await (const [n] of d.entries()) if (n === 'index.html' || n === 'baslat.bat') { isApp = true; break; }
    if (isApp) d = await d.getDirectoryHandle('yedekler', { create: true });
  } catch { /* olduğu gibi kullan */ }
  dir = d; perm = 'granted';
  try { await idbSet('backupDir', d); } catch (e) { console.warn('Klasör hatırlanamadı', e); }
  setMeta({ dirName: d.name, snoozeAt: null });
  return backupNow({ quiet: false });
}

export async function forgetFolder() {
  dir = null; perm = 'none'; clearTimeout(pending);
  try { await idbDel('backupDir'); } catch { /* yok say */ }
  setMeta({ dirName: '' });
  emit();
}

export async function backupNow({ quiet = true, interactive = false } = {}) {
  clearTimeout(pending); pending = null;
  if (!dir || busy) return false;
  busy = true;
  try {
    let p = await dir.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted' && interactive) p = await dir.requestPermission({ mode: 'readwrite' });
    perm = p;
    if (p !== 'granted') return false;
    const name = fileName();
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(json());
    await w.close();
    setMeta({ lastAt: new Date().toISOString(), lastKind: 'auto', lastFile: name, nagAt: null });
    await prune().catch(() => {});
    if (!quiet) toast(`Yedeklendi: ${dir.name}/${name}`);
    return true;
  } catch (e) {
    if (e.name === 'NotFoundError') perm = 'missing';
    if (!quiet || perm === 'missing') toast(`Otomatik yedek yazılamadı${perm === 'missing' ? ': klasör bulunamadı (taşınmış ya da silinmiş olabilir)' : `: ${e.message}`}`, { kind: 'warn', ms: 8000 });
    return false;
  } finally {
    busy = false;
    emit();
  }
}

// Son 30 günün dosyası + daha eskilerden her ayın ilk dosyası kalır
async function prune() {
  const names = [];
  for await (const [n, hd] of dir.entries()) if (hd.kind === 'file' && FILE_RE.test(n)) names.push(n);
  names.sort();
  const cutoff = fileName(new Date(Date.now() - KEEP_DAYS * 86400000));
  const seenMonth = new Set();
  for (const n of names) {
    if (n >= cutoff) continue;
    const [, y, m] = n.match(FILE_RE);
    if (!seenMonth.has(y + m)) { seenMonth.add(y + m); continue; }
    await dir.removeEntry(n).catch(() => {});
  }
}

function schedule(ms = 60000) {
  if (!dir || perm !== 'granted') { renderBar(); return; }
  clearTimeout(pending);
  pending = setTimeout(() => backupNow(), ms);
}

// ---------- hatırlatma şeridi ----------
let bar = null;
function needsAttention() {
  const m = meta();
  if (m.snoozeAt && Date.now() - new Date(m.snoozeAt) < 20 * 3600000) return null;
  if (dir && (perm === 'prompt' || perm === 'missing')) return perm;
  if (dir && perm === 'granted') return null;
  if (!hasData()) return null;
  const since = m.lastAt || m.firstSeen;
  if (!since || Date.now() - new Date(since) < NAG_DAYS * 86400000) return null;
  return 'overdue';
}
function renderBar() {
  const need = needsAttention();
  if (!need) { bar?.remove(); bar = null; return; }
  const m = meta();
  const days = m.lastAt ? Math.floor((Date.now() - new Date(m.lastAt)) / 86400000) : null;
  const text = {
    prompt: `Otomatik yedek duraklatıldı: tarayıcı "${dir?.name}" klasörüne yazmak için yeniden izin istiyor.`,
    missing: `Yedek klasörü "${dir?.name}" bulunamadı. Yeni bir klasör seç.`,
    overdue: days === null ? 'Henüz hiç yedek almadın. Görevler, dersler, notlar ve defter yalnız bu tarayıcıda duruyor.' : `Son yedeğin ${days} gün önce alındı. Görevler, dersler, notlar ve defter yalnız bu tarayıcıda duruyor.`,
  }[need];
  const act = {
    prompt: ['İzin ver', () => backupNow({ quiet: false, interactive: true })],
    missing: ['Klasör seç', () => chooseFolder()],
    overdue: fsSupported() ? ['Otomatik yedeği aç', () => chooseFolder()] : ['Yedek indir', () => downloadBackup()],
  }[need];
  const el = h('div', { class: `backup-bar ${need}`, role: 'status' },
    h('span', { class: 'bb-ic', 'aria-hidden': 'true' }),
    h('span', { class: 'bb-tx' }, text),
    h('button', { class: 'btn small ink', onclick: act[1] }, act[0]),
    need === 'overdue' && fsSupported() ? h('button', { class: 'btn small ghost', onclick: () => downloadBackup() }, 'Bir kez indir') : null,
    h('button', { class: 'bb-x', title: 'Yarına kadar gizle', 'aria-label': 'Yarına kadar gizle', onclick: () => { setMeta({ snoozeAt: new Date().toISOString() }); renderBar(); } }, '×'));
  const main = document.querySelector('.main');
  if (!main) return;
  if (bar) bar.replaceWith(el); else main.prepend(el);
  bar = el;
}

// ---------- Ayarlar paneli ----------
export function ago(iso, now = new Date()) {
  if (!iso) return 'hiç';
  const d = new Date(iso);
  const min = Math.round((now - d) / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  if (toDateKey(d) === toDateKey(now)) return `bugün ${timeStr(d)}`;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (toDateKey(d) === toDateKey(y)) return `dün ${timeStr(d)}`;
  return `${Math.max(2, Math.round((now - d) / 86400000))} gün önce`;
}

export function backupPanel() {
  const box = h('div', { class: 'backup-panel' });
  const draw = () => {
    const s = backupStatus();
    const last = h('p', { class: 'muted small' }, `Son yedek: ${ago(s.lastAt)}${s.lastAt ? ` (${s.lastKind === 'auto' ? 'otomatik' : 'elle indirildi'})` : ''}`);
    if (!s.supported) {
      box.replaceChildren(
        h('p', { class: 'small' }, 'Bu tarayıcı bir klasöre kendiliğinden yazamıyor (telefon, Firefox ve Safari böyle). Yedek almadan 7 gün geçerse üstte hatırlatma çıkar; "Yedek indir" dosyayı İndirilenler\'e kaydeder.'),
        last);
      return;
    }
    if (!dir) {
      box.replaceChildren(
        h('p', { class: 'small' }, 'Bir klasör seç; Vazifedar her gün oraya kendiliğinden yedek yazsın. Son 30 günün yedeği ve daha eskilerden her ayın ilk yedeği tutulur.'),
        h('p', { class: 'muted small' }, 'İpucu: Google Drive ya da OneDrive klasöründe bir klasör seçersen yedekler buluta da gider; bilgisayara bir şey olsa bile kaybolmaz. Vazifedar klasörünün kendisini seçersen içinde "yedekler" klasörü açılır.'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => chooseFolder() }, 'Yedek klasörü seç')),
        last);
      return;
    }
    const stateTx = { granted: 'Açık', prompt: 'İzin bekliyor', denied: 'İzin verilmedi', missing: 'Klasör bulunamadı', none: '' }[s.perm] || s.perm;
    box.replaceChildren(...[
      h('div', { class: 'backup-row' },
        h('span', { class: `backup-dot ${s.perm}` }),
        h('div', {}, h('strong', {}, s.folder), h('div', { class: 'muted small' }, `Otomatik yedek: ${stateTx} · son yedek ${ago(s.lastAt)}${s.lastFile && s.lastKind === 'auto' ? ` · ${s.lastFile}` : ''}`))),
      s.perm === 'prompt' || s.perm === 'denied' ? h('p', { class: 'muted small' }, 'Tarayıcı yeniden açıldığında klasör izni sıfırlanabilir. İzin verirken "Her ziyarette izin ver" seçeneği çıkarsa onu seç; bir daha sorulmaz.') : null,
      h('div', { class: 'row' },
        s.perm === 'granted'
          ? h('button', { class: 'btn', onclick: () => backupNow({ quiet: false }) }, 'Şimdi yedekle')
          : h('button', { class: 'btn primary', onclick: () => (s.perm === 'missing' ? chooseFolder() : backupNow({ quiet: false, interactive: true })) }, s.perm === 'missing' ? 'Klasör seç' : 'İzin ver'),
        h('button', { class: 'btn ghost', onclick: () => chooseFolder() }, 'Klasörü değiştir'),
        h('button', { class: 'btn ghost danger', onclick: () => forgetFolder() }, 'Otomatik yedeği kapat')),
    ].filter(Boolean));
  };
  draw();
  const off = onBackupChange(() => { if (box.isConnected) draw(); else off(); });
  return box;
}

// ---------- başlat ----------
export async function initBackup() {
  if (!meta().firstSeen) setMeta({ firstSeen: new Date().toISOString() });
  // Tarayıcı yer darlığında bu sitenin verisini kendiliğinden silmesin
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* yok say */ }
  if (fsSupported()) {
    try { dir = (await idbGet('backupDir')) || null; } catch { dir = null; }
    if (dir) {
      try { perm = await dir.queryPermission({ mode: 'readwrite' }); } catch { perm = 'prompt'; }
    }
  }
  subscribe(() => schedule());
  // Bugünün yedeği yoksa açılışta bir tane al
  if (dir && perm === 'granted' && meta().lastFile !== fileName()) schedule(4000);
  // Sekme kapanırken / arka plana geçerken bekleyen yedeği hemen yaz
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pending) backupNow(); });
  // Gün dönünce yeni günün dosyası açılsın, hatırlatma şeridi tazelensin
  setInterval(() => {
    if (dir && perm === 'granted' && meta().lastFile !== fileName() && hasData()) backupNow();
    else renderBar();
  }, 30 * 60000);
  emit();
}
