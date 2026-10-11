// Uygulama olarak yükleme (PWA): service worker kaydı, "Yükle" düğmesi, bildirimler için SW.
import { h, toast } from './ui.js';

let installEvt = null;
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(); };

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

export function registerSW() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; emit(); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast('Vazifedar uygulama olarak yüklendi'); emit(); });
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'activated' && hadController) toast('Vazifedar güncellendi', { action: { label: 'Yenile', onClick: () => location.reload() }, ms: 12000 });
      });
    });
  }).catch((e) => console.warn('Service worker kaydedilemedi', e));
}

// Android Chrome'da `new Notification()` çalışmaz; bildirim service worker üstünden gösterilir.
export async function showSystemNotification(title, body, tag) {
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, opts); return true; }
  } catch { /* aşağıdakini dene */ }
  try { new Notification(title, opts); return true; } catch { return false; }
}

export function appPanel() {
  const box = h('section', { class: 'panel' });
  const draw = () => {
    const rows = [];
    if (isStandalone()) {
      rows.push(h('p', { class: 'small' }, 'Vazifedar şu an yüklü uygulama olarak açık. İnternet ya da yerel sunucu olmadan da açılır.'));
    } else if (installEvt) {
      rows.push(h('p', { class: 'small' }, isMobile()
        ? 'Ana ekrana ekle: Vazifedar kendi simgesiyle, tarayıcı çubuğu olmadan açılır; internetsiz de çalışır.'
        : 'Bilgisayara yükle: Başlat menüsünden ayrı bir pencerede açılır ve siyah sunucu penceresi olmadan da çalışır.'),
      h('div', { class: 'row' }, h('button', {
        class: 'btn primary', onclick: async () => {
          const e = installEvt; installEvt = null;
          e.prompt();
          await e.userChoice.catch(() => {});
          emit();
        },
      }, isMobile() ? 'Ana ekrana ekle' : 'Uygulama olarak yükle')));
    } else if (isIOS()) {
      rows.push(h('p', { class: 'small' }, 'iPhone/iPad: Safari\'de alttaki Paylaş düğmesine dokun → "Ana Ekrana Ekle".'));
    } else {
      rows.push(h('p', { class: 'small' }, 'Vazifedar\'ı uygulama olarak yüklemek için tarayıcının adres çubuğunun sağındaki "yükle" simgesine ya da menüdeki "Uygulamayı yükle" / "Ana ekrana ekle" seçeneğine bas. Bu seçenek yoksa Vazifedar bu tarayıcıda zaten yüklüdür.'));
    }
    rows.push(h('p', { class: 'muted small' }, 'Not: Veriler adres başınadır. localhost:8080\'de açtığın Vazifedar ile GitHub Pages adresindeki ayrı ayrı veri tutar; birinden ötekine taşımak için Veriler → Yedek indir / Yedekten yükle.'));
    box.replaceChildren(h('h3', {}, 'Uygulama'), ...rows);
  };
  draw();
  const fn = () => { if (box.isConnected) draw(); else listeners.delete(fn); };
  listeners.add(fn);
  return box;
}
