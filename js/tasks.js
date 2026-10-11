// Görevler: belirli bir güne bağlı olmayan, "bir ara yapılacak" işler.
import { h, toast, celebrate } from './ui.js';
import { ic } from './icons.js';
import { state, commit, upsertTask, ONCELIKLER, taskCategory, priority } from './store.js';
import { parseLocal, daysBetween, fmtDateShort, timeStr, durationText } from './dates.js';
import { openTaskForm, openScheduleTask } from './forms.js';

let filterCat = '';
let showDone = false;

export function sortTasks(list) {
  const pIdx = (p) => ONCELIKLER.findIndex((x) => x.id === p);
  return [...list].sort((a, b) =>
    pIdx(a.priority) - pIdx(b.priority)
    || (a.due || '9999') .localeCompare(b.due || '9999')
    || a.createdAt.localeCompare(b.createdAt));
}

export function dueInfo(t, now = new Date()) {
  if (!t.due) return null;
  const n = daysBetween(now, parseLocal(t.due));
  if (n < 0) return { text: `${-n} gün gecikti`, cls: 'late' };
  if (n === 0) return { text: t.courseId && t.dueTime ? `bugün ${t.dueTime}` : 'bugün', cls: 'late' };
  if (n === 1) return { text: 'yarın', cls: 'soon' };
  if (n <= 3) return { text: `${n} gün kaldı`, cls: 'soon' };
  return { text: `${fmtDateShort(parseLocal(t.due))} ${t.courseId ? 'teslim' : 'son'}`, cls: '' };
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Tik işareti: tamamlanınca çizilerek belirir
export function tickButton(done, onClick, label) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'tick-svg');
  svg.innerHTML = '<path d="M6 12.5l4 4L18 8" pathLength="1"/>';
  return h('button', { class: `tick ${done ? 'on' : ''}`, 'aria-label': label || (done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'), onclick: (e) => onClick(e) }, svg);
}

// Görevi tamamla: tik çizilir, satır kayar, sonra kaydedilir. Son acil görevse küçük bir kutlama.
export function completeTask(t, srcEl) {
  if (t.done) { t.done = false; t.doneAt = null; commit('tasks'); toast('Görev yeniden açıldı'); return; }
  const lastAcil = t.priority === 'acil' && state.tasks.filter((x) => !x.done && x.priority === 'acil').length === 1;
  const btn = srcEl?.closest?.('.tick, .st-tick');
  btn?.classList.add('on', 'drawing');
  srcEl?.closest?.('.task, li, .hw')?.classList.add('leaving');
  const finish = () => {
    t.done = true; t.doneAt = new Date().toISOString();
    commit('tasks');
    toast(`Tamamlandı: ${t.title}`, { action: { label: 'Geri al', onClick: () => { t.done = false; t.doneAt = null; commit('tasks'); } } });
    if (lastAcil) celebrate('Acil görev kalmadı');
  };
  if (!srcEl || reduceMotion()) finish(); else setTimeout(finish, 450);
}

function toggleDone(t, e) { completeTask(t, e?.currentTarget); }

function card(t) {
  const cat = taskCategory(t.categoryId);
  const course = t.courseId ? state.courses.find((c) => c.id === t.courseId) : null;
  const di = dueInfo(t);
  const age = daysBetween(new Date(t.createdAt), new Date());
  const ev = t.scheduledEventId ? state.events.find((e) => e.id === t.scheduledEventId && !e.deleted) : null;
  const el = h('article', {
    class: `task ${t.done ? 'done' : ''}`, draggable: t.done ? null : 'true', style: { '--c': priority(t.priority).color }, dataset: { id: t.id },
  },
  tickButton(t.done, (e) => toggleDone(t, e)),
  h('div', { class: 'task-main' },
    h('button', { class: 'task-title', onclick: () => openTaskForm(t.id) }, t.title),
    h('div', { class: 'task-meta' },
      course ? h('span', { class: 'course-tag', style: { '--c': course.color } }, ic('book', { size: 13 }), ` ${course.code || course.name}`) : null,
      t.categoryId && !course ? h('span', { class: 'tag', style: { '--c': cat.color } }, cat.name) : null,
      di && !t.done ? h('span', { class: `due ${di.cls}` }, di.text) : null,
      h('span', { class: 'muted' }, durationText(t.estimateMin || 60)),
      !t.done && !t.due && age >= 7 ? h('span', { class: 'stale', title: 'Uzun süredir bekliyor' }, `${age} gündür bekliyor`) : null,
      ev ? h('span', { class: 'sched' }, ic('calendar', { size: 13 }), ` ${fmtDateShort(parseLocal(ev.start))} ${timeStr(parseLocal(ev.start))}`) : null),
    t.notes ? h('p', { class: 'task-notes' }, t.notes) : null),
  t.done ? null : h('button', { class: 'icon-btn sched-btn', title: 'Takvimde boş bir zamana yerleştir', 'aria-label': 'Takvime yerleştir', onclick: () => openScheduleTask(t.id) }, ic('calendarPlus', { size: 17 })));
  el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', t.id); el.classList.add('dragging'); });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  return el;
}

export function renderTasks(root) {
  const open = state.tasks.filter((t) => !t.done && (!filterCat || t.categoryId === filterCat));
  const done = state.tasks.filter((t) => t.done && (!filterCat || t.categoryId === filterCat))
    .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));

  // Hızlı ekleme
  const qi = h('input', { type: 'text', placeholder: 'Hızlı görev ekle… (Enter)', 'aria-label': 'Hızlı görev ekle' });
  let qp = 'orta';
  const qpSel = h('div', { class: 'seg compact', role: 'radiogroup', 'aria-label': 'Öncelik' });
  const renderQp = () => qpSel.replaceChildren(...ONCELIKLER.map((p) => h('button', {
    type: 'button', class: `seg-btn ${p.id === qp ? 'on' : ''}`, style: { '--c': p.color }, title: p.name, 'aria-label': p.name,
    onclick: () => { qp = p.id; renderQp(); qi.focus(); },
  }, h('span', { class: 'dot' }), p.name)));
  renderQp();
  const add = () => {
    const v = qi.value.trim(); if (!v) return;
    upsertTask({ title: v, priority: qp, categoryId: filterCat || '' });
    toast('Görev eklendi');
    setTimeout(() => document.querySelector('.quick-add input')?.focus(), 0);
  };
  qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  const filters = h('div', { class: 'chip-row' },
    h('button', { class: `chip ${!filterCat ? 'on' : ''}`, onclick: () => { filterCat = ''; renderTasks(root); } }, 'Hepsi'),
    state.taskCategories.map((c) => h('button', {
      class: `chip ${filterCat === c.id ? 'on' : ''}`, style: { '--c': c.color },
      onclick: () => { filterCat = filterCat === c.id ? '' : c.id; renderTasks(root); },
    }, c.name, ` ${state.tasks.filter((t) => !t.done && t.categoryId === c.id).length}`)));

  const board = h('div', { class: 'board' }, ONCELIKLER.map((p) => {
    const list = sortTasks(open.filter((t) => t.priority === p.id));
    const col = h('section', { class: 'lane', style: { '--c': p.color }, dataset: { pr: p.id } },
      h('header', { class: 'lane-head' }, h('span', { class: 'dot' }), h('h3', {}, p.name), h('span', { class: 'muted small' }, p.hint), h('span', { class: 'lane-count' }, list.length)),
      h('div', { class: 'lane-list' }, list.length ? list.map(card) : h('p', { class: 'lane-empty' }, 'Görevleri buraya sürükleyebilirsin')),
      h('button', { class: 'lane-add', onclick: () => openTaskForm(null, { priority: p.id, categoryId: filterCat }) }, '+ Görev'));
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('drop');
      const t = state.tasks.find((x) => x.id === e.dataTransfer.getData('text/plain'));
      if (t && t.priority !== p.id) { t.priority = p.id; commit('tasks'); toast(`"${t.title}" → ${p.name}`); }
    });
    return col;
  }));

  const doneSec = h('section', { class: 'done-sec' },
    h('button', { class: 'link', onclick: () => { showDone = !showDone; renderTasks(root); } }, `${showDone ? '▾' : '▸'} Tamamlananlar (${done.length})`),
    showDone ? h('div', { class: 'done-list' }, done.length ? done.slice(0, 50).map(card) : h('p', { class: 'muted' }, 'Henüz tamamlanan görev yok.')) : null,
    showDone && done.length ? h('button', { class: 'btn small ghost', onclick: () => { state.tasks = state.tasks.filter((t) => !t.done); commit('tasks'); toast('Tamamlananlar temizlendi'); } }, 'Tamamlananları temizle') : null);

  root.replaceChildren(
    h('div', { class: 'tasks-top' }, h('div', { class: 'quick-add' }, qi, qpSel), filters),
    board, doneSec);
}
