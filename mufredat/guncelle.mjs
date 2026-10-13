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
//   https://www.etu.edu.tr/tr/bolum/<bölüm>/ders-mufredati  → zorunlu dersler (ABYS bağlantılarıyla)
//   https://www.etu.edu.tr/tr/bolum/<bölüm>/ders-icerikleri → seçmeliler dahil ders kodları
//   https://abys.etu.edu.tr/public/lesson.jsp?program=<p>&lang=tr&lesson=<KOD> → ad + "Referans Ders Çizelgesi"
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./tobb-etu.json', import.meta.url));
const BOLUMLER = {
  'elektrik-elektronik-muhendisligi': 'Elektrik-Elektronik Mühendisliği',
  'bilgisayar-muhendisligi': 'Bilgisayar Mühendisliği',
  'makine-muhendisligi': 'Makine Mühendisliği',
  'biyomedikal-muhendisligi': 'Biyomedikal Mühendisliği',
  'endustri-muhendisligi': 'Endüstri Mühendisliği',
  'malzeme-bilimi-ve-nanoteknoloji-muh': 'Malzeme Bilimi ve Nanoteknoloji Mühendisliği',
  'yapay-zeka-muhendisligi': 'Yapay Zeka Mühendisliği',
};
// Ders kodunun ön ekine göre önce hangi programın sayfasına bakılsın
const ONEK = { BİL: '5', ELE: '7', END: '9', YAP: '176', MAK: '178', BMM: '180', MBN: '182' };

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
  const jobs = new Map();   // ders kodu → aday programlar
  const programs = {};
  for (const [slug, ad] of Object.entries(BOLUMLER)) {
    const cur = await get(`https://www.etu.edu.tr/tr/bolum/${slug}/ders-mufredati`);
    if (!cur) { console.warn(`! müfredat alınamadı: ${slug}`); continue; }
    let prog = null;
    const codes = new Set();
    for (const m of cur.matchAll(/lesson\.jsp\?program=(\d+)&(?:amp;)?lang=tr&(?:amp;)?lesson=([^"'&\s]+)/g)) {
      prog = m[1]; codes.add(decodeURIComponent(m[2]));
    }
    if (!prog) continue;
    programs[prog] = ad;
    const ic = await get(`https://www.etu.edu.tr/tr/bolum/${slug}/ders-icerikleri`);
    if (ic) for (const m of txt(ic).replace(/\s+/g, ' ').matchAll(/(?:^|\s)([A-ZÇĞİÖŞÜ]{2,4}) ?(\d{3}L?)(?=\s)/g)) codes.add(m[1] + m[2]);
    for (const c of codes) {
      const list = jobs.get(c) || [];
      if (ONEK[c.match(/^\D+/)?.[0]] === prog) list.unshift(prog); else list.push(prog);
      jobs.set(c, [...new Set(list)]);
    }
    console.log(`${ad}: program ${prog}, ${codes.size} ders kodu`);
  }
  const all = Object.keys(programs);
  const raw = {};
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const [code, progs] = queue.shift();
      for (const p of [...progs, ...all.filter((x) => !progs.includes(x))]) {
        const html = await get(`https://abys.etu.edu.tr/public/lesson.jsp?program=${p}&lang=tr&lesson=${encodeURIComponent(code)}`, 1);
        if (html) { raw[code] = { p, ...parseLesson(html) }; break; }
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { raw, programs };
}

async function main() {
  const i = process.argv.indexOf('--raw');
  let raw, programs;
  if (i > 0) {
    raw = JSON.parse(await readFile(process.argv[i + 1], 'utf8'));
    programs = { 5: BOLUMLER['bilgisayar-muhendisligi'], 7: BOLUMLER['elektrik-elektronik-muhendisligi'], 9: BOLUMLER['endustri-muhendisligi'], 176: BOLUMLER['yapay-zeka-muhendisligi'], 178: BOLUMLER['makine-muhendisligi'], 180: BOLUMLER['biyomedikal-muhendisligi'], 182: BOLUMLER['malzeme-bilimi-ve-nanoteknoloji-muh'] };
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
