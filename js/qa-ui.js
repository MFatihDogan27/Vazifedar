// Hızlı ekleme kutusu: yazarken ne anlaşıldığını gösterir, Enter ile ekler.
import { h, toast } from './ui.js';
import { state, category, upsertEvent, deleteEvent, upsertTask, deleteTask, findConflictsFor } from './store.js';
import { parseLocal, fmtDateLong, timeStr, fmtRange, toLocalISO, relativeDays } from './dates.js';
import { describe, alignStart } from './recurrence.js';
import { parseQuick } from './quickadd.js';
import { openEventForm, openTaskForm, conflictDialog } from './forms.js';
import { ic } from './icons.js';

export function mountQuickAdd(slot) {
  const input = h('input', {
    type: 'text', class: 'qa-input', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Hızlı ekle',
    placeholder: 'Bir şey ekle: "cuma 20:00 halısaha"',
  });
  const preview = h('div', { class: 'qa-preview', role: 'status', 'aria-live': 'polite', hidden: true });
  const box = h('div', { class: 'qa' }, h('span', { class: 'qa-plus', 'aria-hidden': 'true' }, '+'), input, h('kbd', { class: 'qa-kbd', title: 'Kısayol' }, '/'), preview);
  slot.replaceChildren(box);

  let parsed = null;
  const course = (id) => state.courses.find((c) => c.id === id);

  function render() {
    const v = input.value.trim();
    if (!v) { preview.hidden = true; parsed = null; return; }
    parsed = parseQuick(v);
    const p = parsed;
    const rows = [];
    if (p.type === 'odev') {
      const c = course(p.courseId);
      rows.push(h('div', { class: 'qa-main' }, h('span', { class: 'qa-ic', style: { color: course(p.courseId)?.color } }, ic('book', { size: 18 })),
        h('strong', {}, `${c?.code || c?.name} · ${p.title}`),
        p.due ? h('span', {}, `teslim ${fmtDateLong(parseLocal(p.due))} ${p.dueTime} (${relativeDays(parseLocal(p.due))})`) : h('span', { class: 'qa-miss' }, 'teslim tarihi anlaşılamadı')));
      rows.push(h('div', { class: 'qa-tags' }, h('span', { class: 'qa-tag' }, 'Ödev olarak eklenecek')));
    } else if (p.ok) {
      const cat = category(p.categoryId);
      const st = parseLocal(p.start), en = parseLocal(p.end);
      rows.push(h('div', { class: 'qa-main' }, h('span', { class: 'qa-ic', style: { color: cat.color } }, ic(cat.icon, { size: 18 })), h('strong', {}, p.title),
        h('span', {}, p.recur ? `${describe(p.recur, p.start)}${p.allDay ? ', tüm gün' : `, ${timeStr(st)}–${timeStr(en)}`}` : (p.allDay ? `${fmtDateLong(st)}, tüm gün` : `${fmtDateLong(st)}, ${timeStr(st)}–${timeStr(en)}`))));
      rows.push(h('div', { class: 'qa-tags' },
        h('span', { class: 'qa-tag', style: { '--c': cat.color } }, cat.name),
        p.recur ? h('span', { class: 'qa-tag' }, ic('repeat', { size: 13 }), ` ilk: ${fmtDateLong(parseLocal(alignStart(p.start, p.recur)))}`) : null,
        p.location ? h('span', { class: 'qa-tag' }, ic('pin', { size: 13 }), ` ${p.location}`) : null,
        p.courseId ? h('span', { class: 'qa-tag' }, ic('cap', { size: 13 }), ` ${course(p.courseId)?.code || ''}`) : null));
    } else {
      rows.push(h('div', { class: 'qa-main' }, h('span', { class: 'qa-ic' }, ic('clock', { size: 18 })),
        h('span', { class: 'qa-miss' }, p.title ? `"${p.title}" için gün ya da saat anlaşılamadı.` : 'Ne zaman olduğunu da yaz: "yarın 14:00", "cuma akşam", "15 kasım"…')));
    }
    rows.push(h('div', { class: 'qa-hint' }, (p.ok ? 'Enter ekler · ' : 'Enter formu açar · ') + 'Shift+Enter formda düzenle · Esc kapat'));
    preview.replaceChildren(...rows);
    preview.hidden = false;
  }

  function openForm(p) {
    if (p.type === 'odev') openTaskForm(null, { title: p.title, courseId: p.courseId, due: p.due, dueTime: p.dueTime });
    else openEventForm({ title: p.title, categoryId: p.categoryId, ...(p.start ? { start: p.start, end: p.end } : {}), allDay: p.allDay, location: p.location, recur: p.recur });
  }

  async function submit(toForm) {
    render();
    const p = parsed;
    if (!p) return;
    clear();
    if (toForm || !p.ok) { openForm(p); return; }
    if (p.type === 'odev') {
      const t = upsertTask({ title: p.title, courseId: p.courseId, due: p.due, dueTime: p.dueTime, priority: 'yuksek', categoryId: state.taskCategories.find((c) => c.id === 'ders')?.id || '' });
      toast(`Ödev eklendi: ${course(p.courseId)?.code || ''} ${t.title}`, { action: { label: 'Geri al', onClick: () => deleteTask(t.id) } });
      return;
    }
    const cat = category(p.categoryId);
    const data = {
      title: p.title, categoryId: p.categoryId, start: p.start, end: p.end, allDay: p.allDay,
      location: p.location, recur: p.recur, reminderMin: cat.reminder ?? state.settings.defaultReminder,
      syncToGoogle: !!state.settings.googleConnected,
    };
    if (data.recur) {
      const a = alignStart(data.start, data.recur);
      if (a !== data.start) { const dur = parseLocal(data.end) - parseLocal(data.start); data.start = a; data.end = toLocalISO(new Date(parseLocal(a).getTime() + dur)); }
    }
    const conflicts = findConflictsFor(data);
    if (conflicts.length) {
      const choice = await conflictDialog(data, conflicts);
      if (choice === 'back') { openEventForm(data); return; }
      if (choice?.moveTo) { data.start = toLocalISO(choice.moveTo.start); data.end = toLocalISO(choice.moveTo.end); }
    }
    const ev = upsertEvent(data);
    const when = ev.recur ? `${describe(ev.recur, ev.start)}${ev.allDay ? '' : `, ${timeStr(parseLocal(ev.start))}`}` : fmtRange(parseLocal(ev.start), parseLocal(ev.end), ev.allDay);
    toast(`Eklendi: ${ev.title}, ${when}`, { ms: 5000, action: { label: 'Geri al', onClick: () => deleteEvent(ev.id) } });
  }

  function clear() { input.value = ''; preview.hidden = true; parsed = null; }

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) preview.hidden = true; }, 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(e.shiftKey); }
    else if (e.key === 'Escape') { clear(); input.blur(); }
  });
  return { focus: () => input.focus() };
}
