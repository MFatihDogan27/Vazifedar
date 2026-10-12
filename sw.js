// Vazifedar service worker: uygulamayı çevrimdışı (ve yerel sunucu kapalıyken) açılabilir kılar.
// Strateji: önce ağ (sunucu/internet varsa her zaman en yeni dosyalar), olmazsa son kaydedilen kopya.
// Yeni bir dosya eklenirse SHELL listesine de ekle (eklenmese bile ilk çevrimiçi açılışta önbelleğe girer).
const VERSION = '2026-10-12';
const CACHE = `vazifedar-${VERSION}`;
const FONTS = 'vazifedar-fonts';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  'css/style.css', 'css/takvim.css',
  'js/app.js', 'js/backup.js', 'js/calendar.js', 'js/cloud.js', 'js/courses.js', 'js/dates.js', 'js/forms.js', 'js/google.js',
  'js/hicri.js', 'js/icons.js', 'js/journal.js', 'js/notes.js', 'js/notify.js', 'js/prayer.js', 'js/pwa.js',
  'js/qa-ui.js', 'js/quickadd.js', 'js/recurrence.js', 'js/settings.js', 'js/store.js', 'js/tasks.js',
  'js/term.js', 'js/theme.js', 'js/themes.js', 'js/today.js', 'js/ui.js',
];
const NET_TIMEOUT = 3500;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Biri eksik olsa da diğerleri önbelleğe girsin
    await Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('vazifedar-') && k !== CACHE && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), timeout(NET_TIMEOUT)]);
    if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
    return res;
  } catch {
    const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' })
      || (req.mode === 'navigate' ? (await c.match('index.html')) || (await c.match('./')) : null);
    if (hit) return hit;
    return new Response('Çevrimdışı', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(req) {
  const c = await caches.open(FONTS);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  } catch { return new Response('', { status: 504 }); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req)); return; }
  // Google girişi ve Takvim API'si: hiç dokunma
});

// Bildirime tıklayınca açık pencereyi öne getir, yoksa uygulamayı aç
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = all.find((w) => new URL(w.url).origin === self.location.origin);
    if (win) return win.focus();
    return self.clients.openWindow('./');
  })());
});
