// Güncelleme: sunucudaki (GitHub Pages ya da localhost) dosyalar değişti mi, bak; değiştiyse tek dokunuşla al.
// Elle sürüm numarası artırmaya gerek yok: sw.js'teki dosya listesindeki her dosyanın "parmak izi"
// (ETag / Last-Modified / boyut) toplanır, açılıştakiyle karşılaştırılır.
// Uygulama telefonda arka planda açık kalınca kendini yenilemez; öne gelince (en çok 10 dakikada bir) bakar,
// yeni sürüm varsa "Güncelle" düğmeli bir bildirim çıkar. Ayarlar → Uygulama'da elle de denetlenir.
import { toast } from './ui.js';

const KEY = 'vazifedar:surum';         // { print, stamp } — şu an çalışan kodun parmak izi
const RECHECK_MIN = 10;
const listeners = new Set();
let status = { state: 'idle', checkedAt: null, stamp: null, message: '' };
// state: idle | checking | current | available | offline | error | updating

const emit = () => { for (const fn of listeners) fn(status); };
const set = (patch) => { status = { ...status, ...patch }; emit(); };
export function onUpdateStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const updateStatus = () => status;

function saved() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* yok say */ } }

function hash(s) { // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

// Dosya listesi tek yerde: sw.js
async function shellList() {
  const res = await fetch('sw.js', { cache: 'no-store' });
  if (!res.ok) throw new Error(`sw.js alınamadı (${res.status})`);
  const text = await res.text();
  const m = /const SHELL = \[([\s\S]*?)\];/.exec(text);
  const files = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).filter((f) => f !== './') : ['index.html'];
  return { files: ['sw.js', ...files], swText: text };
}

async function fileSig(f, swText) {
  if (f === 'sw.js') return `sw:${hash(swText)}`;
  try {
    const r = await fetch(f, { method: 'HEAD', cache: 'no-store' });
    if (!r.ok) return `${f}:${r.status}`;
    const etag = r.headers.get('etag'), lm = r.headers.get('last-modified'), len = r.headers.get('content-length');
    if (etag || lm) return { sig: `${f}:${etag || ''}:${lm || ''}:${len || ''}`, lm };
  } catch { /* HEAD desteklenmiyorsa içeriğe bak */ }
  const g = await fetch(f, { cache: 'no-store' });
  return `${f}:${hash(await g.text())}`;
}

async function fingerprint() {
  const { files, swText } = await shellList();
  const sigs = await Promise.all(files.map((f) => fileSig(f, swText)));
  let latest = 0;
  const parts = sigs.map((x) => {
    if (typeof x === 'string') return x;
    const t = x.lm ? Date.parse(x.lm) : 0;
    if (t > latest) latest = t;
    return x.sig;
  });
  return { print: hash(parts.join('|')), stamp: latest || null };
}

// Sunucuyla karşılaştır
export async function checkForUpdate({ quiet = false } = {}) {
  if (status.state === 'checking' || status.state === 'updating') return status.state;
  if (!navigator.onLine) { set({ state: 'offline', checkedAt: Date.now(), message: 'İnternet yok' }); return 'offline'; }
  set({ state: 'checking', message: '' });
  try {
    navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    const now = await fingerprint();
    const cur = saved();
    if (!cur) { save(now); set({ state: 'current', checkedAt: Date.now(), stamp: now.stamp }); return 'current'; }
    if (cur.print === now.print) { set({ state: 'current', checkedAt: Date.now(), stamp: cur.stamp || now.stamp }); return 'current'; }
    pending = now;
    set({ state: 'available', checkedAt: Date.now(), stamp: cur.stamp, newStamp: now.stamp });
    if (!quiet) announce();
    return 'available';
  } catch (e) {
    set({ state: 'error', checkedAt: Date.now(), message: e.message || 'Denetlenemedi' });
    return 'error';
  }
}
let pending = null;

function announce() {
  toast('Vazifedar\'ın yeni sürümü hazır', { ms: 60000, action: { label: 'Güncelle', onClick: () => applyUpdate() } });
}

// Bütün dosyaları sunucudan taze al, önbelleği yenile, sayfayı yeniden yükle
export async function applyUpdate() {
  if (!navigator.onLine) { toast('Güncellemek için internet gerekiyor', { kind: 'warn' }); return; }
  set({ state: 'updating' });
  toast('Güncelleniyor…', { ms: 15000 });
  try {
    const target = pending || await fingerprint();
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    const sw = navigator.serviceWorker?.controller;
    if (sw) {
      // Service worker tüm dosyaları sunucudan yeniden indirip önbelleğe yazar (yarıda kalırsa eskisi durur)
      await new Promise((resolve) => {
        const ch = new MessageChannel();
        const t = setTimeout(resolve, 20000);
        ch.port1.onmessage = () => { clearTimeout(t); resolve(); };
        sw.postMessage({ type: 'refresh' }, [ch.port2]);
      });
    }
    save(target);
    try { sessionStorage.setItem('vazifedar:guncellendi', '1'); } catch { /* yok say */ }
    location.reload();
  } catch (e) {
    set({ state: 'error', message: e.message || 'Güncellenemedi' });
    toast(`Güncellenemedi: ${e.message}`, { kind: 'warn', ms: 6000 });
  }
}

// Açılışta ve uygulama öne geldiğinde kendiliğinden bak
export function initUpdates() {
  if (location.protocol === 'file:') return;
  try {
    if (sessionStorage.getItem('vazifedar:guncellendi')) {
      sessionStorage.removeItem('vazifedar:guncellendi');
      setTimeout(() => toast('Vazifedar güncellendi'), 600);
    }
  } catch { /* yok say */ }
  const quietCheck = () => {
    if (document.visibilityState !== 'visible') return;
    if (status.state === 'available') { announce(); return; }
    if (status.checkedAt && Date.now() - status.checkedAt < RECHECK_MIN * 60000) return;
    checkForUpdate();
  };
  setTimeout(quietCheck, 4000);
  document.addEventListener('visibilitychange', quietCheck);
  window.addEventListener('online', () => setTimeout(quietCheck, 2000));
}

// "13 Ekim, 03:42"
export function stampText(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
