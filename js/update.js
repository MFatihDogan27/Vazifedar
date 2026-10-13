// Güncelleme: sunucudaki (GitHub Pages ya da localhost) dosyalar, bu cihazda çalışanlardan yeni mi?
// Elle sürüm numarası artırmaya gerek yok. sw.js'teki dosya listesindeki her dosya için sunucunun verdiği
// kimlik (ETag / Last-Modified) ile uygulamanın kendi önbelleğindeki kopyanınki karşılaştırılır; önbellekteki
// kopya, şu an çalışan koddur (service worker her açılışta oraya yazar).
// Uygulama telefonda arka planda açık kalınca kendini yenilemez; öne gelince (en çok 10 dakikada bir) bakar,
// yeni sürüm varsa "Güncelle" düğmeli bir bildirim çıkar. Ayarlar → Uygulama'da elle de denetlenir.
import { toast } from './ui.js';

const RECHECK_MIN = 10;
const listeners = new Set();
let status = { state: 'idle', checkedAt: null, stamp: null, newStamp: null, changed: [], message: '' };
// state: idle | checking | current | available | offline | error | updating

const emit = () => { for (const fn of listeners) fn(status); };
const set = (patch) => { status = { ...status, ...patch }; emit(); };
export function onUpdateStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const updateStatus = () => status;

function hash(s) { // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
const idOf = (headers) => headers.get('etag') || headers.get('last-modified') || '';
const timeOf = (headers) => { const t = Date.parse(headers.get('last-modified') || ''); return Number.isNaN(t) ? 0 : t; };

// Dosya listesi tek yerde: sw.js
async function shellList() {
  const res = await fetch('sw.js', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sunucuya ulaşılamadı (${res.status})`);
  const m = /const SHELL = \[([\s\S]*?)\];/.exec(await res.text());
  const files = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  return files.filter((f) => f !== './' && !/\.png$/.test(f));
}

// Sunucudaki kopyanın kimliği (HEAD; kimlik başlığı yoksa içerik özeti)
async function serverSig(f) {
  try {
    const r = await fetch(f, { method: 'HEAD', cache: 'no-store' });
    if (!r.ok) return { id: `yok:${r.status}`, t: 0 };
    const id = idOf(r.headers);
    if (id) return { id, t: timeOf(r.headers) };
  } catch { /* HEAD desteklenmiyorsa aşağıda içeriğe bak */ }
  const g = await fetch(f, { cache: 'no-store' });
  return { id: `#${hash(await g.text())}`, t: timeOf(g.headers), body: true };
}
// Bu cihazda çalışan kopyanın kimliği (uygulama önbelleği)
async function localSig(f, wantBody) {
  const hit = await caches.match(f); // index.html: service worker açılan sayfayı bu adla da saklar
  if (!hit) return { id: 'yok', t: 0 };
  if (wantBody) return { id: `#${hash(await hit.text())}`, t: timeOf(hit.headers) };
  return { id: idOf(hit.headers) || `#${hash(await hit.clone().text())}`, t: timeOf(hit.headers) };
}

// Service worker yoksa (ilk açılış, file://): açılıştaki sunucu durumu = çalışan kod
let baseline = null;

export async function checkForUpdate({ quiet = false } = {}) {
  if (status.state === 'checking' || status.state === 'updating') return status.state;
  if (!navigator.onLine) { set({ state: 'offline', checkedAt: Date.now(), message: 'İnternet yok' }); return 'offline'; }
  set({ state: 'checking', message: '' });
  try {
    navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    const files = await shellList();
    const server = await Promise.all(files.map(serverSig));
    const newStamp = Math.max(0, ...server.map((s) => s.t)) || null;
    let changed = [], stamp = null;
    if ('caches' in window && navigator.serviceWorker?.controller) {
      const local = await Promise.all(files.map((f, i) => localSig(f, server[i].body)));
      changed = files.filter((f, i) => local[i].id !== server[i].id && !server[i].id.startsWith('yok:'));
      stamp = Math.max(0, ...local.map((s) => s.t)) || null;
    } else {
      const print = hash(server.map((s) => s.id).join('|'));
      if (!baseline) baseline = { print, stamp: newStamp };
      if (baseline.print !== print) changed = ['?'];
      stamp = baseline.stamp;
    }
    if (!changed.length) { set({ state: 'current', checkedAt: Date.now(), stamp: stamp || newStamp, newStamp, changed }); return 'current'; }
    set({ state: 'available', checkedAt: Date.now(), stamp, newStamp, changed });
    if (!quiet) announce();
    return 'available';
  } catch (e) {
    set({ state: 'error', checkedAt: Date.now(), message: e.message || 'Denetlenemedi' });
    return 'error';
  }
}

function announce() {
  toast('Yeni sürüm hazır', { ms: 60000, action: { label: 'Güncelle', onClick: () => applyUpdate() } });
}

// Bütün dosyaları sunucudan taze al, önbelleğe yaz, sayfayı yeniden yükle
export async function applyUpdate() {
  if (!navigator.onLine) { toast('Güncellemek için internet gerekiyor', { kind: 'warn' }); return; }
  set({ state: 'updating' });
  toast('Güncelleniyor…', { ms: 20000 });
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    const sw = navigator.serviceWorker?.controller;
    if (sw) {
      // Service worker tüm dosyaları sunucudan yeniden indirir (inemeyen dosyanın eski kopyası kalır)
      await new Promise((resolve) => {
        const ch = new MessageChannel();
        const t = setTimeout(resolve, 20000);
        ch.port1.onmessage = () => { clearTimeout(t); resolve(); };
        sw.postMessage({ type: 'refresh' }, [ch.port2]);
      });
    }
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
  setTimeout(quietCheck, 5000);
  document.addEventListener('visibilitychange', quietCheck);
  window.addEventListener('online', () => setTimeout(quietCheck, 2000));
}

// "13 Ekim 03:42"
export function stampText(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}
