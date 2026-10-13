// Vazifedar — ana uygulama: üst çubuk, gezinme, araç çubuğu, otomatik işler.
import { h, toast } from './ui.js';
import { state, subscribe, dueDate, onSaveError, rollSeries } from './store.js';
import { parseLocal, timeStr, AYLAR, toDateKey, startOfWeek, addDays } from './dates.js';
import { renderWeek, renderMonth, renderAgenda, calendarTitle, shiftAnchor, NARROW_WEEK } from './calendar.js';
import { renderTasks } from './tasks.js';
import { renderCourses } from './courses.js';
import { renderSettings } from './settings.js';
import { renderToday } from './today.js';
import { renderTerm } from './term.js';
import { renderJournal, archiveTick, focusDay, selectedDay } from './journal.js';
import { openNoteForm } from './notes.js';
import { injectTextureCSS } from './themes.js';
import { openEventForm, openTaskForm } from './forms.js';
import { mountQuickAdd } from './qa-ui.js';
import { mountSearch } from './search.js';
import { applyTheme as applyPalette, watchSystemTheme } from './theme.js';
import * as G from './google.js';
import { startReminderLoop } from './notify.js';
import { initBackup, downloadBackup } from './backup.js';
import { registerSW } from './pwa.js';
import { initUpdates } from './update.js';
import { openOnboarding } from './onboarding.js';

const CLOUD_REASONS = new Set(['tasks', 'courses', 'notes', 'journal', 'archive', 'settings', 'import']);
const UI_KEY = 'vazifedar:ui2';
const ui = (() => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch { /* yok say */ }
  return { view: saved.view || 'today', mode: saved.mode || 'week', anchor: new Date() };
})();
function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ view: ui.view, mode: ui.mode })); } catch { /* yok say */ } }

const $ = (s) => document.querySelector(s);
const viewEl = $('#view');
const toolbarEl = $('#toolbar');
const qaSlot = $('#qa-slot');
const quickAdd = mountQuickAdd(qaSlot);
// Arama: bir sonuca tıklayınca ilgili pencere açılır; takvim simgesi o tarihe, defter sonucu o güne götürür
const search = mountSearch($('#search-slot'), {
  onDay: (k) => { focusDay(k); ui.view = 'defter'; saveUi(); render(); },
  onDate: (d) => { ui.view = 'calendar'; if (ui.mode === 'month' || ui.mode === 'agenda') ui.mode = 'week'; ui.anchor = new Date(d); saveUi(); render(); },
});

const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  term: '<path d="M2.5 15l4-6 4 4 4-8 5 10"/><path d="M2.5 20h19"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>',
  courses: '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5M21.5 9v6"/>',
  defter: '<path d="M5.5 3.5h11a2 2 0 0 1 2 2v15h-11a2 2 0 0 1-2-2z"/><path d="M5.5 18.5a2 2 0 0 1 2-2h11M9 7.5h6M9 10.5h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};
const icon = (id) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.classList.add('nav-ic');
  s.innerHTML = ICONS[id];
  return s;
};
const VIEWS = [
  { id: 'today', name: 'Bugün', short: 'Bugün' },
  { id: 'calendar', name: 'Takvim', short: 'Takvim' },
  { id: 'tasks', name: 'Görevler', short: 'Görevler' },
  { id: 'defter', name: 'Defter', short: 'Defter' },
  { id: 'courses', name: 'Ders programı', short: 'Dersler' },
  { id: 'term', name: 'Dönem haritası', short: 'Dönem' },
  { id: 'settings', name: 'Ayarlar', short: 'Ayarlar' },
];

function setView(v) { ui.view = v; saveUi(); render(); }

function renderNav() {
  const openTasks = state.tasks.filter((t) => !t.done).length;
  for (const nav of document.querySelectorAll('.nav')) {
    nav.replaceChildren(...VIEWS.map((v) => h('button', {
      class: `nav-btn ${ui.view === v.id ? 'on' : ''}`, 'aria-current': ui.view === v.id ? 'page' : null,
      onclick: () => setView(v.id),
    }, icon(v.id), h('span', { class: 'nav-tx' }, v.short),
    v.id === 'tasks' && openTasks ? h('span', { class: 'badge' }, openTasks) : null)));
  }
}

function renderToolbar() {
  if (ui.view === 'calendar') {
    const seg = h('div', { class: 'seg', title: 'Ctrl + tekerlek ya da + / − ile yakınlaş/uzaklaş: Dönem ⇄ Ay ⇄ Hafta ⇄ Gün' }, [['month', 'Ay'], ['week', 'Hafta'], ['agenda', 'Ajanda']].map(([m, l]) => h('button', {
      class: `seg-btn ${ui.mode === m ? 'on' : ''}`, onclick: () => { ui.mode = m; saveUi(); render(); },
    }, l)));
    toolbarEl.replaceChildren(
      h('div', { class: 'tb-left' },
        h('button', { class: 'btn', onclick: () => { ui.anchor = new Date(); render(); } }, 'Bugün'),
        h('div', { class: 'nav-arrows' },
          h('button', { class: 'icon-btn', 'aria-label': 'Önceki', onclick: () => { ui.anchor = shiftAnchor(ui.mode, ui.anchor, -1); render(); } }, '‹'),
          h('button', { class: 'icon-btn', 'aria-label': 'Sonraki', onclick: () => { ui.anchor = shiftAnchor(ui.mode, ui.anchor, 1); render(); } }, '›')),
        h('h1', { class: 'tb-title' }, calendarTitle(ui.mode, ui.anchor))),
      h('div', { class: 'tb-right' }, seg, h('button', { class: 'btn primary', onclick: () => openEventForm({}) }, '+ Plan ekle')));
  } else if (ui.view === 'tasks') {
    const open = state.tasks.filter((t) => !t.done).length;
    toolbarEl.replaceChildren(
      h('div', { class: 'tb-left' }, h('h1', { class: 'tb-title' }, 'Görevler'), h('span', { class: 'muted' }, `${open} açık görev`)),
      h('div', { class: 'tb-right' }, h('button', { class: 'btn primary', onclick: () => openTaskForm() }, '+ Görev ekle')));
  } else if (ui.view === 'today') {
    toolbarEl.replaceChildren();
  } else if (ui.view === 'term') {
    toolbarEl.replaceChildren(h('div', { class: 'tb-left' }, h('h1', { class: 'tb-title' }, 'Dönem haritası')),
      h('div', { class: 'tb-right' }, h('button', { class: 'btn', onclick: () => setView('courses') }, 'Dönem tarihleri ve tatiller')));
  } else if (ui.view === 'defter') {
    toolbarEl.replaceChildren(
      h('div', { class: 'tb-left' }, h('h1', { class: 'tb-title' }, 'Defter'), h('span', { class: 'muted tb-sub' }, 'Kadran arşivi, günlük ve unutma notları')),
      h('div', { class: 'tb-right' }, h('button', { class: 'btn primary', onclick: () => openNoteForm(null) }, '+ Unutma notu')));
  } else if (ui.view === 'courses') {
    toolbarEl.replaceChildren(h('div', { class: 'tb-left' }, h('h1', { class: 'tb-title' }, 'Ders programı')));
  } else {
    toolbarEl.replaceChildren(h('div', { class: 'tb-left' }, h('h1', { class: 'tb-title' }, 'Ayarlar')));
  }
}

function renderMain() {
  viewEl.dataset.view = ui.view;
  toolbarEl.hidden = ui.view === 'today';
  qaSlot.classList.toggle('off', ui.view === 'tasks');
  if (ui.view === 'calendar') {
    if (ui.mode === 'month') renderMonth(viewEl, ui.anchor, { onDayOpen: (d, ev) => zoom('in', ev, () => { ui.anchor = d; ui.mode = 'week'; saveUi(); render(); }) });
    else if (ui.mode === 'agenda') renderAgenda(viewEl, ui.anchor);
    else renderWeek(viewEl, ui.anchor);
  } else if (ui.view === 'today') renderToday(viewEl, { onWeek: () => { ui.view = 'calendar'; ui.mode = 'week'; ui.anchor = new Date(); saveUi(); render(); }, onCourses: () => setView('courses'), onTasks: () => setView('tasks'), onJournal: () => setView('defter') });
  else if (ui.view === 'term') renderTerm(viewEl, { onGoCourses: () => setView('courses') });
  else if (ui.view === 'tasks') renderTasks(viewEl);
  else if (ui.view === 'defter') renderJournal(viewEl);
  else if (ui.view === 'courses') renderCourses(viewEl);
  else renderSettings(viewEl);
}

function renderSync(st = G.getStatus()) {
  const el = $('#side-sync');
  const s = state.settings;
  if (!s.googleClientId) {
    el.replaceChildren(h('button', { class: 'sync-btn', title: 'Google Takvim bağlı değil — Ayarlar\'dan bağlanabilirsin', onclick: () => setView('settings') }, h('span', { class: 'dot' }), h('span', { class: 'sync-tx' }, 'Google bağlı değil')));
    return;
  }
  const label = {
    syncing: 'Eşitleniyor…',
    'needs-auth': 'Yeniden bağlan',
    error: 'Eşitleme hatası — tekrar dene',
    idle: s.lastSync ? `Eşitlendi ${timeStr(new Date(s.lastSync))}` : 'Eşitle',
    off: s.googleConnected ? 'Eşitle' : 'Google ile bağlan',
  }[st.state] || 'Eşitle';
  const cls = { syncing: 'busy', 'needs-auth': 'warn', error: 'err', idle: 'ok', off: '' }[st.state] || '';
  el.replaceChildren(h('button', {
    class: `sync-btn ${cls}`, title: st.message || '', disabled: st.state === 'syncing',
    onclick: () => G.sync({ interactive: true }).then((ok) => { if (ok) toast('Google Takvim ile eşitlendi'); }),
  }, h('span', { class: 'dot' }), h('span', { class: 'sync-tx' }, label)));
}

function applyTheme() { applyPalette(state.settings); }
watchSystemTheme(() => state.settings);

function render() {
  renderNav(); renderToolbar(); renderMain(); renderSync();
}

// ---------- Olaylar ----------
subscribe((reason, opts) => {
  applyTheme();
  if (opts?.pushGoogle && state.settings.googleConnected) {
    if (G.hasToken()) G.schedulePush();
  }
  // Görev, ders, not, defter değişiklikleri Google Drive üzerinden diğer cihazlara
  if (CLOUD_REASONS.has(reason)) G.scheduleCloud();
  // Ayarlar sayfasında yazarken sayfa yeniden çizilmesin
  if (reason === 'settings' && ui.view === 'settings') { renderSync(); return; }
  // Defter yazısı yalnız kaydedilir; yazarken sayfa yeniden çizilmez
  if (reason === 'journal') return;
  render();
});
G.onStatus((st) => renderSync(st));

// Tarayıcıya kaydedilemedi (depolama dolu ya da kapalı): sessizce kaybolmasın, yedek indirmeyi öner
let saveWarnAt = 0;
onSaveError(() => {
  if (Date.now() - saveWarnAt < 60000) return;
  saveWarnAt = Date.now();
  toast('Değişiklik bu cihaza kaydedilemedi: tarayıcı depolaması dolu ya da kapalı. Kaybolmasın diye yedek indir.', {
    kind: 'warn', ms: 15000, action: { label: 'Yedek indir', onClick: downloadBackup },
  });
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('.overlay')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); if (ui.view === 'tasks') openTaskForm(); else openEventForm({}); }
  else if (e.key === '/' && ui.view !== 'tasks') { e.preventDefault(); quickAdd.focus(); }
  else if (k === 'g') { e.preventDefault(); openTaskForm(); }
  else if (k === 'f') { e.preventDefault(); search.open(); }
  else if (ui.view === 'calendar' && k === 't') { ui.anchor = new Date(); render(); }
  else if (ui.view === 'calendar' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { ui.anchor = shiftAnchor(ui.mode, ui.anchor, e.key === 'ArrowLeft' ? -1 : 1); render(); }
  else if (ui.view === 'calendar' && ['a', 'h', 'j'].includes(k)) { ui.mode = { a: 'month', h: 'week', j: 'agenda' }[k]; saveUi(); render(); }
  else if ((e.key === '+' || e.key === '-') && ZOOMABLE.includes(ui.view)) { e.preventDefault(); stepZoom(e.key === '+' ? 'in' : 'out', null); }
});

// ---------- Yakınlaştırarak gezinme: Dönem ⇄ Ay ⇄ Hafta ⇄ Gün (Defter) ----------
// Ctrl + fare tekerleği (dokunmatik yüzeyde iki parmakla kıstırma) ya da + / − tuşları.
// Ay karosu büyüyüp haftaya, hafta sütunu o günün kadranına (Defter sayfası) dönüşür.
const ZOOMABLE = ['calendar', 'term', 'defter'];
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function zoom(dir, pt, apply) {
  const r = viewEl.getBoundingClientRect();
  const de = document.documentElement;
  const has = pt && typeof pt.clientX === 'number' && (pt.clientX || pt.clientY);
  de.style.setProperty('--zx', `${has ? pt.clientX - r.left : r.width / 2}px`);
  de.style.setProperty('--zy', `${has ? pt.clientY - r.top : Math.min(r.height, window.innerHeight) / 2}px`);
  if (!document.startViewTransition || reduceMotion()) { apply(); return; }
  de.dataset.zoom = dir;
  const t = document.startViewTransition(apply);
  t.finished.finally(() => { delete de.dataset.zoom; });
}
function stepZoom(dir, ev) {
  const hit = ev && typeof ev.clientX === 'number' ? document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-date]') : null;
  const at = hit?.dataset.date || null;
  const go = (fn) => zoom(dir, ev, () => { fn(); saveUi(); render(); });
  if (ui.view === 'term') { if (dir === 'in') go(() => { ui.view = 'calendar'; ui.mode = 'month'; }); return; }
  if (ui.view === 'defter') {
    if (dir === 'out') go(() => { ui.view = 'calendar'; ui.mode = 'week'; ui.anchor = parseLocal(selectedDay()); });
    return;
  }
  if (ui.mode === 'month') {
    if (dir === 'in') go(() => { ui.mode = 'week'; if (at) ui.anchor = parseLocal(at); });
    else go(() => { ui.view = 'term'; });
  } else if (ui.mode === 'week') {
    if (dir === 'in') {
      const ws = startOfWeek(ui.anchor), now = new Date();
      const k = at || toDateKey(now >= ws && now < addDays(ws, 7) ? now : ws);
      go(() => { focusDay(k); ui.view = 'defter'; });
    } else go(() => { ui.mode = 'month'; });
  } else if (dir === 'in') go(() => { ui.mode = 'week'; if (at) ui.anchor = parseLocal(at); });
  else go(() => { ui.mode = 'month'; });
}
let wheelAcc = 0, wheelLock = 0;
viewEl.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey) || !ZOOMABLE.includes(ui.view)) return;
  e.preventDefault();
  if (document.querySelector('.overlay') || Date.now() < wheelLock) return;
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) < 40) return;
  const dir = wheelAcc < 0 ? 'in' : 'out';
  wheelAcc = 0; wheelLock = Date.now() + 600;
  stepZoom(dir, e);
}, { passive: false });

// "Şimdi" çizgisini ve geri sayımı tazele (Bugün ve haftalık takvim)
function refreshLive() {
  archiveTick(); // gün dönünce önceki günün kadranını arşive al (eksik gün yoksa bir şey yapmaz)
  // Bir kutuya yazarken ekranı yenileme (yazı ve imleç kaybolmasın)
  const ae = document.activeElement;
  if (ae && viewEl.contains(ae) && ae.matches('input, textarea, select')) return;
  if (rollSeries()) return; // tarihi geçen tekrarlayan görevin sıradakini ekledi (commit ekranı yeniden çizdi)
  if (ui.view === 'today' && !document.querySelector('.overlay')) renderMain();
  else if (ui.view === 'calendar' && ui.mode === 'week' && !document.querySelector('.overlay')) {
    const sc = document.querySelector('.wk-scroll'); const top = sc?.scrollTop;
    renderMain(); const sc2 = document.querySelector('.wk-scroll'); if (sc2 && top !== undefined) requestAnimationFrame(() => { sc2.scrollTop = top; });
  }
}
// Her dakika
let lastMinute = -1;
setInterval(() => {
  const m = new Date().getMinutes();
  if (m === lastMinute) return;
  lastMinute = m;
  refreshLive();
}, 20000);

// Otomatik Google eşitleme
let lastAuto = 0;
function autoSync() {
  const s = state.settings;
  if (!s.googleConnected || !s.autoSyncMin || !G.hasToken()) return;
  if (Date.now() - lastAuto < s.autoSyncMin * 60000) return;
  lastAuto = Date.now();
  G.sync();
}
setInterval(autoSync, 60000);

// Uygulamaya geri dönünce (telefonda arka plandan, bilgisayarda başka pencereden): ekranı tazele,
// eşitle. Telefona yüklü uygulamada "focus" güvenilir gelmez; görünürlük değişimi ve sayfa geri
// yüklenmesi (pageshow) de dinlenir. Aynı dönüşte birden çok olay gelirse bir kez çalışır.
let lastReturn = 0;
function onReturn() {
  if (Date.now() - lastReturn < 2000) return;
  lastReturn = Date.now();
  refreshLive();
  const s = state.settings;
  if (!s.googleConnected) return;
  if (!G.hasToken()) { renderSync({ state: 'needs-auth', message: 'Google oturumu yenilenmeli' }); return; }
  if (Date.now() - lastAuto > 2 * 60000) { lastAuto = Date.now(); G.sync(); }
}
window.addEventListener('focus', onReturn);
// Telefon ⇄ geniş ekran (ya da telefon yan çevrilince): haftalık görünüm sığdığı düzende yeniden çizilsin
window.matchMedia?.(NARROW_WEEK).addEventListener?.('change', () => { if (ui.view === 'calendar' && ui.mode === 'week') renderMain(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onReturn(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) onReturn(); });

// Google oturumu düştüyse (yaklaşık saatte bir; telefonda uygulama her açıldığında) "Yeniden bağlan"a
// basmayı beklemeden uygulamadaki ilk dokunuşta yenile. Tarayıcılar Google penceresini yalnız bir
// dokunuşla açtırır; izin daha önce verildiği için pencere bir an açılıp kendiliğinden kapanır.
let reauthAt = 0;
document.addEventListener('click', (e) => {
  const s = state.settings;
  if (!s.googleConnected || !s.googleClientId || s.autoReauth === false || G.hasToken() || G.needsConsent()) return;
  if (!window.google?.accounts?.oauth2) return; // Google betiği yüklenmeden açılan pencere engellenir
  // Eşitleme düğmesi ve Google ayarları kendi işini yapsın ("Bağlantıyı kes" yanlışlıkla bağlamasın)
  if (e.target.closest?.('#side-sync, .g-card, .cloud-block, [data-no-reauth]')) return;
  if (Date.now() - reauthAt < 10 * 60000) return; // pencere kapatıldıysa ısrar etme
  reauthAt = Date.now();
  G.sync({ interactive: true });
}, true);

// ---------- Başlat ----------
applyTheme();
injectTextureCSS();
archiveTick();
rollSeries(); // açılışta tarihi geçen tekrarlayan görevlerin sıradakini ekle
// Uygulama kısayolları (yüklü uygulamanın simgesine sağ tık / uzun bas): ?bolum=tasks, ?yeni=plan|gorev
const params = new URLSearchParams(location.search);
const wantView = params.get('bolum');
if (wantView && VIEWS.some((v) => v.id === wantView)) { ui.view = wantView; saveUi(); }
render();
const wantNew = params.get('yeni');
if (wantNew === 'plan') openEventForm({});
else if (wantNew === 'gorev') openTaskForm();
if (params.has('bolum') || params.has('yeni')) history.replaceState(null, '', location.pathname);
// Yeni kullanıcı: ilk açılış kurulumu (şehir, plan türleri, dönem)
if (!state.settings.onboarded && !wantNew) openOnboarding(setView);
startReminderLoop();
initBackup();
registerSW();
initUpdates();
if (state.settings.googleClientId) {
  G.loadGis().catch(() => {});
  if (state.settings.googleConnected) {
    if (G.hasToken()) { lastAuto = Date.now(); G.sync(); } else renderSync({ state: 'needs-auth', message: 'Google oturumu yenilenmeli' });
  }
}
document.getElementById('boot')?.remove();
// Konsoldan erişim (hata ayıklama için)
window.vazifedar = { state, ui, G, AYLAR, parseLocal, dueDate };
