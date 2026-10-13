// Ders programını yapıştırarak kurmak: okulun öğrenci sistemindeki haftalık program tablosu kopyalanıp
// bırakılır; dersler, günler, saatler ve derslikler çıkarılır. Kodu var olan dersin oturumları güncellenir,
// yeni dersler eklenir (adı müfredattan; konular autoFillTopics ile gelir). Programda olmayan derslere dokunulmaz.
import { h, toast, openModal } from './ui.js';
import { state, commit, uid, PALET } from './store.js';
import { GUNLER, GUNLER_KISA, hmToMin, minToHm } from './dates.js';
import { foldCode, loadCatalog } from './topics.js';

const DAY_NAMES = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'];
const dayOf = (s) => {
  const k = String(s).toLocaleLowerCase('tr').trim();
  const i = DAY_NAMES.findIndex((d) => k === d || (k.length >= 3 && d.startsWith(k)));
  return i < 0 ? 0 : i + 1;
};
// Satır başındaki saat aralığı: "10:30 - 11:20", "10.30-11.20"
const TIME_RE = /^\s*(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})\s*(.*)$/;
// Ders hücresi: "MAT 202 - 2 Derslik : Amfi 3", "ELE 224L - 2 Derslik : TM 117", "İYD - 1 - 3 Derslik: B07"
const CELL_RE = /^([A-Za-zÇĞİÖŞÜçğıöşü]{2,5})\s*-?\s*(\d{1,3}[A-Za-z]?)\b\s*(?:-\s*(\d{1,2})\b)?\s*(.*)$/;
const pad = (n) => String(n).padStart(2, '0');

// Metin → { slots: [{ day, a, b, code, section, location }], warnings, days }
export function parseTimetable(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let days = null;
  const rows = [];
  let cur = null;
  for (const line of lines) {
    const m = TIME_RE.exec(line);
    if (m) {
      cur = { a: Number(m[1]) * 60 + Number(m[2]), b: Number(m[3]) * 60 + Number(m[4]), rest: m[5] };
      rows.push(cur);
    } else if (cur) cur.rest += `\n${line}`;
    else if (!days) {
      // Başlık satırı: "Saat ⇥ Pazartesi ⇥ Salı …"
      const ds = line.split(/\t|\s{2,}/).map(dayOf).filter(Boolean);
      if (ds.length >= 3) days = ds;
    }
  }
  days = days || [1, 2, 3, 4, 5, 6, 7];
  const slots = [];
  const warnings = [];
  for (const r of rows) {
    // Ders yazan hücreler kopyalanınca çoğu zaman sekme yerine satır sonuyla ayrılır: ikisi de hücre sınırı
    const cells = r.rest.replace(/^\t/, '').split(/\t|\n/).map((s) => s.trim());
    while (cells.length > days.length && cells[cells.length - 1] === '') cells.pop();
    const label = `${pad(Math.floor(r.a / 60))}:${pad(r.a % 60)}`;
    if (cells.length > days.length) warnings.push(`${label} satırında ${cells.length} hücre var, ${days.length} gün bekleniyordu; fazlası alınmadı.`);
    cells.slice(0, days.length).forEach((cell, i) => {
      if (!cell || /^[-–—.]+$/.test(cell)) return;
      const c = CELL_RE.exec(cell);
      if (!c) { warnings.push(`${GUNLER_KISA[days[i] - 1]} ${label}: "${cell}" anlaşılamadı.`); return; }
      const code = `${c[1].toLocaleUpperCase('tr')} ${c[2].toLocaleUpperCase('tr')}`;
      const location = c[4].replace(/^.*?derslik\s*:?\s*/i, '').replace(/^[-:,\s]+/, '').trim();
      slots.push({ day: days[i], a: r.a, b: r.b, code, section: c[3] || '', location });
    });
  }
  return { slots, warnings, days };
}

// Saatlik hücreleri oturumlara topla: aynı gün, aynı ders, aynı derslik, arası ≤ 15 dk → tek oturum
export function slotsToCourses(slots) {
  const by = new Map();
  for (const s of [...slots].sort((x, y) => x.day - y.day || x.a - y.a)) {
    const k = foldCode(s.code);
    if (!by.has(k)) by.set(k, { key: k, code: s.code, section: s.section, sessions: [] });
    const c = by.get(k);
    const last = c.sessions[c.sessions.length - 1];
    if (last && last.day === s.day && last.location === s.location && s.a - last.b >= 0 && s.a - last.b <= 15) last.b = s.b;
    else c.sessions.push({ day: s.day, a: s.a, b: s.b, location: s.location });
  }
  return [...by.values()];
}

const sessText = (s) => `${GUNLER_KISA[s.day - 1]} ${minToHm(s.a)}–${minToHm(s.b)}${s.location ? `, ${s.location}` : ''}`;
const sameSessions = (old, neu) => old.length === neu.length
  && neu.every((n) => old.some((o) => Number(o.day) === n.day && hmToMin(o.start) === n.a && hmToMin(o.end) === n.b && (o.location || '') === n.location));

// Ders programına uygula. Var olan dersin oturumları yenilenir; aynı gün ve saatte başlayan oturumun kimliği
// korunur (devamsızlık ve iptal işaretleri ona bağlı).
function apply(list, catalog) {
  let added = 0, updated = 0;
  for (const p of list) {
    const type = /L$/i.test(p.code) ? 'Lab' : 'Teori';
    const existing = state.courses.find((c) => foldCode(c.code) === p.key);
    if (existing) {
      if (sameSessions(existing.sessions, p.sessions)) continue;
      existing.sessions = p.sessions.map((n) => {
        const o = existing.sessions.find((x) => Number(x.day) === n.day && hmToMin(x.start) === n.a);
        return { id: o?.id || uid(), day: n.day, start: minToHm(n.a), end: minToHm(n.b), location: n.location, type: o?.type || type };
      });
      updated++;
    } else {
      const l = catalog?.dersler?.[p.key];
      state.courses.push({
        id: uid(), code: l?.kod || p.code, name: l?.ad || p.code, instructor: '',
        color: PALET[state.courses.length % PALET.length], skips: [], absences: [], absenceLimit: '', absenceUnit: 'saat',
        sessions: p.sessions.map((n) => ({ id: uid(), day: n.day, start: minToHm(n.a), end: minToHm(n.b), location: n.location, type })),
      });
      added++;
    }
  }
  if (added || updated) commit('courses');
  return { added, updated };
}

export function openTimetableImport() {
  let catalog = null;
  let list = [];
  loadCatalog().then((d) => { catalog = d; draw(); });
  const ta = h('textarea', { rows: 9, spellcheck: false, class: 'tti-text', 'aria-label': 'Haftalık ders programı',
    placeholder: 'Okulun öğrenci sistemindeki haftalık ders programı tablosunu seçip kopyala, buraya yapıştır:\nSaat ⇥ Pazartesi ⇥ Salı …\n10:30 - 11:20 ⇥ - ⇥ MAT 202 - 2 Derslik : Amfi 3 …' });
  const out = h('div', { class: 'tti-out' });

  const draw = () => {
    const { slots, warnings } = parseTimetable(ta.value);
    list = slotsToCourses(slots);
    const btn = m.dialog.querySelector('.modal-actions .btn.primary');
    const changes = list.filter((p) => { const e = state.courses.find((c) => foldCode(c.code) === p.key); return !e || !sameSessions(e.sessions, p.sessions); });
    if (btn) {
      btn.disabled = !changes.length;
      const nNew = changes.filter((p) => !state.courses.some((c) => foldCode(c.code) === p.key)).length;
      btn.textContent = !list.length ? 'Programı kur' : !changes.length ? 'Değişiklik yok'
        : [nNew ? `${nNew} ders ekle` : '', changes.length - nNew ? `${changes.length - nNew} ders güncelle` : ''].filter(Boolean).join(', ');
    }
    if (!ta.value.trim()) { out.replaceChildren(); return; }
    if (!list.length) { out.replaceChildren(h('p', { class: 'muted small' }, 'Ders bulunamadı. Satırlar "10:30 - 11:20" gibi bir saatle başlamalı.')); return; }
    const untouched = state.courses.filter((c) => !list.some((p) => p.key === foldCode(c.code)));
    out.replaceChildren(...[
      h('ul', { class: 'tti-list' }, list.map((p) => {
        const e = state.courses.find((c) => foldCode(c.code) === p.key);
        const l = catalog?.dersler?.[p.key];
        const status = !e ? ['yeni', 'new'] : sameSessions(e.sessions, p.sessions) ? ['aynı', 'same'] : ['güncellenecek', 'upd'];
        return h('li', { style: { '--c': e?.color || 'var(--hero)' } },
          h('span', { class: 'tti-head' }, h('strong', {}, l?.kod || p.code), h('span', { class: 'tti-name' }, e?.name || l?.ad || ''),
            p.section ? h('span', { class: 'muted small' }, `şube ${p.section}`) : null, h('i', { class: `tti-st ${status[1]}` }, status[0])),
          h('span', { class: 'tti-sess' }, p.sessions.map(sessText).join(' · ')));
      })),
      untouched.length ? h('p', { class: 'muted small' }, `Programda olmayan, dokunulmayacak: ${untouched.map((c) => c.code || c.name).join(', ')}`) : null,
      warnings.length ? h('ul', { class: 'tti-warn' }, warnings.map((w) => h('li', {}, w))) : null,
    ].filter(Boolean));
  };

  const body = h('div', { class: 'tti' },
    h('p', { class: 'muted small' }, 'Dersler, günler, saatler ve derslikler tablodan çıkarılır; ardışık saatler tek oturum olur (10:30–12:20). Kodu zaten olan dersin oturumları güncellenir, yeni dersler eklenir; adı ve konuları okulun müfredatından gelir.'),
    ta, out);
  const m = openModal({
    title: 'Ders programını yapıştır', body, wide: true,
    actions: [
      { label: 'Vazgeç', onClick: (_, close) => close() },
      { label: 'Programı kur', kind: 'primary', onClick: (_, close) => {
        if (!list.length) return;
        const r = apply(list, catalog);
        close();
        toast([r.added ? `${r.added} ders eklendi` : '', r.updated ? `${r.updated} dersin saatleri güncellendi` : ''].filter(Boolean).join(', ') || 'Değişiklik yok');
      } },
    ],
  });
  ta.addEventListener('input', draw);
  draw();
  return m;
}
