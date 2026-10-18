// TOBB ETÜ ders müfredatını (her dersin haftalık konu planını) okulun sitesinden çekip
// mufredat/tobb-etu.json dosyasına yazar. Vazifedar bu dosyayı kendi adresinden okur:
// okulun siteleri başka adreslerden okunmaya izin vermediği (CORS) için tarayıcı oraya doğrudan gidemez.
//
// Çalıştırma (Node 18+; paket gerekmez):
//   node mufredat/guncelle.mjs                 → siteden çeker, dosyayı yazar
//   node mufredat/guncelle.mjs --raw ham.json  → daha önce çekilmiş ham veriden dosyayı kurar
// İstenirse GitHub ayda bir kendiliğinden çalıştırır: mufredat/github-eylemi.yml dosyasını
// depoda .github/workflows/mufredat.yml olarak eklemek yeter (GitHub → Add file → Create new file).
//
// Kaynaklar:
//   https://www.etu.edu.tr/tr/bolum/<bölüm>/ders-mufredati  → zorunlu dersler (ABYS bağlantılarıyla), bütün fakülteler
//   https://www.etu.edu.tr/tr/bolum/<bölüm>/ders-icerikleri → seçmeliler dahil ders kodları
//   https://abys.etu.edu.tr/public/lesson.jsp?program=<p>&lang=tr&lesson=<KOD> → ad + "Referans Ders Çizelgesi"
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./tobb-etu.json', import.meta.url));
// Bütün fakültelerin lisans bölümleri (www.etu.edu.tr/tr/akademik). p: ABYS program kimliği.
// Bölüm sayfasında ABYS bağlantısı yoksa (Hukuk, Tarih) kimlik buradan alınır. Matematik'in ABYS'de lisans
// programı yok (2026-10-18'de 1–300 arası tarandı); onun yalnız kendine özgü dersleri katalogda yer almaz.
const BOLUMLER = {
  // Mühendislik
  'bilgisayar-muhendisligi': { ad: 'Bilgisayar Mühendisliği', p: 5 },
  'elektrik-elektronik-muhendisligi': { ad: 'Elektrik-Elektronik Mühendisliği', p: 7 },
  'endustri-muhendisligi': { ad: 'Endüstri Mühendisliği', p: 9 },
  'yapay-zeka-muhendisligi': { ad: 'Yapay Zeka Mühendisliği', p: 176 },
  'makine-muhendisligi': { ad: 'Makine Mühendisliği', p: 178 },
  'biyomedikal-muhendisligi': { ad: 'Biyomedikal Mühendisliği', p: 180 },
  'malzeme-bilimi-ve-nanoteknoloji-muh': { ad: 'Malzeme Bilimi ve Nanoteknoloji Mühendisliği', p: 182 },
  'mekatronik-muhendisligi-yandal-programi': { ad: 'Mekatronik Mühendisliği Yandal Programı', p: null },
  // Fen Edebiyat
  'turk-dili-ve-edebiyati': { ad: 'Türk Dili ve Edebiyatı', p: 185 },
  'tarih': { ad: 'Tarih', p: 187 },
  'ingiliz-dili-ve-edebiyati': { ad: 'İngiliz Dili ve Edebiyatı', p: 189 },
  'psikoloji': { ad: 'Psikoloji', p: 191 },
  'matematik': { ad: 'Matematik', p: null },
  // İktisadi ve İdari Bilimler
  'isletme': { ad: 'İşletme', p: 194 },
  'iktisat': { ad: 'İktisat', p: 196 },
  'uluslararasi-girisimcilik': { ad: 'Uluslararası Girişimcilik', p: 200 },
  'siyaset-bilimi-ve-uluslararasi-iliskiler': { ad: 'Siyaset Bilimi ve Uluslararası İlişkiler', p: 204 },
  'yonetim-bilisim-sistemleri': { ad: 'Yönetim Bilişim Sistemleri', p: 65921 },
  // Mimarlık ve Tasarım
  'ic-mimarlik-ve-cevre-tasarimi': { ad: 'İç Mimarlık ve Çevre Tasarımı', p: 207 },
  'endustriyel-tasarim': { ad: 'Endüstriyel Tasarım', p: 209 },
  'gorsel-iletisim-tasarimi': { ad: 'Görsel İletişim Tasarımı', p: 211 },
  'mimarlik': { ad: 'Mimarlık', p: 213 },
  // Hukuk, Tıp
  'hukuk': { ad: 'Hukuk', p: 216 },
  'tip-fakultesi': { ad: 'Tıp', p: 219 },
};
// Ders kodunun ön ekine göre önce hangi programın sayfasına bakılsın (anahtar foldCode biçiminde).
// Ders sayfaları programa bağlı: ELE 224 program 7'de açılır, 5'te açılmaz. js/topics.js'teki ABYS_PROG ile aynı.
export const ONEK = {
  BIL: 5, FIZ: 5, TUR: 5, AIT: 5, OEG: 5, IYD: 5, ELE: 7, MAT: 7, KIM: 7, END: 9, YAP: 176, MAK: 178, BMM: 180, MBN: 182,
  TDE: 185, TAR: 187, IDE: 189, PSI: 191, ISL: 194, ING: 194, IKT: 196, UGI: 200, UGIR: 200, SUI: 204, YBS: 65921,
  ICT: 207, EUT: 209, GIT: 211, GRT: 211, BLT: 211, MIM: 213, SAT: 213, HUK: 216, MTA: 216, TIP: 219,
};
const onek = (code) => ONEK[foldCode(code).match(/^[A-Z]+/)?.[0]];

// "BİL 264L", "bil264l", "İYD - 1" → "BIL264L", "IYD1" (uygulamadaki foldCode ile aynı olmalı)
export function foldCode(s) {
  return String(s || '').toLocaleUpperCase('tr')
    .replace(/[İI]/g, 'I').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ç/g, 'C').replace(/Ğ/g, 'G')
    .replace(/[^A-Z0-9]/g, '');
}
// "BİL264L" → "BİL 264L"
const prettyCode = (c) => c.replace(/^(\D+)\s*-?\s*(\d)/, '$1 $2');

const clean = (s) => s.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
const txt = (html) => html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Haftalık plan satırları → [[ilkHafta, sonHafta, konu], ...]
// js/topics.js'teki parseSyllabus ile aynı kurallar (birini değiştirirsen ötekini de değiştir):
// arka arkaya aynı konu ya da "X (devam)" önceki konuyla birleşir, "-" haftalar atlanır.
const SYL_LINE = /^(?:(\d{1,2})\s*\.?\s*hafta|hafta\s*(\d{1,2})|(\d{1,2})\s*(?:[.):\-–]|\t))\s*[:.\-–)]?\s*(.*)$/i;
const stripDevam = (t) => t.replace(/\s*[([]\s*(devam[ıi]?|cont\.?|continued)\s*[)\]]\s*$/i, '').replace(/\s*[-–:]\s*devam[ıi]?\s*$/i, '');
const cleanTitle = (t) => t.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/^[-–:.•*\s]+/, '').replace(/[,.;\s]+$/, '').trim();
export function weeksToTopics(lines) {
  const key = (t) => t.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const rows = [];
  lines.forEach((line, i) => {
    const m = SYL_LINE.exec(line.trim());
    const w = m ? Number(m[1] || m[2] || m[3]) : i + 1;
    const t = cleanTitle(m ? m[4] || '' : line);
    if (!t || /^[-–.?]+$/.test(t)) return;
    const title = stripDevam(t) || t;
    const last = rows[rows.length - 1];
    // "İşaretçiler (devam)" → önceki "İşaretçiler (pointers)" konusunun devamı
    const same = last && (key(last[2]) === key(title) || (title !== t && key(last[2]).startsWith(`${key(title)} `)));
    if (same && w >= last[0] && w <= last[1] + 1) last[1] = w;
    else rows.push([w, w, title]);
  });
  return rows;
}

export function build(raw, programs) {
  const dersler = {};
  for (const code of Object.keys(raw).sort((a, b) => a.localeCompare(b, 'tr'))) {
    const v = raw[code];
    const konular = weeksToTopics(v.plan || []);
    if (!konular.length) continue;
    const key = foldCode(code);
    if (dersler[key]) continue;
    dersler[key] = { kod: prettyCode(code), ad: clean(v.name || ''), p: Number(v.p), konular };
  }
  return {
    surum: 1,
    okul: 'TOBB ETÜ',
    kaynak: 'https://abys.etu.edu.tr (Referans Ders Çizelgesi)',
    guncelleme: new Date().toISOString().slice(0, 10),
    programlar: programs,
    dersler,
  };
}

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Vazifedar mufredat (github.com/MFatihDogan27/Vazifedar)' } });
      if (r.ok) return await r.text();
      if (r.status < 500) return null;
    } catch { /* tekrar dene */ }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  return null;
}

function parseLesson(html) {
  const name = /<p class="lead">([\s\S]*?)<\/p>/.exec(html)?.[1] || '';
  const sec = /<b>\s*Referans Ders Çizelgesi\s*<\/b>[\s\S]*?<div class="row[^"]*">\s*<div class="col-12">([\s\S]*?)<\/div>/.exec(html);
  const plan = sec ? txt(sec[1]).split('\n').map((s) => s.trim()).filter(Boolean) : [];
  return { name: clean(txt(name)), plan };
}

async function crawl() {
  const jobs = new Map();   // ders kodu → aday programlar (kodun sahibi önce, sonra onu listeleyen bölümler)
  const programs = {};
  for (const [slug, { ad, p: known }] of Object.entries(BOLUMLER)) {
    const cur = await get(`https://www.etu.edu.tr/tr/bolum/${slug}/ders-mufredati`);
    const ic = await get(`https://www.etu.edu.tr/tr/bolum/${slug}/ders-icerikleri`);
    if (!cur && !ic) { console.warn(`! bölüm sayfaları alınamadı: ${slug}`); continue; }
    const codes = new Set();
    const seen = {};
    for (const m of (cur || '').matchAll(/lesson\.jsp\?program=(\d+)&(?:amp;)?lang=(?:tr|en)&(?:amp;)?lesson=([^"'&\s]+)/g)) {
      seen[m[1]] = (seen[m[1]] || 0) + 1; codes.add(decodeURIComponent(m[2]));
    }
    const prog = known || Number(Object.entries(seen).sort((x, y) => y[1] - x[1])[0]?.[0]) || null;
    if (prog) programs[prog] = ad;
    // Kodun ardından virgül, iki nokta ya da "/" gelebilir ("ELE 401, ELE 402", "ELE 412 L", "ELE 425 / BİL361")
    for (const html of [cur, ic]) if (html) for (const m of txt(html).replace(/\s+/g, ' ').matchAll(/(?:^|[\s,;/(])([A-ZÇĞİÖŞÜ]{2,4}) ?(\d{3})(?: ?([LAR]))?(?![0-9A-Za-zÇĞİÖŞÜçğıöşü])/g)) codes.add(m[1] + m[2] + (m[3] || ''));
    for (const c of codes) {
      const own = onek(c);
      if (!own) continue;   // tanınmayan ön ek (IEEE 802, AKTS 274…)
      jobs.set(c, [...new Set([own, ...(jobs.get(c) || []), ...(prog ? [prog] : [])])]);
    }
    console.log(`${ad}: program ${prog ?? '-'}, ${codes.size} ders kodu`);
  }
  const raw = {};
  const queue = [...jobs];
  // Yalnız kodun sahibine ve onu listeleyen bölümlere bakılır (seçmelilerin çoğunun sayfası yok; hepsini denemek
  // okulun sunucusuna on binlerce istek demek). Haftalık planı olan ilk sayfa alınır.
  const worker = async () => {
    while (queue.length) {
      const [code, progs] = queue.shift();
      for (const p of progs) {
        const html = await get(`https://abys.etu.edu.tr/public/lesson.jsp?program=${p}&lang=tr&lesson=${encodeURIComponent(code)}`, 1);
        if (!html) continue;
        const v = parseLesson(html);
        if (v.plan.length) { raw[code] = { p, ...v }; break; }
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { raw, programs };
}

async function main() {
  const i = process.argv.indexOf('--raw');
  let raw, programs;
  if (i > 0) {
    // Ham dosya: { KOD: { p, name, plan: [satır…] } } (tarayıcıda ABYS'den toplanır, CLAUDE.md'ye bak)
    raw = JSON.parse(await readFile(process.argv[i + 1], 'utf8'));
    programs = Object.fromEntries(Object.values(BOLUMLER).filter((b) => b.p).map((b) => [b.p, b.ad]));
  } else ({ raw, programs } = await crawl());
  const data = build(raw, programs);
  const n = Object.keys(data.dersler).length;
  // Site çökmüşse ya da yapısı değişmişse elimizdekini silmeyelim
  let prev = 0;
  try { prev = Object.keys(JSON.parse(await readFile(OUT, 'utf8')).dersler || {}).length; } catch { /* ilk kez */ }
  if (n < Math.max(20, prev * 0.7)) { console.error(`Yalnız ${n} ders bulundu (önceki ${prev}); dosya değiştirilmedi.`); process.exit(1); }
  // Konular değişmediyse tarihi de değiştirme (boş commit olmasın)
  try {
    const old = JSON.parse(await readFile(OUT, 'utf8'));
    if (JSON.stringify(old.dersler) === JSON.stringify(data.dersler) && JSON.stringify(old.programlar) === JSON.stringify(data.programlar)) { console.log('Değişiklik yok.'); return; }
  } catch { /* ilk kez */ }
  await writeFile(OUT, `${JSON.stringify(data)}\n`);
  console.log(`${n} ders yazıldı → ${OUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
