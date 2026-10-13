// Unutma notları ("iğneler"): saate değil bir ana bağlı küçük notlar.
// Bir derse (isteğe bağlı oturum türüyle: Lab, PS…), bir plan türüne (Halısaha…), bir plana,
// takvimdeki tek bir kayda ya da bir güne iğnelenir. "Bir sonraki sefer" notu o ders/plan
// gelene kadar bekler, işaretlenmezse bir sonrakine geçer; "her seferinde" notu her tekrarda çıkar.
// Önceki akşam "Yarının çantası"nda, o gün kadranda ve kayıt penceresinde görünür.
import { h, toast, openModal, field } from './ui.js';
import { state, commit, uid, category, occurrencesInRange, subscribe } from './store.js';
import {
  startOfDay, addDays, toDateKey, parseLocal, toLocalISO, timeStr, fmtDateShort,
  GUNLER, GUNLER_KISA, isoWeekday, daysBetween, hmToMin,
} from './dates.js';
import { ic } from './icons.js';

const HORIZON = 180; // "bir sonraki sefer" en çok bu kadar gün ileride aranır

// ---------------------------------------------------------------------------
// Eşleştirme
// ---------------------------------------------------------------------------
export const isFixed = (n) => n.target.type === 'date' || n.target.type === 'occ';

function matchGeneric(t, o) {
  if (t.type === 'course') return o.kind === 'course' && o.courseId === t.courseId && (!t.sessionType || o.sub === t.sessionType);
  if (t.type === 'category') return o.kind === 'event' && o.categoryId === t.categoryId;
  if (t.type === 'event') return o.kind === 'event' && o.ref?.id === t.eventId;
  return false;
}

// Bir kaydın sıradaki tekrarı (her not için) — dakikada bir ya da veri değişince yeniden hesaplanır
let ver = 0;
subscribe(() => { ver++; });
let cache = { ver: -1, minute: -1, map: new Map() };
function nextMap(now = new Date()) {
  const minute = Math.floor(now.getTime() / 60000);
  if (cache.ver === ver && cache.minute === minute) return cache.map;
  const map = new Map();
  const live = state.notes.filter((n) => !isFixed(n) && (n.repeat === 'always' || !n.done));
  if (live.length) {
    const occ = occurrencesInRange(startOfDay(now), addDays(now, HORIZON), { includeDeadlines: false }).filter((o) => o.end > now);
    for (const n of live) {
      const o = occ.find((x) => matchGeneric(n.target, x));
      if (o) map.set(n.id, o);
    }
  }
  cache = { ver, minute, map };
  return map;
}
export function nextOccOf(n, now = new Date()) { return isFixed(n) ? null : nextMap(now).get(n.id) || null; }

export function isChecked(n, o) {
  return n.repeat === 'always' && o ? !!n.checks?.[o.id] : !!n.done;
}

// Bir takvim kaydına (ders oturumu / plan) düşen notlar
export function pinsForOcc(o, now = new Date()) {
  if (!o || o.kind === 'deadline') return [];
  const nm = nextMap(now);
  const out = [];
  for (const n of state.notes) {
    const t = n.target;
    let ok = false;
    if (t.type === 'occ') ok = t.key === o.id;
    else if (t.type === 'date') ok = false;
    else if (matchGeneric(t, o)) {
      if (n.repeat === 'always') ok = true;
      else if (n.done) ok = n.doneOcc === o.id;
      else ok = nm.get(n.id)?.id === o.id;
    }
    if (ok) out.push({ n, o, checked: isChecked(n, o) });
  }
  return out;
}
export const openCount = (o, now) => pinsForOcc(o, now).filter((x) => !x.checked).length;

// Bir güne yazılmış notlar
export function datePins(dateKey) {
  return state.notes.filter((n) => n.target.type === 'date' && n.target.date === dateKey).map((n) => ({ n, o: null, checked: !!n.done }));
}

// Zamanı geçmiş ama işaretlenmemiş sabit notlar (güne ya da tek bir kayda bağlı)
export function overduePins(now = new Date()) {
  const tk = toDateKey(now);
  return state.notes.filter((n) => !n.done && (
    (n.target.type === 'date' && n.target.date && n.target.date < tk)
    || (n.target.type === 'occ' && n.target.end && parseLocal(n.target.end) <= now)))
    .map((n) => ({ n, o: null, checked: false, overdue: true }));
}

// Bir günün çantası: o günün kayıtlarına düşen notlar + o güne yazılan notlar
export function dayGroups(day, now = new Date(), { fromNow = false } = {}) {
  const d0 = startOfDay(day), d1 = addDays(d0, 1);
  const occ = occurrencesInRange(d0, d1, { includeDeadlines: false })
    .filter((o) => !fromNow || o.end > now)
    .filter((o) => o.allDay || o.start >= d0); // önceki günden taşan kayıtlar o günün çantasına girmesin
  const groups = [];
  for (const o of occ) {
    const items = pinsForOcc(o, now);
    if (items.length) groups.push({ o, items });
  }
  return { groups, date: datePins(toDateKey(d0)) };
}
export function groupsCount({ groups, date }) {
  const all = [...groups.flatMap((g) => g.items), ...date];
  return { total: all.length, open: all.filter((x) => !x.checked).length };
}

// ---------------------------------------------------------------------------
// Değişiklikler
// ---------------------------------------------------------------------------
export function addNote({ text, target, repeat = 'once' }) {
  const n = {
    id: uid(), text: text.trim(), target, repeat: isFixed({ target }) ? 'once' : repeat,
    done: false, doneAt: null, doneOcc: null, checks: {}, createdAt: new Date().toISOString(),
  };
  state.notes.push(n);
  commit('notes');
  return n;
}

export function updateNote(id, data) {
  const n = state.notes.find((x) => x.id === id);
  if (!n) return null;
  const retarget = data.target && JSON.stringify(data.target) !== JSON.stringify(n.target);
  Object.assign(n, data);
  if (isFixed(n)) n.repeat = 'once';
  if (retarget) { n.done = false; n.doneAt = null; n.doneOcc = null; n.checks = {}; }
  commit('notes');
  return n;
}

export function deleteNote(id, { undo = true } = {}) {
  const i = state.notes.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [n] = state.notes.splice(i, 1);
  commit('notes');
  if (undo) toast(`Not silindi: ${n.text}`, { action: { label: 'Geri al', onClick: () => { state.notes.splice(Math.min(i, state.notes.length), 0, n); commit('notes'); } } });
}

function pruneChecks(n) {
  const limit = Date.now() - 120 * 86400000;
  for (const [k, v] of Object.entries(n.checks || {})) if (new Date(v).getTime() < limit) delete n.checks[k];
}

export function togglePin(n, o) {
  if (n.repeat === 'always' && o) {
    n.checks = n.checks || {};
    if (n.checks[o.id]) delete n.checks[o.id]; else n.checks[o.id] = new Date().toISOString();
    pruneChecks(n);
  } else {
    n.done = !n.done;
    n.doneAt = n.done ? new Date().toISOString() : null;
    n.doneOcc = n.done && o ? o.id : null;
  }
  commit('notes');
}

// ---------------------------------------------------------------------------
// Etiketler
// ---------------------------------------------------------------------------
const courseOf = (id) => state.courses.find((c) => c.id === id);
const eventOf = (id) => state.events.find((e) => e.id === id && !e.deleted);
const catOf = (id) => state.categories.find((c) => c.id === id);
const occName = (o) => (o.kind === 'course' ? (o.ref.code || o.ref.name) : o.title);

export function isOrphan(n) {
  const t = n.target;
  if (t.type === 'course') return !courseOf(t.courseId);
  if (t.type === 'category') return !catOf(t.categoryId);
  if (t.type === 'event') return !eventOf(t.eventId);
  return false;
}

function dayWord(d, now = new Date()) {
  const k = daysBetween(now, d);
  if (k === 0) return 'bugün';
  if (k === 1) return 'yarın';
  if (k === -1) return 'dün';
  return `${GUNLER_KISA[isoWeekday(d) - 1]} ${fmtDateShort(d)}`;
}

// "Her ELE 271 Lab dersinde", "Bir sonraki Halısaha planında", "15 Ekim Çarşamba"…
export function targetLabel(n) {
  const t = n.target, every = n.repeat === 'always';
  if (t.type === 'course') {
    const c = courseOf(t.courseId);
    if (!c) return 'Silinmiş bir ders';
    const nm = `${c.code || c.name}${t.sessionType ? ` ${t.sessionType}` : ''}`;
    return every ? `Her ${nm} dersinde` : `Bir sonraki ${nm} dersinde`;
  }
  if (t.type === 'category') {
    const c = catOf(t.categoryId);
    if (!c) return 'Silinmiş bir plan türü';
    return every ? `Her ${c.name} planında` : `Bir sonraki ${c.name} planında`;
  }
  if (t.type === 'event') {
    const e = eventOf(t.eventId);
    if (!e) return 'Silinmiş bir plan';
    return every ? `"${e.title}" her tekrarında` : `"${e.title}" planında`;
  }
  if (t.type === 'occ') {
    const at = t.start ? parseLocal(t.start) : null;
    return `${t.label || 'Bir kayıt'}${at ? `, ${dayWord(at)} ${timeStr(at)}` : ''}`;
  }
  if (t.type === 'date' && t.date) { const d = parseLocal(t.date); return `${fmtDateShort(d)} ${GUNLER[isoWeekday(d) - 1]}`; }
  return '';
}

// Kısa kapsam etiketi (çanta listesinde, notun yanında)
export function scopeShort(n) {
  const t = n.target;
  if (n.repeat !== 'always') return '';
  if (t.type === 'course') return t.sessionType ? `her ${t.sessionType}` : 'her derste';
  if (t.type === 'category') return `her ${(catOf(t.categoryId)?.name || 'plan').toLocaleLowerCase('tr')}`;
  if (t.type === 'event') return 'her tekrarda';
  return '';
}

// Bir notun sıradaki zamanı (listelerde)
export function whenText(n, now = new Date()) {
  const t = n.target;
  if (t.type === 'date') {
    if (!t.date) return '';
    const d = parseLocal(t.date);
    if (!n.done && t.date < toDateKey(now)) return `${-daysBetween(now, d) === 1 ? 'dünden' : `${-daysBetween(now, d)} gündür`} bekliyor`;
    return dayWord(d, now);
  }
  if (t.type === 'occ') {
    const s = t.start ? parseLocal(t.start) : null;
    if (!s) return '';
    if (!n.done && t.end && parseLocal(t.end) <= now) return `${t.label ? `${t.label}, ` : ''}${dayWord(s, now)} ${timeStr(s)}`;
    return `${dayWord(s, now)} ${timeStr(s)}`;
  }
  const o = nextOccOf(n, now);
  if (!o) return isOrphan(n) ? 'bağlı olduğu kayıt silinmiş' : `önümüzdeki ${Math.round(HORIZON / 30)} ayda yok`;
  return `sıradaki: ${dayWord(o.start, now)}${o.allDay ? '' : ` ${timeStr(o.start)}`}`;
}

// ---------------------------------------------------------------------------
// Ortak görünüm parçaları
// ---------------------------------------------------------------------------
export function tickBtn(checked, onClick, label) {
  return h('button', {
    type: 'button', class: `pin-tick ${checked ? 'on' : ''}`, 'aria-pressed': String(checked), 'aria-label': label, title: checked ? 'Hazır (geri al)' : 'Hazır',
    onclick: onClick,
  }, ic('tick', { size: 14 }));
}

// Not satırları: [tik] metin  (kapsam)  [✕]
export function pinRows(items, { onChange, showScope = true, showWhen = false, removable = true, now = new Date() } = {}) {
  return h('ul', { class: 'pin-rows' }, items.map(({ n, o, checked, overdue }) => h('li', { class: `${checked ? 'checked' : ''} ${overdue ? 'overdue' : ''}` },
    tickBtn(checked, () => { togglePin(n, o); onChange?.(); }, `${n.text}: ${checked ? 'hazır değil' : 'hazır'}`),
    h('button', { type: 'button', class: 'pin-text', title: 'Düzenle', onclick: () => openNoteForm(n.id, { onDone: onChange }) }, n.text),
    showWhen || overdue ? h('span', { class: 'pin-scope' }, overdue ? whenText(n, now) : targetLabel(n)) : (showScope && scopeShort(n) ? h('span', { class: 'pin-scope' }, scopeShort(n)) : null),
    removable ? h('button', { type: 'button', class: 'icon-btn pin-x', 'aria-label': `${n.text} notunu sil`, onclick: () => { deleteNote(n.id); onChange?.(); } }, ic('x', { size: 14 })) : null)));
}

// Takvim kaydı penceresindeki "Unutma" bölümü (ders oturumu ya da plan)
export function pinSection(o) {
  const wrap = h('div', { class: 'pin-sec' });
  const isCourse = o.kind === 'course';
  const cat = !isCourse ? catOf(o.categoryId) : null;
  const scopes = isCourse
    ? [['occ', 'Yalnız bu derste'], o.sub ? ['type', `Her ${o.sub} oturumunda`] : null, ['course', 'Bu dersin her oturumunda']].filter(Boolean)
    : [['occ', o.recurring ? 'Yalnız bu tekrarda' : 'Bu planda'], o.recurring ? ['event', 'Her tekrarında'] : null, cat ? ['category', `Her ${cat.name} planında`] : null].filter(Boolean);
  let scope = isCourse && o.sub && o.sub !== 'Teori' ? 'type' : 'occ';
  const targetFor = (sc) => {
    if (sc === 'type') return { type: 'course', courseId: o.courseId, sessionType: o.sub };
    if (sc === 'course') return { type: 'course', courseId: o.courseId, sessionType: '' };
    if (sc === 'event') return { type: 'event', eventId: o.ref.id };
    if (sc === 'category') return { type: 'category', categoryId: o.categoryId };
    return { type: 'occ', key: o.id, start: toLocalISO(o.start), end: toLocalISO(o.end), label: occName(o) };
  };
  const render = (focus = false) => {
    const items = pinsForOcc(o);
    const input = h('input', { type: 'text', class: 'pin-input', placeholder: isCourse ? 'Örn. multimetre, deney seti, hocaya sor…' : 'Örn. krampon, bilet, şarj aleti…', 'aria-label': 'Unutma notu', maxlength: 160 });
    const sel = h('select', { class: 'pin-scope-sel', 'aria-label': 'Ne zaman çıksın' }, scopes.map(([v, l]) => h('option', { value: v }, l)));
    sel.value = scope;
    sel.onchange = () => { scope = sel.value; };
    const add = () => {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      addNote({ text: v, target: targetFor(scope), repeat: ['type', 'course', 'event', 'category'].includes(scope) ? 'always' : 'once' });
      render(true);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(); } });
    // replaceChildren null'ı "null" yazısı olarak basar; boşları ayıkla
    wrap.replaceChildren(...[
      h('div', { class: 'pin-sec-head' }, h('strong', {}, ic('pin', { size: 15 }), ' Unutma'),
        h('span', { class: 'muted small' }, 'Önceki akşam yarının çantasına düşer')),
      items.length ? pinRows(items, { onChange: () => render() }) : null,
      h('div', { class: 'pin-add' }, input, sel, h('button', { type: 'button', class: 'btn small', onclick: add }, 'Ekle')),
    ].filter(Boolean));
    if (focus) setTimeout(() => input.focus(), 0);
  };
  render();
  return wrap;
}

// ---------------------------------------------------------------------------
// Not formu: neye bağlı, ne zaman
// ---------------------------------------------------------------------------
function upcomingEvents(now = new Date()) {
  const seen = new Map();
  for (const o of occurrencesInRange(startOfDay(now), addDays(now, 90), { includeCourses: false, includeDeadlines: false })) {
    if (o.end <= now || seen.has(o.ref.id)) continue;
    seen.set(o.ref.id, o);
  }
  return [...seen.values()];
}

export function openNoteForm(noteId, { preset = {}, onDone } = {}) {
  const existing = noteId ? state.notes.find((n) => n.id === noteId) : null;
  const n0 = existing || {
    text: preset.text || '', repeat: preset.repeat || 'once',
    target: preset.target || { type: 'date', date: toDateKey(addDays(new Date(), 1)) },
  };
  let type = n0.target.type;
  let repeat = n0.repeat || 'once';
  const t0 = n0.target;

  const text = h('input', { type: 'text', value: n0.text, placeholder: 'Örn. multimetre ve deney setini al', autofocus: true, maxlength: 160 });

  const courseSel = h('select', { 'aria-label': 'Ders' }, state.courses.map((c) => h('option', { value: c.id }, [c.code, c.name].filter(Boolean).join(' · '))));
  if (t0.courseId) courseSel.value = t0.courseId;
  const typeSel = h('select', { 'aria-label': 'Oturum türü' });
  const fillTypes = () => {
    const c = courseOf(courseSel.value);
    const types = [...new Set((c?.sessions || []).map((s) => s.type).filter(Boolean))];
    typeSel.replaceChildren(h('option', { value: '' }, 'Tüm oturumlar'), ...types.map((x) => h('option', { value: x }, `Yalnız ${x}`)));
    typeSel.value = types.includes(t0.sessionType) ? t0.sessionType : '';
  };
  fillTypes();
  courseSel.onchange = () => { fillTypes(); preview(); };
  typeSel.onchange = () => preview();

  const catSel = h('select', { 'aria-label': 'Plan türü' }, state.categories.map((c) => h('option', { value: c.id }, c.name)));
  if (t0.categoryId) catSel.value = t0.categoryId;
  catSel.onchange = () => preview();

  const evs = upcomingEvents();
  if (t0.eventId && !evs.some((o) => o.ref.id === t0.eventId)) {
    const e = eventOf(t0.eventId);
    if (e) evs.unshift({ ref: e, start: parseLocal(e.start), title: e.title });
  }
  const evSel = h('select', { 'aria-label': 'Plan' }, evs.length
    ? evs.map((o) => h('option', { value: o.ref.id }, `${o.title} · ${GUNLER_KISA[isoWeekday(o.start) - 1]} ${fmtDateShort(o.start)}${o.ref.recur ? ' (tekrarlayan)' : ''}`))
    : h('option', { value: '' }, 'Önümüzdeki 90 günde plan yok'));
  if (t0.eventId) evSel.value = t0.eventId;
  evSel.onchange = () => preview();

  const dateIn = h('input', { type: 'date', value: t0.date || toDateKey(addDays(new Date(), 1)), 'aria-label': 'Gün' });
  dateIn.onchange = () => preview();

  const TYPES = [['course', 'Bir derse'], ['category', 'Plan türüne'], ['event', 'Bir plana'], ['date', 'Bir güne']];
  const typeRow = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Neye bağlı' });
  const repRow = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Ne zaman' });
  const sub = h('div', { class: 'note-sub' });
  const prev = h('p', { class: 'note-preview' });

  const readTarget = () => {
    if (type === 'course') return { type, courseId: courseSel.value, sessionType: typeSel.value };
    if (type === 'category') return { type, categoryId: catSel.value };
    if (type === 'event') return { type, eventId: evSel.value };
    if (type === 'occ') return { ...t0 };
    return { type: 'date', date: dateIn.value };
  };

  function preview() {
    const tmp = { id: '__preview', text: '', target: readTarget(), repeat, done: false, checks: {} };
    const s = state.settings.pins;
    let when = '';
    if (tmp.target.type === 'date') when = tmp.target.date ? `${targetLabel(tmp)} günü Bugün ekranında; önceki akşam ${s.showFrom}'den sonra yarının çantasında.` : '';
    else if (tmp.target.type === 'occ') when = `${targetLabel(tmp)}.`;
    else {
      const occ = occurrencesInRange(startOfDay(new Date()), addDays(new Date(), HORIZON), { includeDeadlines: false })
        .filter((o) => o.end > new Date() && matchGeneric(tmp.target, o));
      if (!occ.length) when = 'Önümüzdeki aylarda buna uyan bir kayıt yok.';
      else {
        const o = occ[0];
        const first = `${dayWord(o.start)}${o.allDay ? '' : ` ${timeStr(o.start)}`} (${occName(o)})`;
        when = repeat === 'always'
          ? `İlki ${first}, sonra her seferinde. ${occ.length > 1 ? `Önümüzdeki aylarda ${occ.length} kez.` : ''}`
          : `${first}. İşaretlemezsen bir sonrakine geçer.`;
      }
    }
    prev.textContent = when;
  }

  function render() {
    typeRow.replaceChildren(...TYPES.map(([id, l]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(type === id), class: `seg-btn ${type === id ? 'on' : ''}`,
      disabled: (id === 'course' && !state.courses.length) || (id === 'event' && !evs.length),
      onclick: () => { type = id; render(); },
    }, l)));
    repRow.hidden = type === 'date' || type === 'occ';
    repRow.replaceChildren(...[['once', 'Bir sonraki sefer'], ['always', 'Her seferinde']].map(([id, l]) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(repeat === id), class: `seg-btn ${repeat === id ? 'on' : ''}`,
      onclick: () => { repeat = id; render(); },
    }, l)));
    if (type === 'course') sub.replaceChildren(h('div', { class: 'grid-2' }, field('Ders', courseSel), field('Hangi oturumlar', typeSel)));
    else if (type === 'category') sub.replaceChildren(field('Plan türü', catSel));
    else if (type === 'event') sub.replaceChildren(field('Plan', evSel));
    else if (type === 'occ') sub.replaceChildren(h('p', { class: 'muted small' }, `Bağlı olduğu kayıt: ${targetLabel({ target: t0, repeat: 'once' })}`));
    else sub.replaceChildren(field('Gün', dateIn));
    preview();
  }
  render();

  const body = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Not', text),
    type === 'occ' ? null : field('Neye bağlı', typeRow),
    sub,
    h('div', { class: 'field' }, repRow),
    prev);

  const submit = (close) => {
    const v = text.value.trim();
    if (!v) { text.focus(); toast('Not boş olamaz', { kind: 'warn' }); return; }
    const target = readTarget();
    if (target.type === 'date' && !target.date) { toast('Bir gün seç', { kind: 'warn' }); return; }
    if (target.type === 'event' && !target.eventId) { toast('Bir plan seç', { kind: 'warn' }); return; }
    if (existing) updateNote(existing.id, { text: v, target, repeat });
    else addNote({ text: v, target, repeat });
    close();
    toast(existing ? 'Not güncellendi' : `Not iğnelendi: ${targetLabel({ target, repeat })}`);
    onDone?.();
  };
  const actions = [];
  if (existing) actions.push({ label: 'Sil', kind: 'danger ghost left', onClick: (_, close) => { deleteNote(existing.id); close(); onDone?.(); } });
  actions.push({ label: 'Vazgeç', onClick: (_, close) => close() });
  actions.push({ label: existing ? 'Kaydet' : 'İğnele', kind: 'primary', onClick: (_, close) => submit(close) });
  const m = openModal({ title: existing ? 'Notu düzenle' : 'Unutma notu', body, actions });
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(m.close); } });
}

// ---------------------------------------------------------------------------
// Bugün ekranı: "Bugün yanına al" / akşam "Yarının çantası"
// ---------------------------------------------------------------------------
export function bagMode(now = new Date()) {
  const from = state.settings.pins?.showFrom || '18:00';
  return now.getHours() * 60 + now.getMinutes() >= hmToMin(from) ? 'tomorrow' : 'today';
}

function groupBlock({ o, items }, { now, onChange, tag }) {
  const time = o.allDay ? 'Tüm gün' : timeStr(o.start);
  const meta = [o.kind === 'course' ? o.sub : category(o.categoryId)?.name, o.location].filter(Boolean).join(' · ');
  return h('div', { class: 'bag-grp', style: { '--c': o.color } },
    h('div', { class: 'bag-occ' },
      h('span', { class: 'bag-time' }, tag ? h('small', {}, tag) : null, time),
      h('span', { class: 'bag-name' }, h('b', {}, occName(o)), meta ? h('span', { class: 'muted small' }, ` ${meta}`) : null)),
    pinRows(items, { onChange, now }));
}

export function bagCard(now = new Date(), { onChange, extra } = {}) {
  const mode = bagMode(now);
  const day = mode === 'tomorrow' ? addDays(startOfDay(now), 1) : startOfDay(now);
  const dg = dayGroups(day, now, { fromNow: mode === 'today' });
  const tonight = mode === 'tomorrow' ? dayGroups(now, now, { fromNow: true }).groups.filter((g) => g.items.some((x) => !x.checked)) : [];
  const late = [
    ...overduePins(now),
    // Akşam yarına geçince bugünün işaretlenmemiş gün notları da kalanlara düşer
    ...(mode === 'tomorrow' ? datePins(toDateKey(now)).filter((x) => !x.checked).map((x) => ({ ...x, overdue: true })) : []),
  ];
  const cnt = groupsCount(dg);
  const ready = cnt.total > 0 && cnt.open === 0;

  const quick = h('input', {
    type: 'text', class: 'bag-input', maxlength: 160,
    placeholder: mode === 'tomorrow' ? 'Yarına not: ör. kimliği al, Enter' : 'Bugüne not: ör. faturayı öde, Enter',
    'aria-label': mode === 'tomorrow' ? 'Yarına not ekle' : 'Bugüne not ekle',
  });
  quick.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = quick.value.trim(); if (!v) return;
    addNote({ text: v, target: { type: 'date', date: toDateKey(day) } });
    setTimeout(() => document.querySelector('.bag-input')?.focus(), 0);
  });

  const empty = !dg.groups.length && !dg.date.length && !tonight.length && !late.length;
  const title = mode === 'tomorrow' ? 'Yarının çantası' : 'Bugün unutma';
  return h('section', { class: `card bag-card ${mode} ${ready ? 'ready' : ''}`, 'aria-label': title },
    h('div', { class: 'card-head' },
      h('h3', {}, title),
      h('span', { class: `bag-count ${ready ? 'ready' : ''}` }, cnt.total ? (ready ? 'Hazır' : `${cnt.total - cnt.open}/${cnt.total} hazır`) : `${GUNLER[isoWeekday(day) - 1]} ${fmtDateShort(day)}`)),
    tonight.length ? h('div', { class: 'bag-sec' }, tonight.map((g) => groupBlock(g, { now, onChange, tag: 'bu akşam' }))) : null,
    dg.groups.map((g) => groupBlock(g, { now, onChange })),
    dg.date.length ? h('div', { class: 'bag-grp day', style: { '--c': 'var(--ink)' } },
      h('div', { class: 'bag-occ' }, h('span', { class: 'bag-time' }, 'Gün'), h('span', { class: 'bag-name' }, h('b', {}, mode === 'tomorrow' ? 'Yarın için' : 'Bugün için'))),
      pinRows(dg.date, { onChange, showScope: false, now })) : null,
    late.length ? h('div', { class: 'bag-grp late', style: { '--c': 'var(--red)' } },
      h('div', { class: 'bag-occ' }, h('span', { class: 'bag-time' }, ic('alert', { size: 14 })), h('span', { class: 'bag-name' }, h('b', {}, 'Kalanlar'))),
      pinRows(late, { onChange, now })) : null,
    empty ? h('p', { class: 'muted bag-empty' }, mode === 'tomorrow'
      ? 'Yarın için iğnelenmiş bir şey yok. Bir derse ya da plana tıklayıp "Unutma" kısmına yazarsan önceki akşam burada çıkar.'
      : 'Bugün için iğnelenmiş bir şey yok.') : null,
    h('div', { class: 'bag-add' }, quick,
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => openNoteForm(null, { preset: { target: { type: 'date', date: toDateKey(day) } }, onDone: onChange }) }, ic('pin', { size: 14 }), ' Derse/plana bağla')),
    extra || null);
}

// Defterde bir günün sayfası: o günün kayıtlarına ve güne iğnelenen notlar + o güne not ekleme
export function dayPinsBlock(day, { onChange } = {}) {
  const now = new Date();
  const dg = dayGroups(day, now);
  const key = toDateKey(day);
  const input = h('input', { type: 'text', class: 'pin-input dj-pin-input', maxlength: 160, placeholder: 'Bu güne not: ör. kirayı öde, Enter', 'aria-label': 'Bu güne not ekle' });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = input.value.trim(); if (!v) return;
    addNote({ text: v, target: { type: 'date', date: key } });
    onChange?.();
    setTimeout(() => document.querySelector('.dj-pin-input')?.focus(), 0);
  });
  return h('div', { class: 'dj-pins' },
    dg.groups.map((g) => groupBlock(g, { now, onChange })),
    dg.date.length ? h('div', { class: 'bag-grp day', style: { '--c': 'var(--ink)' } },
      h('div', { class: 'bag-occ' }, h('span', { class: 'bag-time' }, 'Gün'), h('span', { class: 'bag-name' }, h('b', {}, 'Bu güne'))),
      pinRows(dg.date, { onChange, showScope: false, now })) : null,
    h('div', { class: 'bag-add' }, input,
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => openNoteForm(null, { preset: { target: { type: 'date', date: key } }, onDone: onChange }) }, ic('pin', { size: 14 }), ' Derse/plana bağla')));
}

// Tüm notlar: her seferinde çıkanlar, sıradakiler, geride kalanlar
export function allPinsPanel({ onChange } = {}) {
  const now = new Date();
  const always = state.notes.filter((n) => n.repeat === 'always');
  const overdue = overduePins(now).map((x) => x.n);
  const od = new Set(overdue.map((n) => n.id));
  const waiting = state.notes.filter((n) => n.repeat !== 'always' && !n.done && !od.has(n.id))
    .sort((a, b) => sortKey(a, now) - sortKey(b, now));
  const doneCount = state.notes.filter((n) => n.repeat !== 'always' && n.done).length;
  const row = (n) => h('li', { class: isOrphan(n) ? 'orphan' : '' },
    h('button', { type: 'button', class: 'ap-main', onclick: () => openNoteForm(n.id, { onDone: onChange }) },
      h('span', { class: 'ap-text' }, n.text),
      h('span', { class: 'ap-target muted small' }, targetLabel(n), n.repeat === 'always' || !isFixed(n) || od.has(n.id) ? ` · ${whenText(n, now)}` : '')),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${n.text} notunu sil`, onclick: () => { deleteNote(n.id); onChange?.(); } }, ic('x', { size: 14 })));
  const sec = (title, list, hint) => (list.length ? h('div', { class: 'ap-sec' }, h('h4', {}, title, h('span', { class: 'muted small' }, ` ${list.length}`)), hint ? h('p', { class: 'muted small' }, hint) : null, h('ul', { class: 'ap-list' }, list.map(row))) : null);
  const empty = !always.length && !waiting.length && !overdue.length;
  return h('section', { class: 'panel all-pins' },
    h('div', { class: 'panel-head' }, h('h3', {}, 'Unutma notları'),
      h('button', { type: 'button', class: 'btn small', onclick: () => openNoteForm(null, { onDone: onChange }) }, '+ Not iğnele')),
    empty ? h('p', { class: 'muted small' }, 'Henüz not yok. "Her Lab dersinde multimetre" gibi bir not, her Lab\'dan önceki akşam yarının çantasına düşer.') : null,
    sec('Geride kalanlar', overdue, 'Zamanı geçti ama işaretlenmedi.'),
    sec('Her seferinde', always),
    sec('Sıradakiler', waiting),
    doneCount ? h('p', { class: 'muted small' }, `${doneCount} not tamamlandı; hangi gün işaretlendiklerini defterde o günün sayfasında görebilirsin.`) : null);
}
function sortKey(n, now) {
  const t = n.target;
  if (t.type === 'date') return t.date ? parseLocal(t.date).getTime() : Infinity;
  if (t.type === 'occ') return t.start ? parseLocal(t.start).getTime() : Infinity;
  const o = nextOccOf(n, now);
  return o ? o.start.getTime() : Infinity;
}
