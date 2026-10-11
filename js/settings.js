// Ayarlar: Google bağlantısı, bildirimler, görünüm, kategoriler, yedekleme.
import { h, toast, field, confirmDialog } from './ui.js';
import { state, commit, uid, PALET, replaceState, resetState } from './store.js';
import { timeStr } from './dates.js';
import * as G from './google.js';
import { permission, requestPermission } from './notify.js';
import { ic, ICON_CHOICES, ICON_NAMES } from './icons.js';
import { PALETTES, PALETTE_ALIAS } from './theme.js';
import { VAKITLER, ILLER, timesFor } from './prayer.js';
import { backupPanel, downloadBackup } from './backup.js';
import { appPanel } from './pwa.js';

function googleSection(rerender) {
  const s = state.settings;
  const cid = h('input', { type: 'text', value: s.googleClientId, placeholder: '1234…-abc.apps.googleusercontent.com', spellcheck: 'false' });
  const st = G.getStatus();
  const connected = s.googleConnected;

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

  const origin = location.origin;
  const help = h('details', { class: 'help' },
    h('summary', {}, 'Google bağlantısı nasıl kurulur? (bir kerelik, ~5 dakika)'),
    h('ol', {},
      h('li', {}, h('a', { href: 'https://console.cloud.google.com/projectcreate', target: '_blank', rel: 'noopener' }, 'Google Cloud Console'), '\'da yeni bir proje oluştur (ör. "Vazifedar").'),
      h('li', {}, h('a', { href: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com', target: '_blank', rel: 'noopener' }, 'Google Calendar API'), '\'yi etkinleştir.'),
      h('li', {}, '"Google Auth Platform" (OAuth izin ekranı) bölümünde uygulamayı "External" olarak yapılandır; "Audience / Test users" kısmına kendi Gmail adresini ekle.'),
      h('li', {}, '"Clients" (Kimlik bilgileri) bölümünde yeni bir ', h('strong', {}, 'OAuth istemci kimliği'), ' oluştur, tür: "Web application".'),
      h('li', {}, '"Authorized JavaScript origins" alanına şunu ekle: ', h('code', {}, origin)),
      h('li', {}, 'Oluşan istemci kimliğini (…apps.googleusercontent.com) yukarıdaki kutuya yapıştır, Kaydet\'e ve ardından Bağlan\'a bas.')),
    h('p', { class: 'muted small' }, 'Uygulama "test" modunda kaldığı sürece Google her 7 günde bir yeniden giriş isteyebilir; bu normaldir. Verilerin hiçbir sunucuya gitmez, tarayıcın doğrudan Google ile konuşur.'));

  return h('section', { class: 'panel' },
    h('h3', {}, 'Google Takvim'),
    h('div', { class: 'row grow' }, field('OAuth istemci kimliği', cid),
      h('button', { class: 'btn', onclick: () => { s.googleClientId = cid.value.trim(); commit('settings'); toast('İstemci kimliği kaydedildi'); if (s.googleClientId) G.loadGis().catch(() => {}); rerender(); } }, 'Kaydet')),
    s.googleClientId ? h('div', { class: 'gstatus' },
      h('span', { class: `dot ${connected && G.hasToken() ? 'ok' : connected ? 'warn' : ''}` }),
      h('span', {}, connected ? (G.hasToken() ? 'Bağlı' : 'Bağlı (oturum yenilenmeli)') : 'Bağlı değil'),
      s.lastSync ? h('span', { class: 'muted small' }, `Son eşitleme: ${new Date(s.lastSync).toLocaleString('tr-TR')}`) : null,
      st.state === 'error' ? h('span', { class: 'warn-text small' }, st.message) : null) : null,
    s.googleClientId ? h('div', { class: 'row' },
      !connected || !G.hasToken()
        ? h('button', { class: 'btn primary', onclick: () => G.sync({ interactive: true }).then(() => rerender()) }, connected ? 'Yeniden bağlan' : 'Google ile bağlan')
        : h('button', { class: 'btn primary', onclick: () => G.sync({ interactive: true }).then((ok) => { if (ok) toast('Eşitlendi'); rerender(); }) }, 'Şimdi eşitle'),
      connected ? h('button', { class: 'btn ghost', onclick: () => { G.disconnect(); rerender(); toast('Google bağlantısı kesildi'); } }, 'Bağlantıyı kes') : null) : null,
    connected ? h('div', { class: 'grid-2' },
      field('Eşitlenecek takvim', calSel),
      field('Otomatik eşitleme', (() => {
        const sel = h('select', {}, [[0, 'Kapalı'], [5, '5 dakikada bir'], [10, '10 dakikada bir'], [30, '30 dakikada bir']].map(([v, l]) => h('option', { value: v }, l)));
        sel.value = s.autoSyncMin; sel.onchange = () => { s.autoSyncMin = Number(sel.value); commit('settings'); };
        return sel;
      })())) : null,
    connected ? h('div', { class: 'row' }, h('button', {
      class: 'btn small ghost', onclick: () => { const n = G.markAllLocalForSync(); toast(n ? `${n} plan Google'a gönderilecek` : 'Gönderilmemiş plan yok'); },
    }, 'Google\'a gönderilmemiş planları da gönder')) : null,
    help);
}

function categoriesSection() {
  const wrap = h('section', { class: 'panel' }, h('h3', {}, 'Plan kategorileri'),
    h('p', { class: 'muted small' }, 'Varsayılan süre ve hatırlatma, yeni plan eklerken otomatik dolar.'));
  const list = h('div', { class: 'cat-list' });
  const render = () => list.replaceChildren(...state.categories.map((c) => {
    const picker = h('div', { class: 'icon-picker', hidden: true, role: 'group', 'aria-label': `${c.name} için ikon` },
      ICON_CHOICES.map((k) => h('button', {
        type: 'button', class: `ip-btn ${c.icon === k ? 'on' : ''}`, 'aria-label': ICON_NAMES[k] || k, title: ICON_NAMES[k] || k, 'aria-pressed': String(c.icon === k),
        onclick: () => { c.icon = k; commit('settings'); render(); },
      }, ic(k, { size: 18 }))));
    const icon = h('button', {
      type: 'button', class: 'cat-icon', style: { color: c.color }, 'aria-label': 'İkonu değiştir', 'aria-expanded': 'false',
      onclick: () => { picker.hidden = !picker.hidden; icon.setAttribute('aria-expanded', String(!picker.hidden)); },
    }, ic(c.icon, { size: 20 }));
    const name = h('input', { type: 'text', value: c.name, 'aria-label': 'Ad' });
    const color = h('input', { type: 'color', value: c.color, 'aria-label': 'Renk' });
    const dur = h('select', { 'aria-label': 'Varsayılan süre' }, [30, 60, 90, 120, 180, 240].map((m) => h('option', { value: m }, m < 60 ? `${m} dk` : `${m / 60} sa`)));
    dur.value = c.duration || 60;
    const upd = () => { c.name = name.value || c.name; c.color = color.value; icon.style.color = c.color; c.duration = Number(dur.value); commit('settings'); };
    name.onchange = upd; color.oninput = upd; dur.onchange = upd;
    const builtIn = ['diger', 'sinav', 'gorev'].includes(c.id);
    return h('div', { class: 'cat-item' }, h('div', { class: 'cat-row' }, icon, name, color, dur,
      h('button', {
        class: 'icon-btn', disabled: builtIn, title: builtIn ? 'Bu kategori silinemez' : 'Sil', 'aria-label': `${c.name} kategorisini sil`,
        onclick: async () => {
          if (!await confirmDialog({ title: 'Kategori silinsin mi?', message: `"${c.name}" kategorisindeki planlar "Diğer"e taşınır.`, okLabel: 'Sil', danger: true })) return;
          for (const e of state.events) if (e.categoryId === c.id) e.categoryId = 'diger';
          state.categories = state.categories.filter((x) => x !== c); commit('settings'); render();
        },
      }, '✕')), picker);
  }));
  render();
  wrap.append(list, h('button', { class: 'btn small ghost', onclick: () => { state.categories.push({ id: uid(), name: 'Yeni kategori', icon: 'star', color: PALET[state.categories.length % PALET.length], duration: 60, reminder: 30 }); commit('settings'); render(); } }, '+ Kategori ekle'));
  return wrap;
}

function taskCategoriesSection() {
  const wrap = h('section', { class: 'panel' }, h('h3', {}, 'Görev kategorileri'));
  const list = h('div', { class: 'cat-list' });
  const render = () => list.replaceChildren(...state.taskCategories.map((c) => {
    const name = h('input', { type: 'text', value: c.name, 'aria-label': 'Ad' });
    const color = h('input', { type: 'color', value: c.color, 'aria-label': 'Renk' });
    name.onchange = () => { c.name = name.value || c.name; commit('settings'); };
    color.oninput = () => { c.color = color.value; commit('settings'); };
    return h('div', { class: 'cat-row two' }, name, color, h('button', {
      class: 'icon-btn', 'aria-label': `${c.name} kategorisini sil`, onclick: () => {
        for (const t of state.tasks) if (t.categoryId === c.id) t.categoryId = '';
        state.taskCategories = state.taskCategories.filter((x) => x !== c); commit('settings'); render();
      },
    }, '✕'));
  }));
  render();
  wrap.append(list, h('button', { class: 'btn small ghost', onclick: () => { state.taskCategories.push({ id: uid(), name: 'Yeni', color: PALET[(state.taskCategories.length + 3) % PALET.length] }); commit('settings'); render(); } }, '+ Kategori ekle'));
  return wrap;
}

function displaySection(rerender) {
  const s = state.settings;
  const theme = h('select', {}, [['auto', 'Sistemle aynı'], ['light', 'Açık'], ['dark', 'Koyu']].map(([v, l]) => h('option', { value: v }, l)));
  theme.value = s.theme; theme.onchange = () => { s.theme = theme.value; commit('settings'); };
  const hours = [...Array(25)].map((_, i) => [i, `${String(i).padStart(2, '0')}:00`]);
  const ds = h('select', {}, hours.slice(0, 24).map(([v, l]) => h('option', { value: v }, l)));
  const de = h('select', {}, hours.slice(1).map(([v, l]) => h('option', { value: v }, l)));
  ds.value = s.dayStartHour; de.value = s.dayEndHour;
  const upd = () => {
    if (Number(de.value) <= Number(ds.value)) { toast('Bitiş saati başlangıçtan sonra olmalı', { kind: 'warn' }); ds.value = s.dayStartHour; de.value = s.dayEndHour; return; }
    s.dayStartHour = Number(ds.value); s.dayEndHour = Number(de.value); commit('settings');
  };
  ds.onchange = upd; de.onchange = upd;
  const fs = h('input', { type: 'time', value: s.freeSlotStart });
  const fe = h('input', { type: 'time', value: s.freeSlotEnd });
  fs.onchange = () => { s.freeSlotStart = fs.value || '09:00'; commit('settings'); };
  fe.onchange = () => { s.freeSlotEnd = fe.value || '22:00'; commit('settings'); };
  const showC = h('input', { type: 'checkbox', checked: s.showCoursesInMonth });
  showC.onchange = () => { s.showCoursesInMonth = showC.checked; commit('settings'); };

  const perm = permission();
  // Renk teması, kendi rengin, kadran deseni
  const palRow = h('div', { class: 'pal-row', role: 'radiogroup', 'aria-label': 'Renk teması' });
  const curPal = () => PALETTE_ALIAS[s.palette] || s.palette;
  const renderPal = () => palRow.replaceChildren(...Object.entries(PALETTES).map(([id, p]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(curPal() === id), class: `pal ${curPal() === id ? 'on' : ''}`,
    onclick: () => { s.palette = id; commit('settings'); renderPal(); },
  }, h('span', { class: 'pal-sw', style: { background: p.light.hero } }), p.name)));
  renderPal();
  const accentOn = h('input', { type: 'checkbox', checked: !!s.accent });
  const accentIn = h('input', { type: 'color', value: s.accent || PALETTES[s.palette]?.light.hero || '#0E8C8A', disabled: !s.accent, 'aria-label': 'Vurgu rengi' });
  accentOn.onchange = () => { accentIn.disabled = !accentOn.checked; s.accent = accentOn.checked ? accentIn.value : ''; commit('settings'); };
  accentIn.oninput = () => { if (accentOn.checked) { s.accent = accentIn.value; commit('settings'); } };
  const pattern = h('select', {}, [['none', 'Yok'], ['soft', 'Hafif'], ['strong', 'Belirgin']].map(([v, l]) => h('option', { value: v }, l)));
  pattern.value = s.pattern || 'soft';
  pattern.onchange = () => { s.pattern = pattern.value; commit('settings'); };
  return h('section', { class: 'panel' }, h('h3', {}, 'Görünüm ve hatırlatmalar'),
    field('Renk teması', palRow),
    h('div', { class: 'grid-3' },
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Vurgu rengi'), h('div', { class: 'row' }, h('label', { class: 'check' }, accentOn, h('span', {}, 'Kendi rengim')), accentIn)),
      field('Renk bloklarında desen', pattern),
      field('Açık / koyu', theme)),
    h('div', { class: 'grid-2' }, field('Haftalık görünüm başlangıcı', ds), field('Haftalık görünüm bitişi', de)),
    h('div', { class: 'grid-2' }, field('Görev yerleştirme: en erken', fs, 'Boş zaman ararken bu saatten önceye koymaz'), field('Görev yerleştirme: en geç', fe)),
    h('label', { class: 'check' }, showC, h('span', {}, 'Ay ve ajanda görünümünde dersleri de göster')),
    h('div', { class: 'row' },
      h('span', {}, 'Tarayıcı bildirimleri: ', h('strong', {}, { granted: 'açık', denied: 'engellenmiş', default: 'kapalı', unsupported: 'desteklenmiyor' }[perm])),
      perm === 'default' ? h('button', { class: 'btn small', onclick: async () => { await requestPermission(); rerender(); } }, 'Bildirimlere izin ver') : null),
    h('p', { class: 'muted small' }, 'Hatırlatmalar Vazifedar sekmesi açıkken çalışır. Telefonda da hatırlatma istiyorsan planları Google Takvim ile eşitle.'));
}

function pinsSection(rerender) {
  const p = state.settings.pins;
  const save = (re = false) => { commit('settings'); if (re) rerender(); };
  const showFrom = h('input', { type: 'time', value: p.showFrom || '18:00', step: 900 });
  showFrom.onchange = () => { p.showFrom = showFrom.value || '18:00'; save(); };
  const on = h('input', { type: 'checkbox', checked: p.notify !== false });
  const at = h('input', { type: 'time', value: p.notifyAt || '21:00', step: 900, disabled: p.notify === false });
  on.onchange = () => { p.notify = on.checked; at.disabled = !on.checked; before.disabled = !on.checked; save(); };
  at.onchange = () => { p.notifyAt = at.value || '21:00'; save(); };
  const before = h('select', { disabled: p.notify === false }, [['', 'Kapalı'], ['30', '30 dk önce'], ['60', '1 saat önce'], ['90', '1,5 saat önce'], ['120', '2 saat önce']].map(([v, l]) => h('option', { value: v }, l)));
  before.value = p.beforeMin === null || p.beforeMin === undefined ? '' : String(p.beforeMin);
  before.onchange = () => { p.beforeMin = before.value === '' ? null : Number(before.value); save(); };
  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h3', {}, 'Unutma notları ve çanta'), h('label', { class: 'check' }, on, h('span', {}, 'Bildirim'))),
    h('p', { class: 'muted small' }, 'Bir derse ya da plana tıklayıp "Unutma" kısmına yazdığın notlar, o günden önceki akşam Bugün ekranında "Yarının çantası" olarak çıkar.'),
    h('div', { class: 'grid-3' },
      field('Yarının çantası görünsün', showFrom, 'Bu saatten sonra Bugün ekranı yarını gösterir'),
      field('Akşam bildirimi', at, 'Yarın için işaretlenmemiş not varsa'),
      field('Kayıttan önce', before, 'O dersin/planın notlarını hatırlatır')));
}

function prayerSection(rerender) {
  const p = state.settings.prayer;
  const save = (re = true) => { commit('settings'); if (re) rerender(); };
  const on = h('input', { type: 'checkbox', checked: !!p.enabled });
  on.onchange = () => { p.enabled = on.checked; save(); };
  const head = h('div', { class: 'panel-head' }, h('h3', {}, 'Namaz vakitleri'),
    h('label', { class: 'check' }, on, h('span', {}, 'Göster')));
  if (!p.enabled) {
    return h('section', { class: 'panel' }, head,
      h('p', { class: 'muted small' }, 'Açınca vakitler Bugün ekranında, kadranda ve haftalık takvimde görünür; istersen vakit girerken hatırlatır.'));
  }

  // Şehir: 81 il ya da tarayıcının verdiği konum
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
    type: 'button', class: 'btn small ghost', disabled: !('geolocation' in navigator),
    onclick: () => {
      geo.disabled = true; geo.textContent = 'Konum alınıyor…';
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = Math.round(pos.coords.latitude * 1e4) / 1e4, lng = Math.round(pos.coords.longitude * 1e4) / 1e4;
        const near = ILLER.map(([n, a, b]) => [n, (a - lat) ** 2 + ((b - lng) * Math.cos((lat * Math.PI) / 180)) ** 2]).sort((x, y) => x[1] - y[1])[0];
        Object.assign(p, { lat, lng, city: near && near[1] < 1 ? `Konumum (${near[0]} yakını)` : 'Konumum' });
        save(); toast('Vakitler bulunduğun konuma göre hesaplanıyor');
      }, (err) => {
        geo.disabled = false; geo.textContent = 'Konumumu kullan';
        toast(err.code === 1 ? 'Konum izni verilmedi' : 'Konum alınamadı', { kind: 'warn' });
      }, { timeout: 15000, maximumAge: 600000 });
    },
  }, 'Konumumu kullan');

  // Bugünün vakitleri (önizleme)
  const t = timesFor(new Date());
  const preview = h('ol', { class: 'pr-preview', 'aria-label': 'Bugünün vakitleri' },
    VAKITLER.map((v) => h('li', {}, h('span', {}, v.name), h('b', {}, timeStr(t[v.id])))));

  const chk = (key, label) => {
    const c = h('input', { type: 'checkbox', checked: p[key] !== false });
    c.onchange = () => { p[key] = c.checked; save(false); };
    return h('label', { class: 'check' }, c, h('span', {}, label));
  };

  // Hatırlatma
  const rem = h('select', {}, [['', 'Kapalı'], ['0', 'Vakit girince'], ['5', '5 dk önce'], ['10', '10 dk önce'], ['15', '15 dk önce'], ['30', '30 dk önce'], ['45', '45 dk önce']]
    .map(([v, l]) => h('option', { value: v }, l)));
  rem.value = p.notifyMin === null || p.notifyMin === undefined ? '' : String(p.notifyMin);
  rem.onchange = () => { p.notifyMin = rem.value === '' ? null : Number(rem.value); save(); };
  const which = p.notifyMin === null || p.notifyMin === undefined ? null : h('div', { class: 'row pr-which', role: 'group', 'aria-label': 'Hangi vakitlerde' },
    VAKITLER.map((v) => {
      const c = h('input', { type: 'checkbox', checked: (p.notifyIds || []).includes(v.id) });
      c.onchange = () => {
        const set = new Set(p.notifyIds || []);
        if (c.checked) set.add(v.id); else set.delete(v.id);
        p.notifyIds = VAKITLER.map((x) => x.id).filter((id) => set.has(id)); save(false);
      };
      return h('label', { class: 'check' }, c, h('span', {}, v.name));
    }));

  // İnce ayar: Diyanet takvimiyle karşılaştırıp dakika ekle/çıkar
  const offs = h('div', { class: 'pr-offsets' }, VAKITLER.map((v) => {
    const n = h('input', { type: 'number', min: -30, max: 30, step: 1, value: p.offsets?.[v.id] || 0, class: 'num', 'aria-label': `${v.name} için dakika düzeltmesi` });
    n.onchange = () => {
      const val = Math.max(-30, Math.min(30, Math.round(Number(n.value) || 0)));
      p.offsets = { ...(p.offsets || {}), [v.id]: val }; save();
    };
    return h('label', { class: 'field' }, h('span', { class: 'field-label' }, v.name), n);
  }));
  const anyOff = VAKITLER.some((v) => Number(p.offsets?.[v.id]));

  return h('section', { class: 'panel' }, head,
    h('div', { class: 'row grow' }, field('Şehir', city), geo),
    preview,
    h('div', { class: 'row' }, chk('onDial', 'Bugün kadranında göster'), chk('inWeek', 'Haftalık takvimde göster')),
    h('div', { class: 'grid-2' }, field('Hatırlatma', rem, 'Vazifedar sekmesi açıkken bildirim gönderir'), which ? field('Hangi vakitlerde', which) : h('div')),
    h('details', { class: 'help', open: anyOff || null },
      h('summary', {}, 'İnce ayar (dakika)'),
      h('p', { class: 'muted small' }, 'Vakitler Diyanet yöntemiyle (İmsak 18°, Yatsı 17°, Diyanet temkinleri) bu cihazda hesaplanır; internet gerekmez. Diyanet\'in yayımladığı takvimle bir iki dakika fark görürsen ilgili vakte + ya da − dakika ekle.'),
      offs));
}

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
  return h('section', { class: 'panel' }, h('h3', {}, 'Veriler'),
    h('p', { class: 'muted small' }, `Verilerin bu tarayıcıda saklanıyor: ${state.events.filter((e) => !e.deleted).length} plan, ${state.courses.length} ders, ${state.tasks.length} görev, ${state.notes.length} unutma notu, ${Object.keys(state.journal).length} defter sayfası. Google'a yalnız planlar gider; görevler, ders programı, notlar ve defter yalnız burada durur.`),
    h('h4', { class: 'sub-h' }, 'Otomatik yedek'), backupPanel(),
    h('h4', { class: 'sub-h' }, 'Elle yedek'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => downloadBackup() }, 'Yedek indir'),
      h('button', { class: 'btn', onclick: () => file.click() }, 'Yedekten yükle'), file,
      h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmDialog({ title: 'Her şey silinsin mi?', message: 'Planlar, dersler, görevler ve ayarlar bu tarayıcıdan silinir. Google Takvim\'deki etkinliklere dokunulmaz.', okLabel: 'Hepsini sil', danger: true })) { resetState(); toast('Tüm veriler silindi'); } } }, 'Her şeyi sil')));
}

export function renderSettings(root) {
  const rerender = () => renderSettings(root);
  root.replaceChildren(h('div', { class: 'settings' },
    googleSection(rerender), displaySection(rerender), pinsSection(rerender), prayerSection(rerender), categoriesSection(), taskCategoriesSection(), dataSection(), appPanel()));
}
