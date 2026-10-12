// Bulut eşitleme: Google Takvim'e gitmeyen veriler (ders programı, görevler, unutma notları, defter,
// kadran arşivi, kategoriler) Google Drive'daki gizli uygulama klasöründe (appDataFolder) tek bir
// JSON dosyasında tutulur. Bu klasörü yalnız Vazifedar görür; Drive'ında dosya olarak görünmez.
//
// Birleştirme üç yönlüdür: her cihaz son eşitlediği hâli ("taban") saklar. Bir kayıt yalnız bir
// tarafta değiştiyse o değişiklik alınır (silme dahil); iki tarafta da değiştiyse daha yeni olan
// (updatedAt varsa) ya da bu cihazdaki kazanır. Hiç tabanı olmayan ilk eşitlemede hiçbir şey
// silinmez, iki taraf birleşir.
import { state, commit, subscribe } from './store.js';

const FILE = 'vazifedar-veri.json';
const BASE_KEY = 'vazifedar:cloudbase';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

const LISTS = ['courses', 'tasks', 'notes', 'categories', 'taskCategories']; // id'li diziler
const MAPS = ['journal', 'archive'];                                          // tarih → kayıt
const SINGLES = ['term'];                                                     // tek nesne
export const CLOUD_KEYS = [...LISTS, ...MAPS, ...SINGLES];

const str = (v) => (v === undefined ? undefined : JSON.stringify(v));
const same = (a, b) => str(a) === str(b);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function pick(s = state) {
  const o = {};
  for (const k of CLOUD_KEYS) o[k] = clone(s[k]);
  return o;
}

// ---------- taban (son eşitlenen hâl) ----------
function loadBase() {
  try { return JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); } catch { return null; }
}
function saveBase(b) {
  try { localStorage.setItem(BASE_KEY, JSON.stringify(b)); } catch (e) { console.warn('Bulut tabanı kaydedilemedi', e); }
}
export function clearBase() { try { localStorage.removeItem(BASE_KEY); } catch { /* yok say */ } }

// Yedekten yükleme / "Her şeyi sil" sonrası taban geçersizdir: bir sonraki eşitleme hiçbir şeyi
// buluttan silmeden birleştirir (yanlışlıkla tüm verinin buluttan da silinmesini önler).
subscribe((reason) => { if (reason === 'import') clearBase(); });

// ---------- birleştirme ----------
function resolve(key, l, r, hasBase) {
  // Kadran arşivi: daha dolu olan (boş cihazın boş kadranı doluyu ezmesin)
  if (key === 'archive' || !hasBase) return (str(r).length > str(l).length) ? r : l;
  const lu = l?.updatedAt, ru = r?.updatedAt;
  if (lu && ru && lu !== ru) return ru > lu ? r : l;
  return l;
}
function merge3(key, L, R, B, hasBase) {
  if (same(L, R)) return L;
  if (hasBase) {
    if (same(L, B)) return R;   // yalnız bulutta değişmiş (ya da silinmiş)
    if (same(R, B)) return L;   // yalnız burada değişmiş (ya da silinmiş)
  }
  if (L === undefined) return R;
  if (R === undefined) return L;
  return resolve(key, L, R, hasBase);
}
function mergeList(key, L = [], R = [], B = [], hasBase) {
  const idx = (a) => new Map((a || []).map((x) => [x.id, x]));
  const lm = idx(L), rm = idx(R), bm = idx(B);
  const ids = [...new Set([...(L || []).map((x) => x.id), ...(R || []).map((x) => x.id)])];
  const out = [];
  for (const id of ids) {
    const v = merge3(key, lm.get(id), rm.get(id), bm.get(id), hasBase);
    if (v !== undefined) out.push(v);
  }
  return out;
}
function mergeMap(key, L = {}, R = {}, B = {}, hasBase) {
  const out = {};
  for (const k of new Set([...Object.keys(L || {}), ...Object.keys(R || {})])) {
    const v = merge3(key, L?.[k], R?.[k], B?.[k], hasBase);
    if (v !== undefined) out[k] = v;
  }
  return out;
}
export function merge(local, remote, base) {
  const hasBase = !!base;
  const out = {};
  for (const k of LISTS) out[k] = mergeList(k, local[k], remote[k], base?.[k], hasBase);
  for (const k of MAPS) out[k] = mergeMap(k, local[k], remote[k], base?.[k], hasBase);
  for (const k of SINGLES) {
    const v = merge3(k, local[k], remote[k], base?.[k], hasBase);
    out[k] = v === undefined ? local[k] : v;
  }
  return out;
}

// ---------- Drive ----------
// api: google.js'teki yetkili istek fonksiyonu (tam adres kabul eder)
async function findFile(api, base) {
  if (base?.fileId) {
    try {
      const m = await api('GET', `${DRIVE}/files/${base.fileId}`, { query: { fields: 'id,version,trashed' } });
      if (m && !m.trashed) return m;
    } catch (e) { if (e.status !== 404) throw e; }
  }
  const list = await api('GET', `${DRIVE}/files`, {
    query: { spaces: 'appDataFolder', q: `name='${FILE}' and trashed=false`, fields: 'files(id,version,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: 10 },
  });
  return list?.files?.[0] || null;
}

async function upload(api, fileId, payload) {
  const json = JSON.stringify(payload);
  if (fileId) {
    return api('PATCH', `${UPLOAD}/files/${fileId}`, { query: { uploadType: 'media', fields: 'id,version' }, raw: json, contentType: 'application/json' });
  }
  const boundary = `vzf${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'], mimeType: 'application/json' });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`
    + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  return api('POST', `${UPLOAD}/files`, { query: { uploadType: 'multipart', fields: 'id,version' }, raw: body, contentType: `multipart/related; boundary=${boundary}` });
}

// Bir eşitleme turu. Döndürür: { pulled: bu cihaza gelen değişiklik var mı, pushed: buluta yazıldı mı }
export async function cloudSync(api) {
  const base = loadBase();
  const local = pick();
  const meta = await findFile(api, base);
  const fileId = meta?.id || null;
  const hasBase = !!base && base.fileId === fileId && !!fileId;

  // Hiçbir şey değişmediyse indirme bile yapma
  if (hasBase && String(base.version) === String(meta.version) && same(local, base.data)) return { pulled: false, pushed: false };

  let remote = null;
  if (fileId) {
    if (hasBase && String(base.version) === String(meta.version)) remote = base.data;
    else {
      const doc = await api('GET', `${DRIVE}/files/${fileId}`, { query: { alt: 'media' } });
      remote = doc?.data || null;
    }
  }

  const merged = remote ? merge(local, remote, hasBase ? base.data : null) : local;

  // Ağ beklenirken burada bir şey değiştiyse bu turu bırak (kullanıcının yazdığını ezmeyelim)
  if (!same(pick(), local)) return { pulled: false, pushed: false, retry: true };

  let pulled = false;
  if (!same(merged, local)) {
    for (const k of CLOUD_KEYS) if (!same(merged[k], local[k])) state[k] = clone(merged[k]);
    pulled = true;
    commit('cloud');
  }

  let version = meta?.version;
  let id = fileId;
  let pushed = false;
  if (!remote || !same(merged, remote)) {
    const res = await upload(api, fileId, { app: 'vazifedar', format: 1, savedAt: new Date().toISOString(), data: merged });
    id = res.id; version = res.version; pushed = true;
  }
  saveBase({ fileId: id, version, data: merged });
  return { pulled, pushed };
}
