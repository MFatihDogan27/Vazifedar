// Ders programı: dönem tarihleri, tatiller, dersler ve haftalık çizelge.
import { h, toast, field, confirmDialog } from './ui.js';
import { state, commit, uid, dueDate } from './store.js';
import { GUNLER, GUNLER_KISA, hmToMin, parseLocal, fmtDateShort, relativeDays, timeStr, daysBetween } from './dates.js';
import { openCourseForm, openTaskForm, absenceMeter } from './forms.js';
import { tickButton, completeTask, repeatTag } from './tasks.js';
import * as G from './google.js';

const PX = 46; // saat başına piksel

function timetable() {
  const sessions = state.courses.flatMap((c) => c.sessions.map((s) => ({ c, s })));
  if (!sessions.length) return null;
  const days = [1, 2, 3, 4, 5];
  if (sessions.some(({ s }) => Number(s.day) === 6)) days.push(6);
  if (sessions.some(({ s }) => Number(s.day) === 7)) days.push(7);
  const minH = Math.min(8, ...sessions.map(({ s }) => Math.floor(hmToMin(s.start) / 60)));
  const maxH = Math.max(18, ...sessions.map(({ s }) => Math.ceil(hmToMin(s.end) / 60)));
  const hours = []; for (let x = minH; x < maxH; x++) hours.push(x);
  return h('div', { class: 'tt', style: { '--days': days.length } },
    h('div', { class: 'tt-head' }, h('div'), days.map((d) => h('div', {}, GUNLER_KISA[d - 1]))),
    h('div', { class: 'tt-body' },
      h('div', { class: 'tt-hours' }, hours.map((x) => h('div', { style: { height: `${PX}px` } }, `${String(x).padStart(2, '0')}:00`))),
      days.map((d) => h('div', { class: 'tt-col', style: { height: `${hours.length * PX}px`, backgroundSize: `100% ${PX}px` } },
        sessions.filter(({ s }) => Number(s.day) === d).map(({ c, s }) => {
          const top = ((hmToMin(s.start) - minH * 60) / 60) * PX;
          const hgt = ((hmToMin(s.end) - hmToMin(s.start)) / 60) * PX - 2;
          const clash = sessions.some((o) => o.s !== s && Number(o.s.day) === d && hmToMin(o.s.start) < hmToMin(s.end) && hmToMin(s.start) < hmToMin(o.s.end));
          return h('button', {
            class: `tt-item ${clash ? 'clash' : ''}`, style: { top: `${top}px`, height: `${hgt}px`, '--c': c.color },
            onclick: () => openCourseForm(c.id), title: `${c.name}\n${s.start}–${s.end}${s.location ? `\n${s.location}` : ''}`,
          }, h('strong', {}, c.code || c.name), h('span', {}, `${s.start}–${s.end}`), s.location ? h('span', {}, s.location) : null, s.type && s.type !== 'Teori' ? h('span', { class: 'tt-type' }, s.type) : null);
        })))));
}

export function renderCourses(root) {
  const t = state.term;
  const ts = h('input', { type: 'date', value: t.start });
  const te = h('input', { type: 'date', value: t.end });
  const saveTerm = () => { t.start = ts.value; t.end = te.value; commit('courses'); };
  ts.onchange = saveTerm; te.onchange = saveTerm;

  // Tatiller
  const bl = h('input', { type: 'text', placeholder: 'Örn. Cumhuriyet Bayramı' });
  const bs = h('input', { type: 'date' });
  const be = h('input', { type: 'date' });
  const addBreak = () => {
    if (!bs.value) { toast('Tatil başlangıç tarihi gerekli', { kind: 'warn' }); return; }
    t.breaks.push({ id: uid(), label: bl.value.trim() || 'Tatil', start: bs.value, end: be.value || bs.value });
    t.breaks.sort((a, b) => a.start.localeCompare(b.start));
    commit('courses');
  };

  const termCard = h('section', { class: 'panel' },
    h('h3', {}, 'Dönem'),
    h('p', { class: 'muted small' }, 'Dersler yalnız bu tarihler arasında takvimde görünür. Boş bırakırsan her hafta görünür.'),
    h('div', { class: 'grid-2' }, field('Dönem başlangıcı', ts), field('Dönem sonu', te)),
    h('h4', {}, 'Tatiller ve ders olmayan günler'),
    t.breaks.length ? h('ul', { class: 'breaks' }, t.breaks.map((b) => h('li', {},
      h('span', {}, h('strong', {}, b.label), ' ', h('span', { class: 'muted' }, b.end && b.end !== b.start ? `${fmtDateShort(parseLocal(b.start))} – ${fmtDateShort(parseLocal(b.end))}` : fmtDateShort(parseLocal(b.start)))),
      h('button', { class: 'icon-btn', 'aria-label': `${b.label} tatilini kaldır`, onclick: () => { t.breaks = t.breaks.filter((x) => x !== b); state.term.breaks = t.breaks; commit('courses'); } }, '✕')))) : h('p', { class: 'muted small' }, 'Henüz tatil eklenmedi.'),
    h('div', { class: 'break-add' }, bl, bs, be, h('button', { class: 'btn small', onclick: addBreak }, 'Tatil ekle')));

  const list = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h3', {}, 'Dersler'), h('button', { class: 'btn primary small', onclick: () => openCourseForm() }, '+ Ders ekle')),
    state.courses.length ? h('ul', { class: 'course-list' }, state.courses.map((c) => h('li', {},
      h('button', { class: 'course-row', style: { '--c': c.color }, onclick: () => openCourseForm(c.id) },
        h('span', { class: 'sw' }),
        h('span', { class: 'cr-main' }, h('strong', {}, [c.code, c.name].filter(Boolean).join(' · ')), c.instructor ? h('span', { class: 'muted small' }, c.instructor) : null),
        h('span', { class: 'cr-sess' }, c.sessions.map((s) => h('span', {}, `${GUNLER[s.day - 1]} ${s.start}–${s.end}${s.location ? `, ${s.location}` : ''}`))),
        h('span', { class: 'cr-side' },
          absenceMeter(c, { compact: true }),
          (() => { const n = state.tasks.filter((t) => t.courseId === c.id && !t.done).length; return n ? h('span', { class: 'muted small' }, `${n} açık ödev`) : null; })(),
          c.skips.length ? h('span', { class: 'muted small' }, `${c.skips.length} iptal`) : null))))) : h('div', { class: 'empty small' }, h('p', {}, 'Ders programın boş. Her ders için gün ve saatleri bir kez gir, takvimde her hafta görünsün.'), h('button', { class: 'btn primary', onclick: () => openCourseForm() }, 'İlk dersi ekle')));

  // Google'a aktar
  const exported = state.courses.some((c) => c.sessions.some((s) => s.googleId));
  const gCard = G.isConfigured() ? h('section', { class: 'panel' },
    h('h3', {}, 'Google Takvim'),
    h('p', { class: 'muted small' }, exported
      ? 'Ders programın Google Takvim\'de tekrarlayan etkinlikler olarak var. Ders, oturum, tatil ya da iptal değiştikçe kendiliğinden güncellenir. Ödev teslimleri de oraya gider (Ayarlar → Google Takvim).'
      : 'Ders programını Google Takvim\'e haftalık tekrarlayan etkinlikler olarak aktarabilirsin (telefonda da görünür).'),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn', disabled: !state.courses.length, onclick: async (e) => {
          e.target.disabled = true;
          try { const n = await G.exportCourses(); toast(`${n} ders oturumu Google Takvim'de güncel`); } catch (err) { toast(err.message, { kind: 'warn', ms: 6000 }); }
          e.target.disabled = false;
        },
      }, exported ? 'Şimdi güncelle' : 'Google Takvim\'e aktar'),
      exported ? h('button', {
        class: 'btn ghost', onclick: async () => {
          if (!await confirmDialog({ title: 'Dersler Google\'dan kaldırılsın mı?', message: 'Vazifedar\'daki ders programı yerinde kalır.', okLabel: 'Kaldır', danger: true })) return;
          try { const n = await G.removeCoursesFromGoogle(); toast(`${n} ders oturumu Google'dan kaldırıldı`); } catch (err) { toast(err.message, { kind: 'warn' }); }
        },
      }, 'Google\'dan kaldır') : null)) : null;

  // Ödevler ve teslimler
  const hw = state.tasks.filter((t) => t.courseId && (!t.done || (t.doneAt && daysBetween(new Date(t.doneAt), new Date()) < 3)))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9').localeCompare(b.due || '9') || (a.dueTime || '').localeCompare(b.dueTime || ''));
  const hwCard = state.courses.length ? h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h3', {}, 'Ödevler ve teslimler'), h('button', { class: 'btn small', onclick: () => openTaskForm(null, { courseId: state.courses[0].id }) }, '+ Ödev ekle')),
    hw.length ? h('ul', { class: 'hw-list' }, hw.map((t) => {
      const c = state.courses.find((x) => x.id === t.courseId);
      const due = t.due ? dueDate(t) : null;
      const n = due ? daysBetween(new Date(), due) : null;
      const late = due && !t.done && due < new Date();
      return h('li', { class: `hw ${t.done ? 'done' : ''}`, style: { '--c': c?.color || '#2B47B9' } },
        tickButton(t.done, (e) => completeTask(t, e.currentTarget), t.done ? 'Teslim edilmedi olarak işaretle' : 'Teslim edildi olarak işaretle'),
        h('button', { class: 'hw-main', onclick: () => openTaskForm(t.id) },
          h('span', { class: 'hw-course' }, c?.code || c?.name || '', repeatTag(t, { short: true })),
          h('strong', {}, t.title)),
        due ? h('span', { class: `hw-due ${late ? 'late' : n !== null && n <= 2 && !t.done ? 'soon' : ''}` },
          `${fmtDateShort(due)} ${timeStr(due)}`, h('span', { class: 'muted small' }, t.done ? 'teslim edildi' : late ? 'gecikti' : relativeDays(due))) : null);
    })) : h('p', { class: 'muted small' }, 'Açık ödev yok. Takvimdeki hızlı ekleme kutusuna "ELE 271 ödev 3 cuma" yazarak da ekleyebilirsin.')) : null;

  const tt = timetable();
  root.replaceChildren(h('div', { class: 'courses' },
    h('div', { class: 'courses-main' }, tt ? h('section', { class: 'panel' }, h('h3', {}, 'Haftalık çizelge'), tt) : null, list),
    h('div', { class: 'courses-side' }, hwCard, termCard, gCard)));
}
