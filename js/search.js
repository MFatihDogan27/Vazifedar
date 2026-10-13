// Arama: planlar, görevler/ödevler, dersler, unutma notları ve defter yazıları içinde arar.
// Türkçe harf duyarsız: "halisaha" → "Halısaha", "odev" → "Ödev". Birden çok kelime yazılırsa hepsi geçmeli.
// Üst çubuktaki büyüteç, Ctrl+K ya da F tuşu açar; ↑/↓ ile gezinilir, Enter açar, Esc kapatır.
import { h } from './ui.js';
import { state, category, taskCategory, dueDate, subscribe } from './store.js';
import {
  parseLocal, addDays, fmtDateLong, timeStr, relativeDays,
  GUNLER, GUNLER_KISA,
} from './dates.js';
import { isRecurring, expand, describe } from './recurrence.js';
import { ic } from './icons.js';
import { openEventForm, openTaskForm, openCourseForm } from './forms.js';
import { openNoteForm, targetLabel } from './notes.js';

const RECENT_KEY = 'vazifedar:aramalar';
const GROUPS = [
  { id: 'event', name: 'Planlar', icon: 'calendar' },
  { id: 'task', name: 'Görevler', icon: 'check' },
  { id: 'course', name: 'Dersler', icon: 'cap' },
  { id: 'note', name: 'Notlar', icon: 'pin' },
  { id: 'journal', name: 'Defter', icon: 'book' },
];
const PER_GROUP = 5;   // "Tümü"nde her gruptan en çok bu kadar
const MAX_ONE = 60;    // tek grup seçiliyken

// ---------------------------------------------------------------------------
// Türkçe katlama: küçük harf + şapkasız/noktasız. Her karakter tek karaktere
// gider, böylece katlanmış metindeki konumlar özgün metinle birebir örtüşür.
// ---------------------------------------------------------------------------
const FOLD = { ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u', é: 'e', è: 'e', ê: 'e', á: 'a', à: 'a', ä: 'a', ë: 'e', ï: 'i' };
function foldCh(ch) {
  const l = ch.toLocaleLowerCase('tr');
  const c = l.length === 1 ? l : l[0];
  return FOLD[c] || c;
}
function fold(s) {
  s = String(s || '');
  let out = '';
  for (let i = 0; i < s.length; i++) out += foldCh(s[i]);
  return out;
}
const tokensOf = (q) => fold(q).split(/\s+/).filter(Boolean);

// Bir alan listesinde her kelime bir yerde geçiyor mu? Puan: başlıkta kelime başı > başlıkta > başka alanda
function scoreFields(fields, tokens) {
  let score = 0;
  for (const t of tokens) {
    let best = 0;
    for (const f of fields) {
      if (!f.text) continue;
      const ft = f.folded ?? (f.folded = fold(f.text));
      const i = ft.indexOf(t);
      if (i < 0) continue;
      const wordStart = i === 0 || /[\s\-–·,.:;/(]/.test(ft[i - 1]);
      const s = (f.weight || 1) * (wordStart ? 1.5 : 1);
      if (s > best) best = s;
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}

// Eşleşen parçaları <mark> ile vurgula
function highlight(text, tokens) {
  text = String(text || '');
  if (!tokens.length || !text) return [text];
  const ft = fold(text);
  const ranges = [];
  for (const t of tokens) {
    let i = ft.indexOf(t);
    while (i >= 0) { ranges.push([i, i + t.length]); i = ft.indexOf(t, i + t.length); }
  }
  if (!ranges.length) return [text];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (const r of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r);
  }
  const out = [];
  let pos = 0;
  for (const [a, b] of merged) {
    if (a > pos) out.push(text.slice(pos, a));
    out.push(h('mark', {}, text.slice(a, b)));
    pos = b;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

// Uzun metinde ilk eşleşmenin çevresinden bir parça
function snippet(text, tokens, len = 110) {
  text = String(text || '').replace(/\s+/g, ' ').trim();
  if (text.length <= len) return text;
  const ft = fold(text);
  let at = -1;
  for (const t of tokens) { const i = ft.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return `${text.slice(0, len)}…`;
  const from = Math.max(0, at - 35);
  const to = Math.min(text.length, from + len);
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`;
}

// ---------------------------------------------------------------------------
// Aramalar
// ---------------------------------------------------------------------------
function searchEvents(tokens, now) {
  const out = [];
  for (const ev of state.events) {
    if (ev.deleted) continue;
    const cat = category(ev.categoryId);
    const rec = isRecurring(ev);
    const s = parseLocal(ev.start);
    const fields = [
      { text: ev.title, weight: 3 },
      { text: cat.name, weight: 2 },
      { text: ev.location, weight: 1.5 },
      { text: ev.notes, weight: 1 },
      // tarihle de bulunsun: "15 kasım", "cuma"
      { text: rec ? describe(ev.recur, ev.start) : fmtDateLong(s), weight: 0.6 },
    ];
    const score = scoreFields(fields, tokens);
    if (!score) continue;
    let when = s, occDate = null, past = false, sub;
    if (rec) {
      const next = expand(ev, now, addDays(now, 400))[0];
      if (next) { when = next.start; occDate = next.dateKey; } else past = true;
      sub = `${describe(ev.recur, ev.start)}${ev.allDay ? '' : `, ${timeStr(s)}`}`;
    } else {
      past = parseLocal(ev.end) < now;
      sub = ev.allDay ? `${fmtDateLong(s)}, tüm gün` : `${fmtDateLong(s)}, ${timeStr(s)}`;
    }
    const noteHit = ev.notes && scoreFields([{ text: ev.notes }], tokens) && !scoreFields([{ text: ev.title }, { text: cat.name }], tokens);
    out.push({
      group: 'event', key: `e:${ev.id}`, score, past, when,
      color: cat.color, icon: cat.icon, title: ev.title || '(adsız plan)',
      sub, extra: [cat.name, ev.location].filter(Boolean).join(' · '),
      snippet: noteHit ? snippet(ev.notes, tokens) : '',
      badge: rec ? (past ? 'bitti' : `sıradaki: ${relativeDays(when, now)}`) : relativeDays(s, now),
      recurring: rec,
      open: () => openEventForm({ id: ev.id, occDate }),
      goDate: when,
    });
  }
  // Önce yaklaşanlar (en yakın başta), sonra geçmiş (en yeni başta)
  out.sort((a, b) => (a.past - b.past) || (a.past ? b.when - a.when : a.when - b.when));
  return out;
}

function searchTasks(tokens, now) {
  const out = [];
  for (const t of state.tasks) {
    const c = t.courseId ? state.courses.find((x) => x.id === t.courseId) : null;
    const tc = taskCategory(t.categoryId);
    const fields = [
      { text: t.title, weight: 3 },
      { text: c ? `${c.code || ''} ${c.name || ''}` : '', weight: 2 },
      { text: c ? 'ödev' : '', weight: 1 },
      { text: t.categoryId ? tc.name : '', weight: 1.5 },
      { text: t.notes, weight: 1 },
    ];
    const score = scoreFields(fields, tokens);
    if (!score) continue;
    const due = t.due ? dueDate(t) : null;
    const noteHit = t.notes && !scoreFields([{ text: t.title }], tokens) && scoreFields([{ text: t.notes }], tokens);
    out.push({
      group: 'task', key: `t:${t.id}`, score, past: !!t.done, when: due,
      color: c?.color || tc.color, icon: c ? 'book' : 'check', title: t.title || '(adsız görev)',
      sub: due ? `teslim ${fmtDateLong(due)}${t.dueTime ? ` ${t.dueTime}` : ''}` : 'tarihsiz',
      extra: [c ? (c.code || c.name) : (t.categoryId ? tc.name : ''), t.done ? 'tamamlandı' : ''].filter(Boolean).join(' · '),
      snippet: noteHit ? snippet(t.notes, tokens) : '',
      badge: t.done ? 'bitti' : due ? (due < now ? `${relativeDays(due, now)} · gecikti` : relativeDays(due, now)) : '',
      done: !!t.done,
      open: () => openTaskForm(t.id),
      goDate: due,
    });
  }
  // Açıklar önce (son tarihi yakın olan başta, tarihsizler sonda), bitenler en sonda
  out.sort((a, b) => (a.done - b.done) || ((a.when ? a.when.getTime() : Infinity) - (b.when ? b.when.getTime() : Infinity)) || b.score - a.score);
  return out;
}

function searchCourses(tokens) {
  const out = [];
  for (const c of state.courses) {
    const sess = c.sessions || [];
    const fields = [
      { text: c.name, weight: 3 },
      { text: c.code, weight: 3 },
      { text: c.instructor, weight: 2 },
      { text: sess.map((s) => s.location).filter(Boolean).join(' '), weight: 1.5 },
      { text: sess.map((s) => s.type).filter(Boolean).join(' '), weight: 1 },
      { text: sess.map((s) => GUNLER[(Number(s.day) || 1) - 1]).join(' '), weight: 0.6 },
      { text: 'ders', weight: 0.4 },
    ];
    const score = scoreFields(fields, tokens);
    if (!score) continue;
    out.push({
      group: 'course', key: `c:${c.id}`, score, color: c.color || '#2B47B9', icon: 'cap',
      title: [c.code, c.name].filter(Boolean).join(' · ') || '(adsız ders)',
      sub: sess.filter((s) => s.start).map((s) => `${GUNLER_KISA[(Number(s.day) || 1) - 1]} ${s.start}${s.type ? ` ${s.type}` : ''}`).join(', ') || 'oturum yok',
      extra: [c.instructor, [...new Set(sess.map((s) => s.location).filter(Boolean))].join(', ')].filter(Boolean).join(' · '),
      open: () => openCourseForm(c.id),
    });
  }
  out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'tr'));
  return out;
}

function searchNotes(tokens) {
  const out = [];
  for (const n of state.notes) {
    const where = targetLabel(n);
    const score = scoreFields([{ text: n.text, weight: 3 }, { text: where, weight: 1 }], tokens);
    if (!score) continue;
    const done = n.repeat !== 'always' && !!n.done;
    out.push({
      group: 'note', key: `n:${n.id}`, score, done, past: done, color: 'var(--saffron)', icon: 'pin',
      title: n.text || '(boş not)', sub: where, extra: done ? 'işaretlendi' : '',
      open: () => openNoteForm(n.id),
    });
  }
  out.sort((a, b) => (a.done - b.done) || b.score - a.score);
  return out;
}

function searchJournal(tokens, onDay) {
  const out = [];
  for (const [k, v] of Object.entries(state.journal || {})) {
    const text = v?.text;
    if (!text) continue;
    const d = parseLocal(k);
    const score = scoreFields([{ text, weight: 2 }, { text: fmtDateLong(d), weight: 0.6 }], tokens);
    if (!score) continue;
    out.push({
      group: 'journal', key: `j:${k}`, score, when: d, color: 'var(--ink)', icon: 'book',
      title: fmtDateLong(d), sub: '', snippet: snippet(text, tokens, 140), titlePlain: true,
      open: () => onDay(k),
    });
  }
  out.sort((a, b) => b.when - a.when);
  return out;
}

// ---------------------------------------------------------------------------
// Son aramalar (yalnız bu cihazda)
// ---------------------------------------------------------------------------
function recentList() {
  try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.slice(0, 6) : []; } catch { return []; }
}
function rememberQuery(q) {
  q = q.trim();
  if (!q) return;
  const list = [q, ...recentList().filter((x) => fold(x) !== fold(q))].slice(0, 6);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* yok say */ }
}
function forgetRecent() { try { localStorage.removeItem(RECENT_KEY); } catch { /* yok say */ } }

// ---------------------------------------------------------------------------
// Arayüz
// ---------------------------------------------------------------------------
export function mountSearch(btnSlot, { onDay, onDate } = {}) {
  let overlay = null, input, chipsEl, listEl, filter = 'all', results = [], active = 0, unsub = null;

  const button = h('button', {
    class: 'search-btn', type: 'button', 'aria-label': 'Ara (Ctrl+K)', title: 'Ara — Ctrl+K ya da F',
    onclick: () => open(),
  }, ic('search', { size: 19 }), h('span', { class: 'search-btn-tx' }, 'Ara'));
  btnSlot.replaceChildren(button);

  function runSearch() {
    const q = input.value;
    const tokens = tokensOf(q);
    if (!tokens.length) { results = null; return; }
    const now = new Date();
    results = {
      tokens,
      event: searchEvents(tokens, now),
      task: searchTasks(tokens, now),
      course: searchCourses(tokens),
      note: searchNotes(tokens),
      journal: searchJournal(tokens, onDay),
    };
  }

  function rowFor(r, tokens, idx) {
    const goBtn = r.goDate && onDate ? h('button', {
      type: 'button', class: 'icon-btn sr-go', title: 'Takvimde göster', 'aria-label': 'Takvimde göster',
      onclick: (e) => { e.stopPropagation(); choose(r, () => onDate(r.goDate)); },
    }, ic('calendar', { size: 16 })) : null;
    return h('div', {
      class: `sr-row ${r.past ? 'past' : ''} ${idx === active ? 'on' : ''}`, role: 'option', id: `sr-${idx}`,
      'aria-selected': idx === active ? 'true' : 'false', dataset: { i: String(idx) },
      onclick: () => choose(r, r.open), onmousemove: () => { if (active !== idx) setActive(idx, false); },
    },
    h('span', { class: 'sr-ic', style: { '--c': r.color } }, ic(r.icon, { size: 17 })),
    h('span', { class: 'sr-body' },
      h('span', { class: 'sr-title' }, h('span', { class: 'sr-tt' }, ...(r.titlePlain ? [r.title] : highlight(r.title, tokens))),
        r.recurring ? ic('repeat', { size: 13, cls: 'sr-rep', label: 'tekrarlayan' }) : null),
      r.sub ? h('span', { class: 'sr-sub' }, r.sub, r.extra ? h('span', { class: 'sr-extra' }, ` · ${r.extra}`) : null)
        : (r.extra ? h('span', { class: 'sr-sub' }, r.extra) : null),
      r.snippet ? h('span', { class: 'sr-snip' }, ...highlight(r.snippet, tokens)) : null),
    r.badge ? h('span', { class: `sr-badge ${r.past ? 'past' : ''}` }, r.badge) : null,
    goBtn);
  }

  function renderResults() {
    const flat = [];
    if (!results) {
      const rec = recentList();
      chipsEl.replaceChildren();
      listEl.replaceChildren(h('div', { class: 'sr-empty' },
        h('p', {}, 'Planlarında, görevlerinde, derslerinde, unutma notlarında ve defterinde ara.'),
        h('p', { class: 'muted small' }, 'Harf duyarsız: "halisaha" da yazsan "Halısaha"yı bulur. Tarihle de arayabilirsin: "15 kasım", "cuma".'),
        rec.length ? h('div', { class: 'sr-recent' },
          h('div', { class: 'sr-recent-head' }, h('span', {}, 'Son aramalar'),
            h('button', { type: 'button', class: 'link', onclick: () => { forgetRecent(); renderResults(); input.focus(); } }, 'Temizle')),
          h('div', { class: 'sr-recent-list' }, rec.map((q) => h('button', {
            type: 'button', class: 'chip', onclick: () => { input.value = q; update(); input.focus(); },
          }, q)))) : null));
      results = null; flatList = flat; return;
    }
    const { tokens } = results;
    const total = GROUPS.reduce((a, g) => a + results[g.id].length, 0);
    if (filter !== 'all' && !results[filter].length) filter = 'all';
    chipsEl.replaceChildren(
      h('button', { type: 'button', class: `chip ${filter === 'all' ? 'on' : ''}`, onclick: () => setFilter('all') }, `Tümü ${total}`),
      ...GROUPS.filter((g) => results[g.id].length).map((g) => h('button', {
        type: 'button', class: `chip ${filter === g.id ? 'on' : ''}`, onclick: () => setFilter(g.id),
      }, ic(g.icon, { size: 14 }), ` ${g.name} ${results[g.id].length}`)));
    if (!total) {
      listEl.replaceChildren(h('div', { class: 'sr-empty' },
        h('p', {}, `"${input.value.trim()}" için bir şey bulunamadı.`),
        h('p', { class: 'muted small' }, 'Daha kısa ya da farklı bir kelime dene.')));
      flatList = flat; return;
    }
    const sections = [];
    for (const g of GROUPS) {
      if (filter !== 'all' && filter !== g.id) continue;
      const all = results[g.id];
      if (!all.length) continue;
      const shown = all.slice(0, filter === 'all' ? PER_GROUP : MAX_ONE);
      const rows = [];
      let pastHead = false;
      for (const r of shown) {
        if (g.id === 'event' && r.past && !pastHead && shown.some((x) => !x.past)) {
          rows.push(h('div', { class: 'sr-sep' }, 'Geçmiş')); pastHead = true;
        }
        rows.push(rowFor(r, tokens, flat.length));
        flat.push(r);
      }
      const more = all.length - shown.length;
      sections.push(h('section', { class: 'sr-group', 'aria-label': g.name },
        h('div', { class: 'sr-group-head' }, h('span', {}, g.name), h('span', { class: 'muted' }, all.length)),
        rows,
        more > 0 ? h('button', {
          type: 'button', class: 'sr-more', onclick: () => setFilter(g.id),
        }, filter === 'all' ? `${more} tane daha — hepsini göster` : `${more} tane daha var, aramayı daralt`) : null));
    }
    listEl.replaceChildren(...sections);
    flatList = flat;
  }
  let flatList = [];

  function setActive(i, scroll = true) {
    if (!flatList.length) return;
    active = (i + flatList.length) % flatList.length;
    for (const el of listEl.querySelectorAll('.sr-row')) {
      const on = Number(el.dataset.i) === active;
      el.classList.toggle('on', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && scroll) el.scrollIntoView({ block: 'nearest' });
    }
    input.setAttribute('aria-activedescendant', `sr-${active}`);
  }
  function setFilter(f) { filter = f; active = 0; renderResults(); setActive(0); input.focus(); }
  function update() { active = 0; runSearch(); renderResults(); if (flatList.length) setActive(0, false); else input.removeAttribute('aria-activedescendant'); }

  function choose(r, fn) {
    rememberQuery(input.value);
    close();
    fn?.();
  }

  function open(initial = '') {
    if (overlay) { input.focus(); input.select(); return; }
    input = h('input', {
      type: 'search', class: 'sr-input', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
      placeholder: 'Ne arıyorsun? "halısaha", "ELE 271", "multimetre"…', 'aria-label': 'Ara',
      role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'sr-list', 'aria-autocomplete': 'list',
    });
    input.value = initial;
    chipsEl = h('div', { class: 'sr-chips' });
    listEl = h('div', { class: 'sr-list', id: 'sr-list', role: 'listbox', 'aria-label': 'Arama sonuçları' });
    const panel = h('div', { class: 'sr-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ara' },
      h('div', { class: 'sr-bar' }, h('span', { class: 'sr-mag', 'aria-hidden': 'true' }, ic('search', { size: 20 })), input,
        h('button', { type: 'button', class: 'sr-close', onclick: () => close() }, 'Kapat')),
      chipsEl, listEl,
      h('div', { class: 'sr-foot' }, h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' gez'), h('span', {}, h('kbd', {}, 'Enter'), ' aç'),
        h('span', {}, h('kbd', {}, 'Tab'), ' grup değiştir'), h('span', {}, h('kbd', {}, 'Esc'), ' kapat')));
    overlay = h('div', { class: 'overlay srch', onmousedown: (e) => { if (e.target === overlay) close(); } }, panel);
    document.getElementById('modal-root').append(overlay);
    input.addEventListener('input', update);
    input.addEventListener('keydown', onKey);
    unsub = subscribe((reason) => { if (overlay && reason !== 'journal') { const a = active; runSearch(); renderResults(); setActive(Math.min(a, flatList.length - 1), false); } });
    update();
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  function close() {
    if (!overlay) return;
    overlay.remove(); overlay = null; unsub?.(); unsub = null; filter = 'all';
    if (document.activeElement === document.body || !document.activeElement) button.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (input.value) { input.value = ''; update(); } else close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const r = flatList[active];
      if (r) choose(r, e.shiftKey && r.goDate && onDate ? () => onDate(r.goDate) : r.open);
    } else if (e.key === 'Tab' && results) {
      e.preventDefault();
      const ids = ['all', ...GROUPS.filter((g) => results[g.id].length).map((g) => g.id)];
      const i = ids.indexOf(filter);
      setFilter(ids[(i + (e.shiftKey ? -1 : 1) + ids.length) % ids.length]);
    }
  }

  // Ctrl+K her yerden açar (bir kutuya yazarken de)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay) close(); else if (!document.querySelector('.overlay')) open();
    }
  });

  return { open, close, isOpen: () => !!overlay };
}

export { fold };
