// Google Takvim eşitlemesi (tarayıcıdan, sunucusuz).
// Google Identity Services ile erişim anahtarı alınır, Calendar API v3 doğrudan çağrılır.
import { state, commit, uid, breakOn, inTerm } from './store.js';
import { parseLocal, toLocalISO, toDateKey, addDays, isoWeekday } from './dates.js';
import { isRecurring, toRecurrence } from './recurrence.js';
import { cloudSync } from './cloud.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'; // yalnız Vazifedar'ın gizli klasörü
const SCOPES = `https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly ${DRIVE_SCOPE}`;
const API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_KEY = 'vazifedar:gtoken';
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul';

// Google'ın sabit etkinlik renkleri (colorId) ile kategoriler
const G_COLORS = { sinav: '11', konser: '3', halisaha: '10', arkadas: '5', roket: '9', gorev: '7', diger: '8' };

let tokenClient = null;
let pending = null; // bekleyen izin isteğinin işleyicileri
let token = null;
let tokenExp = 0;
let gisPromise = null;
let syncing = null;
let pushTimer = null;
let cloudTimer = null;
let cloud = { state: 'off', message: '' }; // görev/ders eşitlemesinin durumu
let status = { state: 'off', message: '' };
const statusListeners = new Set();

export function onStatus(fn) { statusListeners.add(fn); fn(status); return () => statusListeners.delete(fn); }
function setStatus(st, message = '') { status = { state: st, message }; for (const fn of statusListeners) fn(status); }
export function getStatus() { return status; }
export function getCloudStatus() { return cloud; }
function setCloud(st, message = '') { cloud = { state: st, message }; }

// Bulut eşitlemesi (görevler, dersler, notlar, defter) açık mı ve izni alınmış mı
export function cloudEnabled() { return state.settings.cloudSync !== false; }
// İzinler genişledi (Drive): bu cihazda henüz yeni izinle bağlanılmadıysa bir kez onay gerekir
export function needsConsent() { return !!state.settings.googleConnected && state.settings.googleScopes !== SCOPES; }

// Oturum içinde anahtarı sakla (sayfa yenilenince tekrar izin istemesin)
try {
  const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
  if (saved && saved.exp > Date.now() + 60000) { token = saved.token; tokenExp = saved.exp; }
} catch { /* yok say */ }

export function hasToken() { return !!token && Date.now() < tokenExp - 60000; }
export function isConfigured() { return !!state.settings.googleClientId; }

export function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { gisPromise = null; reject(new Error('Google oturum betiği yüklenemedi. İnternet bağlantını kontrol et.')); };
    document.head.append(s);
  });
  return gisPromise;
}

function ensureTokenClient() {
  if (tokenClient && tokenClient._cid === state.settings.googleClientId) return tokenClient;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: state.settings.googleClientId,
    scope: SCOPES,
    callback: (resp) => pending?.onResp(resp),
    error_callback: (err) => pending?.onErr(err),
  });
  tokenClient._cid = state.settings.googleClientId;
  return tokenClient;
}

// Kullanıcı tıklamasıyla çağrılmalı (açılır pencere engellenmesin diye önce GIS yüklenmiş olmalı)
export function connect() {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) { reject(new Error('Önce Ayarlar\'a Google OAuth istemci kimliğini gir.')); return; }
    const go = () => {
      const tc = ensureTokenClient();
      pending = {};
      pending.onResp = (resp) => {
        pending = null;
        if (resp.error) { setStatus('error', `Google izni alınamadı: ${resp.error}`); reject(new Error(resp.error)); return; }
        token = resp.access_token;
        const oa = window.google?.accounts?.oauth2;
        const granted = oa?.hasGrantedAllScopes ? oa.hasGrantedAllScopes(resp, DRIVE_SCOPE) : String(resp.scope || '').includes(DRIVE_SCOPE);
        state.settings.googleScopes = SCOPES;
        state.settings.cloudGranted = !!granted;
        tokenExp = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: tokenExp })); } catch { /* yok say */ }
        state.settings.googleConnected = true;
        commit('settings');
        setStatus('idle', 'Bağlandı');
        resolve();
      };
      pending.onErr = (err) => {
        pending = null;
        setStatus('error', err?.type === 'popup_closed' ? 'Google penceresi kapatıldı' : 'Google penceresi açılamadı (açılır pencere engelleyiciyi kontrol et)');
        reject(new Error(err?.type || 'popup'));
      };
      tc.requestAccessToken({ prompt: state.settings.googleConnected && !needsConsent() ? '' : 'consent' });
    };
    if (window.google?.accounts?.oauth2) go();
    else loadGis().then(go, (e) => { setStatus('error', e.message); reject(e); });
  });
}

export function disconnect() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  token = null; tokenExp = 0;
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* yok say */ }
  state.settings.googleConnected = false;
  state.settings.googleScopes = '';
  commit('settings');
  setCloud('off');
  setStatus('off', '');
}

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// path: Calendar API'ye göre yol ya da tam adres (Drive). raw: hazır gövde (contentType ile).
async function api(method, path, { body, query, raw, contentType } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null))}` : '';
  const url = path.startsWith('https://') ? path : `${API}${path}`;
  const ct = raw !== undefined ? (contentType || 'application/json') : body ? 'application/json' : null;
  const res = await fetch(`${url}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(ct ? { 'Content-Type': ct } : {}) },
    body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    token = null; tokenExp = 0;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* yok say */ }
    throw new ApiError(401, 'Google oturumunun süresi doldu');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* boş gövde */ }
  if (!res.ok) throw new ApiError(res.status, data?.error?.message || `Google API hatası (${res.status})`);
  return data;
}

const calPath = () => `/calendars/${encodeURIComponent(state.settings.googleCalendarId || 'primary')}`;

export async function listCalendars() {
  const data = await api('GET', '/users/me/calendarList', { query: { minAccessRole: 'writer' } });
  return (data?.items || []).map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, primary: !!c.primary, color: c.backgroundColor }));
}

// Takvim değişince: Google'dan gelenleri kaldır, yereldekileri yeni takvime gönderilecek işaretle
export function setCalendar(id, name) {
  if (id === state.settings.googleCalendarId) return;
  state.events = state.events.filter((e) => !(e.source === 'google' && e.googleId));
  for (const e of state.events) {
    if (e.deleted) continue;
    if (e.googleId) { e.googleId = null; e.googleUpdated = null; e.dirty = !!e.syncToGoogle; }
  }
  state.events = state.events.filter((e) => !e.deleted);
  for (const c of state.courses) for (const s of c.sessions) s.googleId = null;
  state.settings.googleCalendarId = id;
  state.settings.googleCalendarName = name || id;
  commit('settings');
}

// ---------- Dönüşümler ----------
export function guessCategory(title) {
  const t = (title || '').toLocaleLowerCase('tr');
  if (/sınav|sinav|vize|final|quiz|midterm|exam|bütünleme|ara sınav/.test(t)) return 'sinav';
  if (/konser|concert|festival|sahne/.test(t)) return 'konser';
  if (/halı ?saha|hali ?saha|futbol|maç\b|mac\b/.test(t)) return 'halisaha';
  if (/roket|teknofest|aviyonik|avionik|ukb/.test(t)) return 'roket';
  if (/arkadaş|arkadas|kahve|yemek|buluşma|bulusma|doğum günü partisi/.test(t)) return 'arkadas';
  return 'diger';
}

export function toGoogle(ev) {
  const body = {
    summary: ev.title,
    location: ev.location || '',
    description: ev.notes || '',
    extendedProperties: { private: { vazifedarId: ev.id, vazifedarCategory: ev.categoryId } },
    reminders: ev.reminderMin === null || ev.reminderMin === undefined
      ? { useDefault: false, overrides: [] }
      : { useDefault: false, overrides: [{ method: 'popup', minutes: Math.min(40320, ev.reminderMin) }] },
  };
  if (G_COLORS[ev.categoryId]) body.colorId = G_COLORS[ev.categoryId];
  if (isRecurring(ev)) body.recurrence = toRecurrence(ev, TZ);
  else if (ev.recurPushed) body.recurrence = [];
  if (ev.allDay) {
    body.start = { date: ev.start.slice(0, 10) };
    body.end = { date: toDateKey(addDays(parseLocal(ev.end.slice(0, 10)), 1)) };
  } else {
    body.start = { dateTime: `${ev.start}:00`, timeZone: TZ };
    body.end = { dateTime: `${ev.end}:00`, timeZone: TZ };
  }
  return body;
}

export function fromGoogle(g) {
  const allDay = !!g.start?.date;
  let start, end;
  if (allDay) {
    start = `${g.start.date}T00:00`;
    end = `${toDateKey(addDays(parseLocal(g.end?.date || g.start.date), -1))}T23:59`;
    if (end < start) end = `${g.start.date}T23:59`;
  } else {
    start = toLocalISO(new Date(g.start.dateTime));
    end = toLocalISO(new Date(g.end?.dateTime || g.start.dateTime));
  }
  const ov = g.reminders?.overrides?.[0];
  const title = g.summary || '(Başlıksız)';
  return {
    title, start, end, allDay,
    location: g.location || '',
    notes: g.description || '',
    categoryId: g.extendedProperties?.private?.vazifedarCategory || guessCategory(title),
    reminderMin: ov ? ov.minutes : (g.reminders?.useDefault ? state.settings.defaultReminder : null),
  };
}

// ---------- Eşitleme ----------
async function push() {
  for (const ev of [...state.events]) {
    if (!ev.syncToGoogle) continue;
    if (ev.deleted) {
      if (ev.googleId) {
        try { await api('DELETE', `${calPath()}/events/${encodeURIComponent(ev.googleId)}`); } catch (e) { if (![404, 410].includes(e.status)) throw e; }
      }
      state.events.splice(state.events.indexOf(ev), 1);
      continue;
    }
    if (!ev.dirty && ev.googleId) continue;
    const body = toGoogle(ev);
    let res;
    if (ev.googleId) {
      try { res = await api('PATCH', `${calPath()}/events/${encodeURIComponent(ev.googleId)}`, { body }); } catch (e) {
        if (![404, 410].includes(e.status)) throw e;
        res = await api('POST', `${calPath()}/events`, { body });
      }
    } else {
      res = await api('POST', `${calPath()}/events`, { body });
    }
    ev.googleId = res.id; ev.googleUpdated = res.updated; ev.dirty = false; ev.recurPushed = isRecurring(ev);
  }
}

async function pull() {
  const now = new Date();
  const timeMin = addDays(now, -60), timeMax = addDays(now, 365);
  const courseGids = new Set(state.courses.flatMap((c) => c.sessions.map((s) => s.googleId).filter(Boolean)));
  const seen = new Set();
  let pageToken;
  do {
    const data = await api('GET', `${calPath()}/events`, {
      query: { singleEvents: 'true', orderBy: 'startTime', maxResults: 2500, timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), pageToken },
    });
    for (const g of data?.items || []) {
      if (g.status === 'cancelled') continue;
      const priv = g.extendedProperties?.private || {};
      if (priv.vazifedarCourse || courseGids.has(g.id) || (g.recurringEventId && courseGids.has(g.recurringEventId))) continue;
      // Vazifedar'da tekrarlayan olarak tutulan serinin tekrarları: seri yerelde yönetiliyor
      if (g.recurringEventId) {
        const master = state.events.find((e) => e.googleId === g.recurringEventId && isRecurring(e));
        if (master) { seen.add(master.googleId); continue; }
      }
      seen.add(g.id);
      let local = state.events.find((e) => e.googleId === g.id);
      if (!local && priv.vazifedarId && !g.recurringEventId) {
        local = state.events.find((e) => e.id === priv.vazifedarId && !e.googleId);
        if (local) local.googleId = g.id;
      }
      // Başka bir cihazda oluşturulmuş planın kimliğini koru: görevlerin "yerleştirildiği plan" ve
      // plana bağlı unutma notları cihazlar arasında aynı plana işaret etsin
      const vid = !g.recurringEventId && priv.vazifedarId && !state.events.some((e) => e.id === priv.vazifedarId) ? priv.vazifedarId : null;
      if (local && vid && local.source === 'google') renameEvent(local, vid);
      if (local) {
        if (local.deleted || local.dirty || !local.syncToGoogle) continue;
        if (isRecurring(local)) continue;
        if (local.googleUpdated !== g.updated) Object.assign(local, fromGoogle(g), { googleUpdated: g.updated });
      } else {
        state.events.push({
          id: vid || uid(), ...fromGoogle(g), googleId: g.id, googleUpdated: g.updated, syncToGoogle: true,
          source: 'google', dirty: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
    }
    pageToken = data?.nextPageToken;
  } while (pageToken);

  // Google'da silinenleri yerelden de kaldır
  const removed = new Set();
  state.events = state.events.filter((e) => {
    if (!e.googleId || !e.syncToGoogle || e.dirty || e.deleted || seen.has(e.googleId)) return true;
    const s = parseLocal(e.start), en = parseLocal(e.end);
    if (en < timeMin || s > timeMax) return true;
    removed.add(e.id);
    return false;
  });
  for (const t of state.tasks) if (removed.has(t.scheduledEventId)) t.scheduledEventId = null;
}

function renameEvent(ev, id) {
  const old = ev.id;
  ev.id = id;
  for (const t of state.tasks) if (t.scheduledEventId === old) t.scheduledEventId = id;
  for (const n of state.notes) if (n.target?.eventId === old) n.target.eventId = id;
}

// Görevler, ders programı, notlar, defter → Google Drive (gizli uygulama klasörü)
async function runCloud() {
  if (!cloudEnabled()) { setCloud('off'); return; }
  if (needsConsent() || !state.settings.cloudGranted) {
    setCloud('needs-auth', needsConsent()
      ? 'Görevler ve ders programının da eşitlenmesi için bir kez yeniden bağlan.'
      : 'Google bağlanırken Drive izni verilmedi. Görevler ve ders programı eşitlenmiyor; "Yeniden bağlan" ile izni ver.');
    return;
  }
  setCloud('syncing', 'Eşitleniyor…');
  try {
    let r = await cloudSync(api);
    if (r.retry) r = await cloudSync(api);
    state.settings.cloudLastSync = new Date().toISOString();
    setCloud('idle', 'Eşitlendi');
  } catch (e) {
    console.error(e);
    const msg = String(e.message || '');
    if (e.status === 403 && /has not been used|is disabled|accessNotConfigured/i.test(msg)) {
      setCloud('error', 'Google Drive API kapalı: Google Cloud Console\'da Vazifedar projesi için "Google Drive API"yi etkinleştir.');
    } else if (e.status === 403 && /insufficient/i.test(msg)) {
      state.settings.googleScopes = '';
      setCloud('needs-auth', 'Drive izni eksik; "Yeniden bağlan" ile izni ver.');
    } else if (e.status === 401) throw e;
    else setCloud('error', `Görev/ders eşitlemesi başarısız: ${msg || 'bilinmeyen hata'}`);
  }
}

export function sync({ interactive = false, cloudOnly = false } = {}) {
  if (!isConfigured() || !state.settings.googleConnected && !interactive) return Promise.resolve(false);
  if (syncing) { syncing.again = true; if (!cloudOnly) syncing.full = true; return syncing.p; }
  if (!hasToken() || (interactive && needsConsent() && cloudEnabled())) {
    if (!interactive) { setStatus('needs-auth', 'Google oturumu yenilenmeli'); return Promise.resolve(false); }
    return connect().then(() => sync({ interactive: false }), () => false);
  }
  const run = async () => {
    setStatus('syncing', 'Eşitleniyor…');
    try {
      if (!cloudOnly) {
        await push();
        await pull();
        state.settings.lastSync = new Date().toISOString();
      }
      await runCloud();
      commit('sync');
      if (cloud.state === 'needs-auth' && needsConsent()) setStatus('needs-auth', cloud.message);
      else if (cloud.state === 'error') setStatus('error', cloud.message);
      else setStatus('idle', 'Eşitlendi');
      return true;
    } catch (e) {
      commit('sync');
      console.error(e);
      if (e.status === 401) setStatus('needs-auth', 'Google oturumunun süresi doldu');
      else setStatus('error', e.message || 'Eşitleme başarısız');
      return false;
    }
  };
  const holder = { again: false, cloudOnly };
  holder.p = run().then(async (ok) => {
    syncing = null;
    if (holder.again) return sync({ cloudOnly: !holder.full });
    return ok;
  });
  syncing = holder;
  return holder.p;
}

// Değişiklikten kısa süre sonra sadece gönder+çek
export function schedulePush() {
  if (!isConfigured() || !state.settings.googleConnected) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { sync(); }, 1500);
}

// Görev/ders/not/defter değişikliğinden birkaç saniye sonra yalnız bulut eşitlemesi
export function scheduleCloud() {
  if (!isConfigured() || !state.settings.googleConnected || !cloudEnabled() || !state.settings.cloudGranted || needsConsent()) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => { if (hasToken()) sync({ cloudOnly: true }); }, 4000);
}

// ---------- Ders programını Google'a aktar ----------
function utcStamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function localStamp(dateKey, hm) {
  return `${dateKey.replace(/-/g, '')}T${hm.replace(':', '')}00`;
}

export async function exportCourses() {
  const { start, end } = state.term;
  if (!start || !end) throw new Error('Önce dönem başlangıç ve bitiş tarihlerini gir.');
  if (!hasToken()) await connect();
  await removeCoursesFromGoogle({ silent: true });
  let count = 0;
  for (const c of state.courses) {
    for (const s of c.sessions) {
      let first = parseLocal(start);
      while (isoWeekday(first) !== Number(s.day)) first = addDays(first, 1);
      const firstKey = toDateKey(first);
      if (firstKey > end) continue;
      const until = utcStamp(new Date(parseLocal(`${end}T23:59`).getTime() + 59000));
      const ex = [];
      for (let d = first; toDateKey(d) <= end; d = addDays(d, 7)) {
        const k = toDateKey(d);
        if (breakOn(d) || !inTerm(d) || c.skips.includes(`${s.id}|${k}`)) ex.push(localStamp(k, s.start));
      }
      const recurrence = [`RRULE:FREQ=WEEKLY;UNTIL=${until}`];
      if (ex.length) recurrence.push(`EXDATE;TZID=${TZ}:${ex.join(',')}`);
      const body = {
        summary: [c.code, c.name].filter(Boolean).join(' '),
        location: s.location || '',
        description: [s.type, c.instructor].filter(Boolean).join(' – '),
        start: { dateTime: `${firstKey}T${s.start}:00`, timeZone: TZ },
        end: { dateTime: `${firstKey}T${s.end}:00`, timeZone: TZ },
        recurrence,
        colorId: '9',
        reminders: { useDefault: false, overrides: [] },
        extendedProperties: { private: { vazifedarCourse: c.id, vazifedarSession: s.id } },
      };
      const res = await api('POST', `${calPath()}/events`, { body });
      s.googleId = res.id;
      count++;
    }
  }
  commit('courses');
  return count;
}

export async function removeCoursesFromGoogle({ silent = false } = {}) {
  if (!hasToken()) await connect();
  let n = 0;
  for (const c of state.courses) {
    for (const s of c.sessions) {
      if (!s.googleId) continue;
      try { await api('DELETE', `${calPath()}/events/${encodeURIComponent(s.googleId)}`); n++; } catch (e) { if (![404, 410].includes(e.status)) throw e; }
      s.googleId = null;
    }
  }
  if (!silent) commit('courses');
  return n;
}

// Bağlanmadan önce yerelde oluşturulmuş planları da Google'a gönder
export function markAllLocalForSync() {
  let n = 0;
  for (const e of state.events) {
    if (!e.deleted && !e.googleId && !e.syncToGoogle) { e.syncToGoogle = true; e.dirty = true; n++; }
  }
  commit('events', { pushGoogle: true });
  return n;
}
