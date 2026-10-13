// Ayarlar: üstte hazırlık kadranı (eşitleme, yedek, bildirim, uygulama), solda bölüm listesi
// (her bölümün canlı özetiyle), sağda bölümler.
import { h, toast, field, confirmDialog, onColor } from './ui.js';
import { state, commit, uid, PALET, replaceState, resetState, subscribe } from './store.js';
import { timeStr } from './dates.js';
import * as G from './google.js';
import { permission, requestPermission } from './notify.js';
import { ic, ICON_CHOICES, ICON_NAMES } from './icons.js';
import { PALETTES, PALETTE_ALIAS } from './theme.js';
import { VAKITLER, ILLER, timesFor } from './prayer.js';
import { backupPanel, downloadBackup, backupStatus, onBackupChange, chooseFolder, ago } from './backup.js';
import { appPanel, isStandalone } from './pwa.js';
import { checkForUpdate, applyUpdate, updateStatus, onUpdateStatus, stampText } from './update.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  return el;
};
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pad2 = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// Küçük parçalar
// ---------------------------------------------------------------------------
// Açma/kapama anahtarı (görünüşü CSS'te; altta yine bir onay kutusu)
function toggle(checked, onChange, label, { disabled = false } = {}) {
  const box = h('input', { type: 'checkbox', role: 'switch', checked: !!checked, disabled });
  box.onchange = () => onChange(box.checked);
  return { el: h('label', { class: 'switch' }, box, label ? h('span', {}, label) : null), box };
}
// Seçenek düğmeleri (Açık / Koyu …)
function segmented(options, value, onChange, ariaLabel) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': ariaLabel });
  const draw = (v) => wrap.replaceChildren(...options.map(([val, label, icon]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(v === val), class: `seg-btn ${v === val ? 'on' : ''}`,
    onclick: () => { draw(val); onChange(val); },
  }, icon ? ic(icon, { size: 15 }) : null, label)));
  draw(value);
  return wrap;
}
function section(id, icon, title, body, { right = null, lead = '' } = {}) {
  return h('section', { class: 'set-sec', id: `ayar-${id}`, dataset: { sec: id }, 'aria-labelledby': `ayar-${id}-h` },
    h('header', { class: 'set-head' },
      h('span', { class: 'set-ic', 'aria-hidden': 'true' }, ic(icon, { size: 19 })),
      h('div', { class: 'set-ht' }, h('h2', { id: `ayar-${id}-h` }, title), lead ? h('p', {}, lead) : null),
      right),
    h('div', { class: 'set-body' }, body));
}
function scrollToSec(id) {
  const el = document.getElementById(`ayar-${id}`);
  el?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Hazırlık: dört şey yolundaysa Vazifedar kendi başına iş görür
// ---------------------------------------------------------------------------
function readiness() {
  const s = state.settings;
  const items = [];
  // Google
  if (s.googleConnected && G.hasToken()) items.push({ id: 'google', ok: true, name: 'Google eşitleme', tx: s.lastSync ? `Son eşitleme ${ago(s.lastSync)}` : 'Bağlı' });
  else if (s.googleConnected) items.push({ id: 'google', ok: false, name: 'Google eşitleme', tx: 'Oturum yenilenmeli', act: 'Yeniden bağlan', run: () => G.sync({ interactive: true }) });
  else items.push({ id: 'google', ok: false, name: 'Google eşitleme', tx: 'Bağlı değil; planlar telefona gitmez', act: 'Bağla', run: () => scrollToSec('google') });
  // Yedek
  const b = backupStatus();
  if (b.supported && b.folder && b.perm === 'granted') items.push({ id: 'veri', ok: true, name: 'Otomatik yedek', tx: `${b.folder} · son yedek ${ago(b.lastAt)}` });
  else if (b.supported && b.folder) items.push({ id: 'veri', ok: false, name: 'Otomatik yedek', tx: b.perm === 'missing' ? 'Klasör bulunamadı' : 'Klasör izni bekliyor', act: 'Düzelt', run: () => scrollToSec('veri') });
  else if (b.supported) items.push({ id: 'veri', ok: false, name: 'Otomatik yedek', tx: 'Yedek klasörü seçilmedi', act: 'Klasör seç', run: () => chooseFolder() });
  else {
    const fresh = b.lastAt && Date.now() - new Date(b.lastAt) < 7 * 86400000;
    items.push({ id: 'veri', ok: !!fresh, name: 'Yedek', tx: `Son yedek ${ago(b.lastAt)}`, act: fresh ? '' : 'Yedek indir', run: () => downloadBackup() });
  }
  // Bildirimler
  const perm = permission();
  if (perm !== 'unsupported') {
    if (perm === 'granted') items.push({ id: 'hatirlatma', ok: true, name: 'Bildirimler', tx: 'Açık' });
    else if (perm === 'denied') items.push({ id: 'hatirlatma', ok: false, name: 'Bildirimler', tx: 'Tarayıcıda engelli; adres çubuğundaki kilitten aç' });
    else items.push({ id: 'hatirlatma', ok: false, name: 'Bildirimler', tx: 'Hatırlatmalar sessiz kalır', act: 'İzin ver', run: async () => { await requestPermission(); live?.(); } });
  }
  // Uygulama
  items.push(isStandalone()
    ? { id: 'uygulama', ok: true, name: 'Uygulama', tx: 'Yüklü; internetsiz de açılır' }
    : { id: 'uygulama', ok: false, name: 'Uygulama', tx: 'Tarayıcı sekmesinde açık', act: 'Nasıl?', run: () => scrollToSec('uygulama') });
  return items;
}

function readinessRing(items) {
  const n = items.length, gap = 20, r = 46, cx = 60, cy = 60;
  const s = svg('svg', { viewBox: '0 0 120 120', class: 'rd-ring', 'aria-hidden': 'true' });
  s.append(svg('circle', { cx, cy, r: r + 9, class: 'rd-face' }));
  items.forEach((it, i) => {
    const a0 = (i / n) * 360 + gap / 2, a1 = ((i + 1) / n) * 360 - gap / 2;
    const p = (a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    s.append(svg('path', { d: `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`, class: `rd-seg ${it.ok ? 'ok' : ''}` }));
  });
  const done = items.filter((x) => x.ok).length;
  const t = svg('text', { x: cx, y: cy + 2, class: 'rd-num', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
  t.textContent = `${done}/${n}`;
  s.append(t);
  return s;
}

function readinessBlock() {
  const box = h('div', { class: 'rd' });
  const draw = () => {
    const items = readiness();
    const done = items.filter((x) => x.ok).length;
    const head = done === items.length ? 'Her şey yerinde' : done === 0 ? 'Vazifedar henüz yalnız bu sekmede yaşıyor' : `${items.length - done} şey eksik`;
    const sub = done === items.length
      ? 'Planların eşitleniyor, yedeğin alınıyor, hatırlatmalar sana ulaşıyor.'
      : 'Bunlar tamamlanınca verilerin kaybolmaz, telefonda da görünür ve hatırlatmalar sana ulaşır.';
    box.replaceChildren(
      h('div', { class: 'rd-dial' }, readinessRing(items)),
      h('div', { class: 'rd-main' },
        h('h2', { class: 'rd-title' }, head),
        h('p', { class: 'rd-sub' }, sub),
        h('ul', { class: 'rd-list' }, items.map((it) => h('li', { class: `rd-item ${it.ok ? 'ok' : ''}` },
          h('span', { class: 'rd-mark', 'aria-hidden': 'true' }, it.ok ? ic('tick', { size: 14 }) : null),
          h('button', { type: 'button', class: 'rd-name', onclick: () => scrollToSec(it.id) }, it.name),
          h('span', { class: 'rd-tx' }, it.tx),
          it.act ? h('button', { type: 'button', class: 'rd-act', onclick: () => it.run() }, it.act) : null)))));
  };
  draw();
  return { el: box, draw };
}

// ---------------------------------------------------------------------------
// Bölüm listesi (canlı özetlerle)
// ---------------------------------------------------------------------------
const THEME_NAMES = { auto: 'Sistemle aynı', light: 'Açık', dark: 'Koyu' };
const SECTIONS = [
  { id: 'google', icon: 'calendar', name: 'Google Takvim', sum: () => {
    const s = state.settings;
    if (!s.googleClientId) return 'Kurulmadı';
    if (!s.googleConnected) return 'Bağlı değil';
    return G.hasToken() ? `Bağlı · ${s.autoSyncMin ? `${s.autoSyncMin} dk'da bir` : 'elle'}` : 'Oturum yenilenmeli';
  } },
  { id: 'gorunum', icon: 'palette', name: 'Görünüm', sum: () => {
    const s = state.settings; const id = PALETTE_ALIAS[s.palette] || s.palette;
    return `${s.accent ? 'Kendi rengin' : PALETTES[id]?.name || 'Firuze'} · ${THEME_NAMES[s.theme] || 'Sistemle aynı'}`;
  } },
  { id: 'saatler', icon: 'clock', name: 'Gün saatleri', sum: () => {
    const s = state.settings;
    return `Takvim ${pad2(s.dayStartHour)}–${pad2(s.dayEndHour)} · görev ${(s.freeSlotStart || '09:00').slice(0, 2)}–${(s.freeSlotEnd || '22:00').slice(0, 2)}`;
  } },
  { id: 'hatirlatma', icon: 'bell', name: 'Hatırlatmalar', sum: () => {
    const p = state.settings.pins;
    return `Çanta ${p.showFrom || '18:00'} · ${p.notify === false ? 'bildirim kapalı' : `bildirim ${p.notifyAt || '21:00'}`}`;
  } },
  { id: 'namaz', icon: 'moon', name: 'Namaz vakitleri', sum: () => (state.settings.prayer.enabled ? state.settings.prayer.city || 'Konumum' : 'Kapalı') },
  { id: 'kategori', icon: 'star', name: 'Kategoriler', sum: () => `${state.categories.length} plan · ${state.taskCategories.length} görev türü` },
  { id: 'veri', icon: 'archive', name: 'Veriler ve yedek', sum: () => `Son yedek ${ago(backupStatus().lastAt)}` },
  { id: 'uygulama', icon: 'device', name: 'Uygulama', sum: () => `${isStandalone() ? 'Yüklü' : 'Tarayıcıda'} · ${updateStatus().state === 'available' ? 'yeni sürüm var' : updateStatus().state === 'current' ? 'güncel' : 'sürüm'}` },
];

function rail() {
  const nav = h('nav', { class: 'set-rail', 'aria-label': 'Ayar bölümleri' });
  const items = SECTIONS.map((s) => {
    const sum = h('span', { class: 'rail-s' });
    const btn = h('button', { type: 'button', class: 'rail-btn', dataset: { sec: s.id }, onclick: () => scrollToSec(s.id) },
      h('span', { class: 'rail-ic', 'aria-hidden': 'true' }, ic(s.icon, { size: 17 })),
      h('span', { class: 'rail-tx' }, h('span', { class: 'rail-n' }, s.name), sum));
    return { s, btn, sum };
  });
  nav.append(...items.map((x) => x.btn));
  const draw = () => { for (const x of items) x.sum.textContent = x.s.sum(); };
  const setActive = (id) => {
    for (const x of items) {
      const on = x.s.id === id;
      x.btn.classList.toggle('on', on);
      if (on) x.btn.setAttribute('aria-current', 'true'); else x.btn.removeAttribute('aria-current');
      if (on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: x.btn.offsetLeft - 16, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  };
  draw();
  return { el: nav, draw, setActive };
}

// ---------------------------------------------------------------------------
// Google Takvim
// ---------------------------------------------------------------------------
function googleSection(rerender) {
  const s = state.settings;
  const cid = h('input', { type: 'text', value: s.googleClientId, placeholder: '1234…-abc.apps.googleusercontent.com', spellcheck: 'false' });
  const st = G.getStatus();
  const connected = s.googleConnected;
  const saveCid = h('button', { class: 'btn', onclick: () => { s.googleClientId = cid.value.trim(); commit('settings'); toast('İstemci kimliği kaydedildi'); if (s.googleClientId) G.loadGis().catch(() => {}); rerender(); } }, 'Kaydet');

  const origin = location.origin;
  const help = h('details', { class: 'help' },
    h('summary', {}, 'Google bağlantısı nasıl kurulur? (bir kerelik, ~5 dakika)'),
    h('ol', {},
      h('li', {}, h('a', { href: 'https://console.cloud.google.com/projectcreate', target: '_blank', rel: 'noopener' }, 'Google Cloud Console'), '\'da yeni bir proje oluştur (ör. "Vazifedar").'),
      h('li', {}, h('a', { href: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com', target: '_blank', rel: 'noopener' }, 'Google Calendar API'), '\'yi ve ', h('a', { href: 'https://console.cloud.google.com/apis/library/drive.googleapis.com', target: '_blank', rel: 'noopener' }, 'Google Drive API'), '\'yi etkinleştir (Drive, görevlerin ve ders programının cihazlar arasında eşitlenmesi için).'),
      h('li', {}, '"Google Auth Platform" (OAuth izin ekranı) bölümünde uygulamayı "External" olarak yapılandır; "Audience / Test users" kısmına kendi Gmail adresini ekle.'),
      h('li', {}, '"Clients" (Kimlik bilgileri) bölümünde yeni bir ', h('strong', {}, 'OAuth istemci kimliği'), ' oluştur, tür: "Web application".'),
      h('li', {}, '"Authorized JavaScript origins" alanına şunu ekle: ', h('code', {}, origin)),
      h('li', {}, 'Oluşan istemci kimliğini (…apps.googleusercontent.com) kutuya yapıştır, Kaydet\'e ve ardından Bağlan\'a bas.')),
    h('p', { class: 'muted small' }, 'Uygulama "test" modunda kaldığı sürece Google her 7 günde bir yeniden giriş isteyebilir; bu normaldir. Verilerin hiçbir sunucuya gitmez, tarayıcın doğrudan Google ile konuşur.'));

  if (!s.googleClientId) {
    return section('google', 'calendar', 'Google Takvim', [
      h('p', { class: 'small' }, 'Planların Google Takvim\'e, görevlerin ve ders programın Drive\'a gider; telefondaki takvimde de görünür. Bunun için bir kez istemci kimliği oluşturman gerekiyor.'),
      h('div', { class: 'row grow' }, field('OAuth istemci kimliği', cid), saveCid),
      help,
    ], { lead: 'Bağlı değil' });
  }

  const calSel = h('select', { disabled: !G.hasToken() }, h('option', { value: s.googleCalendarId }, s.googleCalendarName || (s.googleCalendarId === 'primary' ? 'Birincil takvim' : s.googleCalendarId)));
  if (G.hasToken()) {
    G.listCalendars().then((cals) => {
      calSel.replaceChildren(...cals.map((c) => h('option', { value: c.primary ? 'primary' : c.id }, c.primary ? `${c.name} (birincil)` : c.name)));
      calSel.value = s.googleCalendarId;
    }).catch(() => {});
  }
  calSel.onchange = async () => {
    const name = calSel.selectedOptions[0]?.textContent;
    if (!await confirmDialog({ title: 'Takvim değiştirilsin mi?', message: 'Eski takvimden gelen planlar Vazifedar\'dan kaldırılır, kendi eklediğin planlar yeni takvime gönderilir.', okLabel: 'Değiştir' })) { calSel.value = s.googleCalendarId; return; }
    G.setCalendar(calSel.value, name);
    G.sync({ interactive: true }).then(() => rerender());
  };
  const autoSel = h('select', {}, [[0, 'Kapalı'], [5, '5 dakikada bir'], [10, '10 dakikada bir'], [30, '30 dakikada bir']].map(([v, l]) => h('option', { value: v }, l)));
  autoSel.value = s.autoSyncMin; autoSel.onchange = () => { s.autoSyncMin = Number(autoSel.value); commit('settings'); };

  const live = connected && G.hasToken();
  const stateCls = live ? 'ok' : connected ? 'warn' : '';
  const status = h('div', { class: `g-card ${stateCls}` },
    h('span', { class: `g-dot ${stateCls}` }),
    h('div', { class: 'g-tx' },
      h('strong', {}, connected ? (live ? 'Bağlı' : 'Oturum yenilenmeli') : 'Bağlı değil'),
      h('span', { class: 'muted small' }, s.lastSync ? `Son eşitleme: ${new Date(s.lastSync).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Henüz eşitlenmedi'),
      st.state === 'error' ? h('span', { class: 'warn-text small' }, st.message) : null),
    h('div', { class: 'g-act' },
      !live
        ? h('button', { class: 'btn primary', onclick: () => G.sync({ interactive: true }).then(() => rerender()) }, connected ? 'Yeniden bağlan' : 'Google ile bağlan')
        : h('button', { class: 'btn primary', onclick: () => G.sync({ interactive: true }).then((ok) => { if (ok) toast('Eşitlendi'); rerender(); }) }, 'Şimdi eşitle'),
      connected ? h('button', { class: 'btn ghost', onclick: () => { G.disconnect(); rerender(); toast('Google bağlantısı kesildi'); } }, 'Bağlantıyı kes') : null));

  return section('google', 'calendar', 'Google Takvim', [
    status,
    connected ? h('div', { class: 'grid-2' }, field('Eşitlenecek takvim', calSel), field('Otomatik eşitleme', autoSel)) : null,
    connected ? cloudBlock(rerender) : null,
    connected ? h('div', { class: 'row' }, h('button', {
      class: 'btn small ghost', onclick: () => { const n = G.markAllLocalForSync(); toast(n ? `${n} plan Google'a gönderilecek` : 'Gönderilmemiş plan yok'); },
    }, 'Google\'a gönderilmemiş planları da gönder')) : null,
    h('details', { class: 'help' }, h('summary', {}, 'İstemci kimliği'),
      h('div', { class: 'row grow', style: { marginTop: '10px' } }, field('OAuth istemci kimliği', cid), saveCid)),
    help,
  ]);
}

// Görevler, ders programı, notlar, defter: Google Drive'daki gizli uygulama klasörü üzerinden eşitleme
function cloudBlock(rerender) {
  const s = state.settings;
  const cs = G.getCloudStatus();
  const on = G.cloudEnabled();
  const sw = toggle(on, (v) => { s.cloudSync = v; commit('settings'); if (v) G.sync({ interactive: true, cloudOnly: true }).then(() => rerender()); else rerender(); },
    'Görevleri, ders programını, devamsızlığı, unutma notlarını ve defteri de eşitle');
  let line;
  if (!on) line = h('span', { class: 'muted small' }, 'Kapalı: bunlar yalnız bu cihazda kalır.');
  else if (cs.state === 'error' || cs.state === 'needs-auth') line = h('span', { class: 'warn-text small' }, cs.message);
  else if (G.needsConsent()) line = h('span', { class: 'warn-text small' }, 'Bir kez "Yeniden bağlan"a bas: Google, Drive iznini de soracak.');
  else line = h('span', { class: 'muted small' }, s.cloudLastSync ? `Son eşitleme: ${new Date(s.cloudLastSync).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Henüz eşitlenmedi.');
  return h('div', { class: 'cloud-block' },
    sw.el,
    h('p', { class: 'muted small' }, 'Google Drive\'ında yalnız Vazifedar\'ın görebildiği gizli bir klasörde tutulur (Drive\'da dosya olarak görünmez). Aynı hesapla bağlanan her cihaz aynı verileri görür.'),
    h('div', { class: 'row' }, line,
      on && (G.needsConsent() || cs.state === 'needs-auth')
        ? h('button', { class: 'btn small', onclick: () => G.sync({ interactive: true }).then(() => rerender()) }, 'Yeniden bağlan') : null));
}

// ---------------------------------------------------------------------------
// Görünüm
// ---------------------------------------------------------------------------
function miniDial(hero) {
  const s = svg('svg', { viewBox: '0 0 48 48', class: 'pal-dial', 'aria-hidden': 'true' });
  s.append(svg('circle', { cx: 24, cy: 24, r: 22, fill: hero }));
  s.append(svg('circle', { cx: 24, cy: 24, r: 15, fill: 'none', stroke: 'rgba(255,255,255,.85)', 'stroke-width': 4.5, 'stroke-dasharray': '30 64.2', transform: 'rotate(-60 24 24)' }));
  s.append(svg('circle', { cx: 24, cy: 24, r: 15, fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 4.5 }));
  s.append(svg('path', { d: 'M24 24 L31 31', stroke: '#1A1F36', 'stroke-width': 3, 'stroke-linecap': 'round' }));
  s.append(svg('circle', { cx: 24, cy: 24, r: 3, fill: '#1A1F36' }));
  return s;
}

function displaySection() {
  const s = state.settings;
  const curPal = () => PALETTE_ALIAS[s.palette] || s.palette;
  const palRow = h('div', { class: 'pal-grid', role: 'radiogroup', 'aria-label': 'Renk teması' });
  const renderPal = () => palRow.replaceChildren(...Object.entries(PALETTES).map(([id, p]) => {
    const on = curPal() === id && !s.accent;
    return h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(on), class: `pal-tile ${on ? 'on' : ''}`,
      onclick: () => { s.palette = id; if (s.accent) { s.accent = ''; accent.box.checked = false; accentIn.disabled = true; } commit('settings'); renderPal(); },
    }, miniDial(p.light.hero), h('span', {}, p.name));
  }));
  const accentIn = h('input', { type: 'color', value: s.accent || PALETTES[curPal()]?.light.hero || '#0E8C8A', disabled: !s.accent, 'aria-label': 'Kendi rengin' });
  const accent = toggle(!!s.accent, (v) => { accentIn.disabled = !v; s.accent = v ? accentIn.value : ''; commit('settings'); renderPal(); }, 'Kendi rengimi kullan');
  accentIn.oninput = () => { if (accent.box.checked) { s.accent = accentIn.value; commit('settings'); } };
  renderPal();

  return section('gorunum', 'palette', 'Görünüm', [
    palRow,
    h('div', { class: 'row accent-row' }, accent.el, accentIn),
    h('div', { class: 'set-grid' },
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Açık / koyu'),
        segmented([['auto', 'Sistem'], ['light', 'Açık', 'sun'], ['dark', 'Koyu', 'moon']], s.theme || 'auto', (v) => { s.theme = v; commit('settings'); }, 'Açık / koyu')),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Renk bloklarında desen'),
        segmented([['none', 'Yok'], ['soft', 'Hafif'], ['strong', 'Belirgin']], s.pattern || 'soft', (v) => { s.pattern = v; commit('settings'); }, 'Desen'))),
  ], { lead: 'Kadranın ve büyük renk bloklarının rengi' });
}

// ---------------------------------------------------------------------------
// Gün saatleri: takvimde görünen saatler ve görev yerleştirme saatleri, küçük bir 24 saat halkasında
// ---------------------------------------------------------------------------
function hourRing() {
  const cx = 70, cy = 70;
  const s = svg('svg', { viewBox: '0 0 140 140', class: 'hr-ring', role: 'img' });
  // Kadran yönü: öğlen tepede, gece yarısı altta
  const pt = (hr, r) => { const a = ((hr / 24) * 360 + 180) * Math.PI / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
  const arc = (a, b, r) => {
    if (b - a >= 24) return `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
    const [x0, y0] = pt(a, r), [x1, y1] = pt(b, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${b - a > 12 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const track1 = svg('circle', { cx, cy, r: 56, class: 'hr-track' });
  const track2 = svg('circle', { cx, cy, r: 40, class: 'hr-track thin' });
  const a1 = svg('path', { class: 'hr-arc cal' });
  const a2 = svg('path', { class: 'hr-arc task' });
  s.append(track1, track2, a1, a2);
  for (const hr of [0, 6, 12, 18]) {
    const [x, y] = pt(hr, 27);
    const t = svg('text', { x: x.toFixed(1), y: y.toFixed(1), class: 'hr-lbl', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    t.textContent = pad2(hr);
    s.append(t);
  }
  const min = (hm) => { const [a, b] = String(hm || '0:0').split(':').map(Number); return a + (b || 0) / 60; };
  const draw = () => {
    const st = state.settings;
    a1.setAttribute('d', arc(st.dayStartHour, st.dayEndHour, 56));
    a2.setAttribute('d', arc(min(st.freeSlotStart || '09:00'), min(st.freeSlotEnd || '22:00'), 40));
    s.setAttribute('aria-label', `Takvimde ${pad2(st.dayStartHour)}:00–${pad2(st.dayEndHour)}:00 görünür, görevler ${st.freeSlotStart}–${st.freeSlotEnd} arasına yerleşir`);
  };
  draw();
  return { el: s, draw };
}

function hoursSection() {
  const s = state.settings;
  const ring = hourRing();
  const hours = [...Array(25)].map((_, i) => [i, `${pad2(i)}:00`]);
  const ds = h('select', {}, hours.slice(0, 24).map(([v, l]) => h('option', { value: v }, l)));
  const de = h('select', {}, hours.slice(1).map(([v, l]) => h('option', { value: v }, l)));
  ds.value = s.dayStartHour; de.value = s.dayEndHour;
  const upd = () => {
    if (Number(de.value) <= Number(ds.value)) { toast('Bitiş saati başlangıçtan sonra olmalı', { kind: 'warn' }); ds.value = s.dayStartHour; de.value = s.dayEndHour; return; }
    s.dayStartHour = Number(ds.value); s.dayEndHour = Number(de.value); commit('settings'); ring.draw();
  };
  ds.onchange = upd; de.onchange = upd;
  const fs = h('input', { type: 'time', value: s.freeSlotStart, step: 900 });
  const fe = h('input', { type: 'time', value: s.freeSlotEnd, step: 900 });
  const updF = () => {
    if (fs.value && fe.value && fe.value <= fs.value) { toast('En geç saat en erkenden sonra olmalı', { kind: 'warn' }); fs.value = s.freeSlotStart; fe.value = s.freeSlotEnd; return; }
    s.freeSlotStart = fs.value || '09:00'; s.freeSlotEnd = fe.value || '22:00'; commit('settings'); ring.draw();
  };
  fs.onchange = updF; fe.onchange = updF;
  const showC = toggle(s.showCoursesInMonth, (v) => { s.showCoursesInMonth = v; commit('settings'); }, 'Ay ve ajanda görünümünde dersleri de göster');

  return section('saatler', 'clock', 'Gün saatleri', [
    h('div', { class: 'hr-wrap' },
      h('figure', { class: 'hr-fig' }, ring.el,
        h('figcaption', {},
          h('span', { class: 'hr-key cal' }, 'Takvimde görünen'),
          h('span', { class: 'hr-key task' }, 'Görev yerleştirme'))),
      h('div', { class: 'hr-fields' },
        h('div', { class: 'hr-pair cal' },
          h('span', { class: 'hr-pair-h' }, 'Haftalık takvimde görünen saatler'),
          h('div', { class: 'grid-2' }, field('Başlangıç', ds), field('Bitiş', de))),
        h('div', { class: 'hr-pair task' },
          h('span', { class: 'hr-pair-h' }, 'Görevleri boşluklara yerleştirirken'),
          h('div', { class: 'grid-2' }, field('En erken', fs), field('En geç', fe)),
          h('span', { class: 'field-hint' }, 'Boş zaman ararken bu aralığın dışına koymaz')))),
    showC.el,
  ]);
}

// ---------------------------------------------------------------------------
// Hatırlatmalar: tarayıcı bildirimi + unutma notları ve çanta
// ---------------------------------------------------------------------------
function remindersSection(rerender) {
  const p = state.settings.pins;
  const save = () => commit('settings');
  const perm = permission();
  const permTx = { granted: 'Bildirimler açık', denied: 'Bildirimler bu tarayıcıda engelli', default: 'Bildirimlere henüz izin verilmedi', unsupported: 'Bu tarayıcı bildirim göstermiyor' }[perm];
  const permRow = h('div', { class: `perm-row ${perm}` },
    h('span', { class: 'perm-ic', 'aria-hidden': 'true' }, ic(perm === 'granted' ? 'bell' : 'alert', { size: 17 })),
    h('div', {}, h('strong', {}, permTx),
      h('p', { class: 'muted small' }, perm === 'denied'
        ? 'Adres çubuğundaki kilit simgesinden Bildirimler\'i "İzin ver" yap.'
        : 'Hatırlatmalar Vazifedar açıkken (ya da yüklü uygulama arka plandayken) gelir. Telefonda da istiyorsan planları Google Takvim ile eşitle.')),
    perm === 'default' ? h('button', { class: 'btn small primary', onclick: async () => { await requestPermission(); rerender(); } }, 'İzin ver') : null);

  const showFrom = h('input', { type: 'time', value: p.showFrom || '18:00', step: 900 });
  showFrom.onchange = () => { p.showFrom = showFrom.value || '18:00'; save(); };
  const at = h('input', { type: 'time', value: p.notifyAt || '21:00', step: 900, disabled: p.notify === false });
  at.onchange = () => { p.notifyAt = at.value || '21:00'; save(); };
  const before = h('select', { disabled: p.notify === false }, [['', 'Kapalı'], ['30', '30 dk önce'], ['60', '1 saat önce'], ['90', '1,5 saat önce'], ['120', '2 saat önce']].map(([v, l]) => h('option', { value: v }, l)));
  before.value = p.beforeMin === null || p.beforeMin === undefined ? '' : String(p.beforeMin);
  before.onchange = () => { p.beforeMin = before.value === '' ? null : Number(before.value); save(); };
  const on = toggle(p.notify !== false, (v) => { p.notify = v; at.disabled = !v; before.disabled = !v; save(); }, 'Unutma notlarını bildir');

  return section('hatirlatma', 'bell', 'Hatırlatmalar', [
    permRow,
    h('div', { class: 'sub-block' },
      h('div', { class: 'sub-block-h' }, h('h3', {}, ic('bag', { size: 16 }), ' Unutma notları ve yarının çantası'), on.el),
      h('p', { class: 'muted small' }, 'Bir derse ya da plana iğnelediğin notlar önceki akşam Bugün ekranında "Yarının çantası" olarak çıkar.'),
      h('div', { class: 'grid-3' },
        field('Çanta görünsün', showFrom, 'Bu saatten sonra Bugün ekranı yarını gösterir'),
        field('Akşam bildirimi', at, 'Yarın için işaretlenmemiş not varsa'),
        field('Kayıttan önce', before, 'O dersin/planın notlarını hatırlatır'))),
  ]);
}

// ---------------------------------------------------------------------------
// Namaz vakitleri
// ---------------------------------------------------------------------------
function prayerSection(rerender) {
  const p = state.settings.prayer;
  const save = (re = true) => { commit('settings'); if (re) rerender(); };
  const on = toggle(!!p.enabled, (v) => { p.enabled = v; save(); }, 'Göster');
  if (!p.enabled) {
    return section('namaz', 'moon', 'Namaz vakitleri', [
      h('p', { class: 'muted small' }, 'Açınca vakitler Bugün ekranında, kadranda ve haftalık takvimde görünür; istersen vakit girerken hatırlatır.'),
    ], { right: on.el });
  }

  const custom = !ILLER.some(([n]) => n === p.city);
  const city = h('select', {},
    custom ? h('option', { value: '__custom' }, p.city || 'Konumum') : null,
    ILLER.map(([n]) => h('option', { value: n }, n)));
  city.value = custom ? '__custom' : p.city;
  city.onchange = () => {
    const il = ILLER.find(([n]) => n === city.value);
    if (!il) return;
    [p.city, p.lat, p.lng] = il; save();
  };
  const geo = h('button', {
    type: 'button', class: 'btn ghost', disabled: !('geolocation' in navigator),
    onclick: () => {
      geo.disabled = true; geo.textContent = 'Konum alınıyor…';
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = Math.round(pos.coords.latitude * 1e4) / 1e4, lng = Math.round(pos.coords.longitude * 1e4) / 1e4;
        const near = ILLER.map(([n, a, b]) => [n, (a - lat) ** 2 + ((b - lng) * Math.cos((lat * Math.PI) / 180)) ** 2]).sort((x, y) => x[1] - y[1])[0];
        Object.assign(p, { lat, lng, city: near && near[1] < 1 ? `Konumum (${near[0]} yakını)` : 'Konumum' });
        save(); toast('Vakitler bulunduğun konuma göre hesaplanıyor');
      }, (err) => {
        geo.disabled = false; geo.replaceChildren(ic('pin', { size: 15 }), ' Konumumu kullan');
        toast(err.code === 1 ? 'Konum izni verilmedi' : 'Konum alınamadı', { kind: 'warn' });
      }, { timeout: 15000, maximumAge: 600000 });
    },
  }, ic('pin', { size: 15 }), ' Konumumu kullan');

  const now = new Date();
  const t = timesFor(now);
  const nextId = VAKITLER.find((v) => t[v.id] > now)?.id;
  const preview = h('ol', { class: 'pr-preview', 'aria-label': 'Bugünün vakitleri' },
    VAKITLER.map((v) => h('li', { class: v.id === nextId ? 'next' : '' }, h('span', {}, v.name), h('b', {}, timeStr(t[v.id])))));

  const chk = (key, label) => toggle(p[key] !== false, (v) => { p[key] = v; save(false); }, label).el;

  const rem = h('select', {}, [['', 'Kapalı'], ['0', 'Vakit girince'], ['5', '5 dk önce'], ['10', '10 dk önce'], ['15', '15 dk önce'], ['30', '30 dk önce'], ['45', '45 dk önce']]
    .map(([v, l]) => h('option', { value: v }, l)));
  rem.value = p.notifyMin === null || p.notifyMin === undefined ? '' : String(p.notifyMin);
  rem.onchange = () => { p.notifyMin = rem.value === '' ? null : Number(rem.value); save(); };
  const which = p.notifyMin === null || p.notifyMin === undefined ? null : h('div', { class: 'tchips', role: 'group', 'aria-label': 'Hangi vakitlerde' },
    VAKITLER.map((v) => {
      const c = h('input', { type: 'checkbox', checked: (p.notifyIds || []).includes(v.id) });
      c.onchange = () => {
        const set = new Set(p.notifyIds || []);
        if (c.checked) set.add(v.id); else set.delete(v.id);
        p.notifyIds = VAKITLER.map((x) => x.id).filter((id) => set.has(id)); save(false);
      };
      return h('label', { class: 'tchip' }, c, h('span', {}, v.name));
    }));

  const offs = h('div', { class: 'pr-offsets' }, VAKITLER.map((v) => {
    const n = h('input', { type: 'number', min: -30, max: 30, step: 1, value: p.offsets?.[v.id] || 0, class: 'num', 'aria-label': `${v.name} için dakika düzeltmesi` });
    n.onchange = () => {
      const val = Math.max(-30, Math.min(30, Math.round(Number(n.value) || 0)));
      p.offsets = { ...(p.offsets || {}), [v.id]: val }; save();
    };
    return h('label', { class: 'field' }, h('span', { class: 'field-label' }, v.name), n);
  }));
  const anyOff = VAKITLER.some((v) => Number(p.offsets?.[v.id]));

  return section('namaz', 'moon', 'Namaz vakitleri', [
    h('div', { class: 'row grow' }, field('Şehir', city), geo),
    preview,
    h('div', { class: 'row gap-l' }, chk('onDial', 'Bugün kadranında göster'), chk('inWeek', 'Haftalık takvimde göster')),
    field('Hatırlatma', rem, 'Vazifedar açıkken bildirim gönderir'),
    which ? field('Hangi vakitlerde', which) : null,
    h('details', { class: 'help', open: anyOff || null },
      h('summary', {}, 'İnce ayar (dakika)'),
      h('p', { class: 'muted small' }, 'Vakitler Diyanet yöntemiyle (İmsak 18°, Yatsı 17°, Diyanet temkinleri) bu cihazda hesaplanır; internet gerekmez. Diyanet\'in yayımladığı takvimle bir iki dakika fark görürsen ilgili vakte + ya da − dakika ekle.'),
      offs),
  ], { right: on.el });
}

// ---------------------------------------------------------------------------
// Kategoriler
// ---------------------------------------------------------------------------
// Karoda kısa yazılır; yanındaki zil simgesi "önce hatırlat" anlamına gelir
const HATIRLATMA = [['', 'Yok'], ['0', 'Başlarken'], ['10', '10 dk'], ['30', '30 dk'], ['60', '1 sa'], ['120', '2 sa'], ['1440', '1 gün']];

function categoriesSection() {
  const grid = h('div', { class: 'cat-grid' });
  const render = () => grid.replaceChildren(...state.categories.map((c) => {
    const picker = h('div', { class: 'icon-picker', hidden: true, role: 'group', 'aria-label': `${c.name} için ikon` },
      ICON_CHOICES.map((k) => h('button', {
        type: 'button', class: `ip-btn ${c.icon === k ? 'on' : ''}`, 'aria-label': ICON_NAMES[k] || k, title: ICON_NAMES[k] || k, 'aria-pressed': String(c.icon === k),
        onclick: () => { c.icon = k; commit('settings'); render(); },
      }, ic(k, { size: 18 }))));
    const icon = h('button', {
      type: 'button', class: 'ct-icon', style: { '--c': c.color }, 'aria-label': `${c.name}: ikonu değiştir`, 'aria-expanded': 'false', title: 'İkonu değiştir',
      onclick: () => { picker.hidden = !picker.hidden; icon.setAttribute('aria-expanded', String(!picker.hidden)); },
    }, ic(c.icon, { size: 22 }));
    const name = h('input', { type: 'text', value: c.name, class: 'ct-name', 'aria-label': 'Kategori adı' });
    const color = h('input', { type: 'color', value: c.color, 'aria-label': 'Renk' });
    const dur = h('select', { 'aria-label': 'Varsayılan süre' }, [30, 60, 90, 120, 180, 240].map((m) => h('option', { value: m }, m < 60 ? `${m} dk` : `${m / 60} sa`.replace('.5', ',5'))));
    dur.value = c.duration || 60;
    const rem = h('select', { 'aria-label': 'Varsayılan hatırlatma' }, HATIRLATMA.map(([v, l]) => h('option', { value: v }, l)));
    rem.value = c.reminder === null || c.reminder === undefined ? '' : String(c.reminder);
    if (rem.value !== String(c.reminder ?? '')) { // listede olmayan eski bir değer
      rem.append(h('option', { value: String(c.reminder) }, `${c.reminder} dk`));
      rem.value = String(c.reminder);
    }
    const upd = () => {
      c.name = name.value.trim() || c.name; c.color = color.value; c.duration = Number(dur.value);
      c.reminder = rem.value === '' ? null : Number(rem.value);
      icon.style.setProperty('--c', c.color); icon.style.setProperty('--on', onColor(c.color)); tile.style.setProperty('--c', c.color);
      commit('settings');
    };
    name.onchange = upd; color.oninput = upd; dur.onchange = upd; rem.onchange = upd;
    const builtIn = ['diger', 'sinav', 'gorev'].includes(c.id);
    const tile = h('div', { class: 'ct-tile', style: { '--c': c.color } },
      h('div', { class: 'ct-top' }, icon, name, color),
      h('div', { class: 'ct-bottom' },
        h('label', { class: 'ct-opt', title: 'Varsayılan süre' }, ic('clock', { size: 14 }), dur),
        h('label', { class: 'ct-opt', title: 'Ne kadar önce hatırlatsın' }, ic('bell', { size: 14 }), rem),
        builtIn ? null : h('button', {
          class: 'icon-btn ct-del', title: 'Sil', 'aria-label': `${c.name} kategorisini sil`,
          onclick: async () => {
            if (!await confirmDialog({ title: 'Kategori silinsin mi?', message: `"${c.name}" kategorisindeki planlar "Diğer"e taşınır.`, okLabel: 'Sil', danger: true })) return;
            for (const e of state.events) if (e.categoryId === c.id) e.categoryId = 'diger';
            state.categories = state.categories.filter((x) => x !== c); commit('settings'); render();
          },
        }, ic('x', { size: 15 }))),
      picker);
    return tile;
  }), h('button', {
    type: 'button', class: 'ct-add',
    onclick: () => { state.categories.push({ id: uid(), name: 'Yeni kategori', icon: 'star', color: PALET[state.categories.length % PALET.length], duration: 60, reminder: 30 }); commit('settings'); render(); grid.querySelector('.ct-tile:last-of-type .ct-name')?.select(); },
  }, h('span', { 'aria-hidden': 'true' }, '+'), 'Plan türü ekle'));
  render();

  const tgrid = h('div', { class: 'tc-row' });
  const renderT = () => tgrid.replaceChildren(...state.taskCategories.map((c) => {
    const name = h('input', { type: 'text', value: c.name, 'aria-label': 'Görev kategorisi adı', size: Math.max(4, c.name.length) });
    const color = h('input', { type: 'color', value: c.color, 'aria-label': `${c.name} rengi` });
    const pill = h('div', { class: 'tc-pill', style: { '--c': c.color } }, h('span', { class: 'tc-sw' }, color), name, h('button', {
      class: 'icon-btn', 'aria-label': `${c.name} kategorisini sil`, title: 'Sil', onclick: () => {
        for (const t of state.tasks) if (t.categoryId === c.id) t.categoryId = '';
        state.taskCategories = state.taskCategories.filter((x) => x !== c); commit('settings'); renderT();
      },
    }, ic('x', { size: 13 })));
    name.oninput = () => { name.size = Math.max(4, name.value.length); };
    name.onchange = () => { c.name = name.value.trim() || c.name; commit('settings'); };
    color.oninput = () => { c.color = color.value; pill.style.setProperty('--c', c.color); commit('settings'); };
    return pill;
  }), h('button', {
    type: 'button', class: 'tc-add',
    onclick: () => { state.taskCategories.push({ id: uid(), name: 'Yeni', color: PALET[(state.taskCategories.length + 3) % PALET.length] }); commit('settings'); renderT(); tgrid.querySelector('.tc-pill:last-of-type input[type=text]')?.select(); },
  }, '+ Ekle'));
  renderT();

  return section('kategori', 'star', 'Kategoriler', [
    h('h3', { class: 'set-sub' }, 'Plan türleri'),
    h('p', { class: 'muted small' }, 'Süre ve hatırlatma, bu türde yeni plan eklerken kendiliğinden dolar. İkona tıklayınca değişir.'),
    grid,
    h('h3', { class: 'set-sub' }, 'Görev kategorileri'),
    tgrid,
  ]);
}

// ---------------------------------------------------------------------------
// Veriler
// ---------------------------------------------------------------------------
function dataSection() {
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.events)) throw new Error('Geçersiz yedek dosyası');
      if (!await confirmDialog({ title: 'Yedek yüklensin mi?', message: 'Şu anki tüm verilerin yedektekiyle değiştirilecek.', okLabel: 'Yükle', danger: true })) return;
      replaceState(data); toast('Yedek yüklendi');
    } catch (e) { toast(`Yüklenemedi: ${e.message}`, { kind: 'warn' }); }
    file.value = '';
  };
  const counts = [
    [state.events.filter((e) => !e.deleted).length, 'plan'], [state.courses.length, 'ders'], [state.tasks.length, 'görev'],
    [state.notes.length, 'unutma notu'], [Object.keys(state.journal).length, 'defter sayfası'],
  ];
  const synced = state.settings.googleConnected && G.cloudEnabled();
  return section('veri', 'archive', 'Veriler ve yedek', [
    h('ul', { class: 'data-counts', 'aria-label': 'Bu tarayıcıdaki veriler' }, counts.map(([n, l]) => h('li', {}, h('b', {}, n), h('span', {}, l)))),
    h('p', { class: 'muted small' }, synced
      ? 'Verilerin bu tarayıcıda duruyor. Planlar Google Takvim\'le, görevler, ders programı, notlar ve defter Google Drive\'daki gizli klasörle eşitlenir.'
      : 'Verilerin bu tarayıcıda duruyor. Google\'a yalnız planlar gider; görevler, ders programı, notlar ve defter yalnız burada.'),
    h('div', { class: 'sub-block' }, h('h3', {}, 'Otomatik yedek'), backupPanel()),
    h('div', { class: 'sub-block' }, h('h3', {}, 'Elle yedek'),
      h('p', { class: 'muted small' }, 'Tek bir JSON dosyası: planlar, dersler, görevler, unutma notları, defter, kadran arşivi ve ayarlar.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => downloadBackup() }, 'Yedek indir'),
        h('button', { class: 'btn', onclick: () => file.click() }, 'Yedekten yükle'), file)),
    h('div', { class: 'danger-zone' },
      h('div', {}, h('strong', {}, 'Her şeyi sil'),
        h('p', { class: 'muted small' }, 'Bu tarayıcıdaki tüm planlar, dersler, görevler ve ayarlar silinir. Google Takvim\'e ve Drive\'daki kopyaya dokunulmaz.')),
      h('button', { class: 'btn danger', onclick: async () => { if (await confirmDialog({ title: 'Her şey silinsin mi?', message: 'Planlar, dersler, görevler ve ayarlar bu tarayıcıdan silinir. Google Takvim\'deki etkinliklere ve Drive\'daki eşitleme kopyasına dokunulmaz (Google bağlıysa veriler bir sonraki eşitlemede geri gelir).', okLabel: 'Hepsini sil', danger: true })) { resetState(); toast('Tüm veriler silindi'); } } }, 'Hepsini sil')),
  ]);
}

// Güncelleme kartı: yüklü sürüm, son denetim, Güncelle
function updateBlock() {
  const box = h('div', { class: 'upd' });
  const draw = (st = updateStatus()) => {
    const since = st.checkedAt ? ago(new Date(st.checkedAt).toISOString()) : '';
    const installed = st.stamp ? `Yüklü sürüm: ${stampText(st.stamp)}` : '';
    let cls = '', icon = 'repeat', title = 'Güncellemeler', sub = 'Sunucudaki dosyalar değiştiyse tek dokunuşla alırsın.', btns = [];
    const check = h('button', { class: 'btn', onclick: () => checkForUpdate({ quiet: true }) }, 'Güncellemeleri denetle');
    const force = h('button', { class: 'link', onclick: () => applyUpdate(), title: 'Değişiklik görünmese de bütün dosyaları yeniden indir' }, 'Yine de yenile');
    switch (st.state) {
      case 'checking': cls = 'busy'; title = 'Denetleniyor…'; sub = 'Sunucudaki dosyalara bakılıyor'; break;
      case 'updating': cls = 'busy'; title = 'Güncelleniyor…'; sub = 'Dosyalar indiriliyor, uygulama birazdan yeniden açılacak'; break;
      case 'available':
        cls = 'new'; icon = 'repeat'; title = 'Yeni sürüm hazır';
        sub = [st.changed?.length && st.changed[0] !== '?' ? `${st.changed.length} dosya değişti` : '', st.newStamp ? `sunucuda ${stampText(st.newStamp)}` : ''].filter(Boolean).join(' · ');
        btns = [h('button', { class: 'btn primary', onclick: () => applyUpdate() }, 'Güncelle')]; break;
      case 'current':
        cls = 'ok'; icon = 'tick'; title = 'Güncel';
        sub = [installed, since ? `son denetim ${since}` : ''].filter(Boolean).join(' · ');
        btns = [check, force]; break;
      case 'offline': title = 'İnternet yok'; sub = 'Bağlanınca kendiliğinden denetlenir.'; btns = [check]; break;
      case 'error': cls = 'err'; icon = 'alert'; title = 'Denetlenemedi'; sub = st.message; btns = [check, force]; break;
      default: btns = [check, force];
    }
    box.className = `upd ${cls}`;
    box.replaceChildren(
      h('span', { class: 'upd-ic', 'aria-hidden': 'true' }, ic(icon, { size: 18 })),
      h('div', { class: 'upd-tx' }, h('strong', {}, title), sub ? h('span', { class: 'muted small' }, sub) : null),
      h('div', { class: 'upd-act' }, btns));
  };
  draw();
  // Kart sayfaya yerleşmeden gelen durumları da çiz; sayfadan kalktıktan sonra dinlemeyi bırak
  let mounted = false;
  const off = onUpdateStatus((st) => {
    if (box.isConnected) { mounted = true; draw(st); } else if (mounted) off(); else draw(st);
  });
  if (updateStatus().state === 'idle') setTimeout(() => checkForUpdate({ quiet: true }), 300);
  return box;
}

function appSection() {
  const inner = appPanel();
  inner.classList.remove('panel');
  inner.classList.add('app-inner');
  // appPanel kendi başlığını çiziyor; bölüm başlığı zaten var
  const hideTitle = () => inner.querySelector('h3')?.remove();
  hideTitle();
  new MutationObserver(hideTitle).observe(inner, { childList: true });
  return section('uygulama', 'device', 'Uygulama', [
    updateBlock(),
    h('details', { class: 'help' }, h('summary', {}, 'Kodu değiştirince telefona nasıl gelir?'),
      h('ol', {},
        h('li', {}, 'Değişen dosyaları GitHub\'a yükle (aynı yükleme ekranı, üstüne yazar). GitHub Pages bir iki dakikada yayına alır.'),
        h('li', {}, 'Telefonda Vazifedar\'ı aç ya da arka plandan öne getir: birkaç saniye içinde "Yeni sürüm hazır" bildirimi çıkar → Güncelle.'),
        h('li', {}, 'Bildirim çıkmazsa buradan "Güncellemeleri denetle"ye bas. Hâlâ eski görünüyorsa "Yine de yenile" her dosyayı yeniden indirir.')),
      h('p', { class: 'muted small' }, 'Uygulamayı silip yeniden yüklemen gerekmez; verilerin de olduğu yerde kalır.')),
    inner,
  ]);
}

// ---------------------------------------------------------------------------
// Sayfa
// ---------------------------------------------------------------------------
let live = null;      // ayarlar açıkken özetleri ve hazırlık kadranını tazeler
let observer = null;
subscribe((reason) => { if (reason !== 'journal') live?.(); });
G.onStatus(() => live?.());
onBackupChange(() => live?.());
onUpdateStatus(() => live?.());

export function renderSettings(root) {
  const rerender = () => { const sc = root.scrollTop; renderSettings(root); root.scrollTop = sc; };
  const rd = readinessBlock();
  const nav = rail();
  const secs = [
    googleSection(rerender), displaySection(), hoursSection(), remindersSection(rerender),
    prayerSection(rerender), categoriesSection(), dataSection(), appSection(),
  ];
  const page = h('div', { class: 'settings2' }, rd.el, h('div', { class: 'set-layout' }, nav.el, h('div', { class: 'set-secs' }, secs)));
  root.replaceChildren(page);

  live = () => {
    if (!page.isConnected) { live = null; return; }
    rd.draw(); nav.draw();
  };

  // Hangi bölümdeyiz?
  observer?.disconnect();
  const visible = new Map();
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) visible.set(e.target.dataset.sec, e.isIntersecting ? e.intersectionRect.top : null);
    pick();
  }, { root, rootMargin: '-15% 0px -60% 0px' });
  const atBottom = () => root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
  function pick() {
    // En alta inince son bölüm üst banda hiç ulaşmaz; onu işaretle
    if (atBottom()) { nav.setActive(SECTIONS[SECTIONS.length - 1].id); return; }
    const first = SECTIONS.find((s) => visible.get(s.id) !== null && visible.get(s.id) !== undefined);
    if (first) nav.setActive(first.id);
  }
  for (const s of secs) observer.observe(s);
  nav.setActive('google');
  const onScroll = () => {
    if (!page.isConnected) { root.removeEventListener('scroll', onScroll); return; }
    pick();
  };
  root.removeEventListener('scroll', root._setScroll || (() => {}));
  root._setScroll = onScroll;
  root.addEventListener('scroll', onScroll, { passive: true });
}
