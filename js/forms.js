// Plan, ders, görev formları; çakışma uyarısı; devamsızlık; görevi takvime yerleştirme.
import { h, openModal, confirmDialog, toast, field } from './ui.js';
import {
  state, commit, uid, category, upsertEvent, deleteEvent, findConflictsFor, findFreeSlot,
  courseSessionConflicts, upsertTask, deleteTask, ONCELIKLER, PALET, dueDate,
  createSeries, updateSeriesFrom, endSeries, seriesOf,
  absenceInfo, toggleAbsence, suggestAbsenceLimit, skipOccurrence, endSeriesBefore,
  absentHours, setAbsentHours, hourSlots,
} from './store.js';
import {
  parseLocal, toLocalISO, toDateKey, addMinutes, addDays, timeStr, fmtRange, fmtDateLong, fmtDateShort,
  GUNLER, GUNLER_KISA, hmToMin, durationText, startOfDay, isoWeekday, relativeDays,
} from './dates.js';
import { SIKLIK, describe, alignStart, isRecurring } from './recurrence.js';
import { ic } from './icons.js';
import { pinSection } from './notes.js';
import { applyTexture, textureKey, themedCard } from './themes.js';
import { topicsEditor, occurrenceTopics } from './topics.js';
// "Her salı, 8 Ocak tarihine kadar" → cümle içinde: yalnız ilk harf küçülür
const lcFirst = (x) => x.charAt(0).toLocaleLowerCase('tr') + x.slice(1);

const HATIRLATMA = [
  [null, 'Hatırlatma yok'], [0, 'Başladığında'], [10, '10 dk önce'], [30, '30 dk önce'],
  [60, '1 saat önce'], [120, '2 saat önce'], [1440, '1 gün önce'], [2880, '2 gün önce'], [10080, '1 hafta önce'],
];
const SURELER = [15, 30, 45, 60, 90, 120, 180, 240, 360];

function select(options, value, attrs = {}) {
  const s = h('select', attrs, options.map(([v, l]) => h('option', { value: v ?? '' }, l)));
  s.value = value ?? '';
  return s;
}
function roundNext(d) {
  const x = new Date(d); x.setMinutes(0, 0, 0); x.setHours(x.getHours() + 1); return x;
}
const courseLabel = (c) => (c ? (c.code || c.name) : '');

// Takvimdeki herhangi bir kayda tıklanınca doğru pencereyi aç
export function openOccurrence(o) {
  if (o.kind === 'course') openCourseOccurrence(o);
  else if (o.kind === 'deadline') openTaskForm(o.taskId);
  else openEventForm({ id: o.ref?.id || o.id, occDate: o.occDate });
}

// Seçenekli küçük pencere: [{ value, label, kind }] → seçilen value (ya da null)
function choiceDialog({ title, message, choices }) {
  return new Promise((resolve) => {
    let done = false;
    openModal({
      title,
      body: h('p', {}, message),
      actions: choices.map((c) => ({
        label: c.label, kind: c.kind || '',
        onClick: (_, close) => { done = true; close(); resolve(c.value); },
      })),
      onClose: () => { if (!done) resolve(null); },
    });
  });
}

// ---------------------------------------------------------------------------
// Plan formu (tek seferlik ya da tekrarlayan)
// ---------------------------------------------------------------------------
export function openEventForm(initial = {}) {
  const existing = initial.id ? state.events.find((e) => e.id === initial.id) : null;
  const series = existing && isRecurring(existing);
  const occDate = series ? initial.occDate : null;
  let ev;
  if (existing) {
    ev = { ...existing };
    if (occDate) {
      // Tekrarın kendi tarihini göster
      const dur = parseLocal(existing.end) - parseLocal(existing.start);
      const st = parseLocal(`${occDate}T${existing.start.split('T')[1]}`);
      ev.start = toLocalISO(st); ev.end = toLocalISO(new Date(st.getTime() + dur));
    }
  } else {
    ev = {
      title: '', categoryId: initial.categoryId || 'diger', allDay: false, location: '', notes: '',
      start: initial.start || toLocalISO(roundNext(new Date())), end: initial.end || null,
      reminderMin: null, syncToGoogle: !!state.settings.googleConnected, recur: null,
      ...initial,
    };
    const cat = category(ev.categoryId);
    if (!ev.end) ev.end = toLocalISO(addMinutes(parseLocal(ev.start), cat.duration || 60));
    if (initial.reminderMin === undefined) ev.reminderMin = cat.reminder ?? state.settings.defaultReminder;
  }
  const occStartOrig = parseLocal(ev.start);

  let endTouched = !!existing || !!initial.end;
  const s = parseLocal(ev.start), e = parseLocal(ev.end);

  const title = h('input', { type: 'text', value: ev.title, placeholder: 'Ne yapacaksın? Örn. Halısaha – Cuma maçı', required: true, autofocus: true, maxlength: 200 });
  const startDate = h('input', { type: 'date', value: toDateKey(s), required: true });
  const startTime = h('input', { type: 'time', value: timeStr(s), step: 300 });
  const endDate = h('input', { type: 'date', value: toDateKey(e), required: true });
  const endTime = h('input', { type: 'time', value: timeStr(e), step: 300 });
  const allDay = h('input', { type: 'checkbox', checked: !!ev.allDay });
  const location = h('input', { type: 'text', value: ev.location || '', placeholder: 'Konum (isteğe bağlı)' });
  const notes = h('textarea', { rows: 3, placeholder: 'Notlar' }, ev.notes || '');
  const reminder = select(HATIRLATMA, ev.reminderMin);
  const sync = h('input', { type: 'checkbox', checked: !!ev.syncToGoogle });

  let catId = ev.categoryId;
  const catRow = h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Kategori' });
  const renderCats = () => {
    catRow.replaceChildren(...state.categories.map((c) => h('button', {
      type: 'button', class: `chip ${c.id === catId ? 'on' : ''}`, role: 'radio', 'aria-checked': String(c.id === catId),
      style: { '--c': c.color },
      onclick: () => {
        catId = c.id; renderCats();
        if (!endTouched) setEndFromDuration(c.duration || 60);
        if (!existing) reminder.value = c.reminder ?? state.settings.defaultReminder ?? '';
      },
    }, h('span', { class: 'chip-icon' }, ic(c.icon, { size: 15 })), c.name)));
  };
  renderCats();

  function readStart() { return parseLocal(`${startDate.value}T${allDay.checked ? '00:00' : (startTime.value || '00:00')}`); }
  function setEndFromDuration(min) {
    const en = addMinutes(readStart(), min);
    endDate.value = toDateKey(en); endTime.value = timeStr(en);
  }
  let lastStart = readStart();
  const onStartChange = () => {
    const st = readStart();
    if (isNaN(st)) return;
    const en = parseLocal(`${endDate.value}T${endTime.value || '00:00'}`);
    const dur = en - lastStart;
    if (!isNaN(dur) && dur > 0) {
      const ne = new Date(st.getTime() + dur);
      endDate.value = toDateKey(ne); endTime.value = timeStr(ne);
    }
    lastStart = st;
    // Haftalık tekrarda tek gün seçiliyse başlangıç gününü izlesin
    if (rec.freq === 'weekly' && rec.byDay.length <= 1) { rec.byDay = [isoWeekday(st)]; renderRec(); }
    else updateRecText();
  };
  startDate.addEventListener('change', onStartChange);
  startTime.addEventListener('change', onStartChange);
  endDate.addEventListener('change', () => { endTouched = true; });
  endTime.addEventListener('change', () => { endTouched = true; });

  const timeWrap = h('div', { class: 'grid-2' },
    field('Başlangıç', h('div', { class: 'dt' }, startDate, startTime)),
    field('Bitiş', h('div', { class: 'dt' }, endDate, endTime)));
  const toggleAllDay = () => { startTime.hidden = allDay.checked; endTime.hidden = allDay.checked; };
  allDay.addEventListener('change', toggleAllDay);
  toggleAllDay();

  // --- Tekrar ---
  const rec = {
    freq: ev.recur?.freq || '',
    interval: ev.recur?.interval || 1,
    byDay: ev.recur?.byDay?.length ? ev.recur.byDay.map(Number) : [isoWeekday(s)],
    until: ev.recur?.until || '',
  };
  const freqSel = select(SIKLIK, rec.freq, { 'aria-label': 'Tekrar' });
  const intervalIn = h('input', { type: 'number', min: 1, max: 30, value: rec.interval, class: 'num', 'aria-label': 'Aralık' });
  const untilIn = h('input', { type: 'date', value: rec.until, 'aria-label': 'Tekrar bitiş tarihi' });
  const recText = h('p', { class: 'rec-text' });
  const recBox = h('div', { class: 'rec-box' });
  const unitWord = { daily: 'günde bir', weekly: 'haftada bir', monthly: 'ayda bir', yearly: 'yılda bir' };
  function updateRecText() {
    recText.textContent = rec.freq ? describe(rec, `${startDate.value}T${startTime.value || '00:00'}`) : '';
  }
  function renderRec() {
    freqSel.value = rec.freq;
    if (!rec.freq) { recBox.replaceChildren(); recText.textContent = ''; return; }
    const days = rec.freq === 'weekly' ? h('div', { class: 'day-toggle', role: 'group', 'aria-label': 'Günler' },
      GUNLER_KISA.map((g, i) => h('button', {
        type: 'button', class: `day-btn ${rec.byDay.includes(i + 1) ? 'on' : ''}`, 'aria-pressed': String(rec.byDay.includes(i + 1)), title: GUNLER[i],
        onclick: () => {
          const d = i + 1;
          rec.byDay = rec.byDay.includes(d) ? rec.byDay.filter((x) => x !== d) : [...rec.byDay, d];
          if (!rec.byDay.length) rec.byDay = [d];
          renderRec();
        },
      }, g))) : null;
    recBox.replaceChildren(
      h('div', { class: 'rec-row' },
        intervalIn, h('span', { class: 'muted' }, unitWord[rec.freq]),
        h('span', { class: 'muted rec-until-l' }, 'bitiş'), untilIn,
        rec.until ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bitiş tarihini kaldır', onclick: () => { rec.until = ''; untilIn.value = ''; renderRec(); } }, '✕') : h('span', { class: 'muted small' }, '(yoksa süresiz)')),
      days);
    updateRecText();
  }
  freqSel.onchange = () => { rec.freq = freqSel.value; if (rec.freq === 'weekly' && !rec.byDay.length) rec.byDay = [isoWeekday(readStart())]; renderRec(); };
  intervalIn.onchange = () => { rec.interval = Math.max(1, Math.min(30, Number(intervalIn.value) || 1)); intervalIn.value = rec.interval; updateRecText(); };
  untilIn.onchange = () => { rec.until = untilIn.value; renderRec(); };
  renderRec();

  // Var olan bir planın (ya da tekrarın) unutma notları
  let pinOcc = null;
  if (existing && (!series || occDate)) {
    const cat0 = category(existing.categoryId);
    pinOcc = {
      kind: 'event', id: series ? `${existing.id}@${occDate}` : existing.id, ref: existing, title: existing.title,
      categoryId: existing.categoryId, color: cat0.color, start: parseLocal(ev.start), end: parseLocal(ev.end),
      allDay: !!existing.allDay, recurring: !!series, occDate, location: existing.location || '',
    };
  }

  const syncRow = state.settings.googleClientId
    ? h('label', { class: 'check' }, sync, h('span', {}, 'Google Takvim ile eşitle'))
    : null;

  const form = h('form', { class: 'form', novalidate: true },
    pinOcc ? themedCard(pinOcc, new Date(), { banner: true }) : null,
    field('Başlık', title),
    field('Kategori', catRow),
    h('label', { class: 'check' }, allDay, h('span', {}, 'Tüm gün')),
    timeWrap,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Tekrar'), h('div', { class: 'rec' }, freqSel, recBox), recText),
    h('div', { class: 'grid-2' }, field('Konum', location), field('Hatırlatma', reminder)),
    field('Notlar', notes),
    pinOcc ? pinSection(pinOcc) : null,
    syncRow,
    existing?.source === 'google' ? h('p', { class: 'muted small' }, 'Bu plan Google Takvim\'den geldi.') : null,
  );

  const actions = [];
  if (existing) {
    actions.push({
      label: 'Sil', kind: 'danger ghost left', onClick: async (_, close) => {
        const g = existing.googleId && existing.syncToGoogle ? ' (Google Takvim\'den de)' : '';
        if (series && occDate) {
          const choice = await choiceDialog({
            title: 'Tekrarlayan plan silinsin mi?',
            message: `"${existing.title}" bir serinin parçası (${lcFirst(describe(existing.recur, existing.start))}).`,
            choices: [
              { value: null, label: 'Vazgeç' },
              { value: 'all', label: 'Tüm seri', kind: 'danger ghost' },
              { value: 'future', label: 'Bu ve sonrakiler', kind: 'danger ghost' },
              { value: 'one', label: 'Yalnız bu', kind: 'danger' },
            ],
          });
          if (!choice) return;
          if (choice === 'one') skipOccurrence(existing.id, occDate);
          else if (choice === 'future') endSeriesBefore(existing.id, occDate);
          else deleteEvent(existing.id);
          close(); toast(choice === 'one' ? 'Bu tekrar silindi' : choice === 'future' ? 'Bu ve sonraki tekrarlar silindi' : `Seri silindi${g}`);
          return;
        }
        const ok = await confirmDialog({ title: 'Plan silinsin mi?', message: `"${existing.title}" silinecek${g}.`, okLabel: 'Sil', danger: true });
        if (ok) { deleteEvent(existing.id); close(); toast('Plan silindi'); }
      },
    });
  }
  actions.push({ label: 'Vazgeç', onClick: (_, close) => close() });
  actions.push({ label: existing ? 'Kaydet' : 'Ekle', kind: 'primary', onClick: (_, close) => submit(close) });

  form.addEventListener('submit', (e2) => { e2.preventDefault(); });
  form.addEventListener('keydown', (e2) => {
    if (e2.key === 'Enter' && e2.target.tagName === 'INPUT' && !['checkbox', 'number'].includes(e2.target.type)) { e2.preventDefault(); submit(modal.close); }
  });

  const modal = openModal({ title: existing ? (series ? 'Tekrarlayan planı düzenle' : 'Planı düzenle') : 'Yeni plan', body: form, actions });

  async function submit(close) {
    const t = title.value.trim();
    if (!t) { title.focus(); title.classList.add('invalid'); toast('Başlık boş olamaz', { kind: 'warn' }); return; }
    let start, end;
    if (allDay.checked) {
      start = `${startDate.value}T00:00`;
      end = `${endDate.value || startDate.value}T23:59`;
    } else {
      start = `${startDate.value}T${startTime.value || '00:00'}`;
      end = `${endDate.value || startDate.value}T${endTime.value || '00:00'}`;
    }
    if (!(parseLocal(end) > parseLocal(start))) { toast('Bitiş, başlangıçtan sonra olmalı', { kind: 'warn' }); endTime.focus(); return; }
    const recur = rec.freq ? { freq: rec.freq, interval: rec.interval, byDay: rec.freq === 'weekly' ? [...rec.byDay].sort() : [], until: rec.until } : null;
    if (recur?.until && recur.until < start.slice(0, 10)) { toast('Tekrar bitiş tarihi başlangıçtan önce olamaz', { kind: 'warn' }); return; }

    const data = {
      title: t, categoryId: catId, allDay: allDay.checked, start, end,
      location: location.value.trim(), notes: notes.value.trim(),
      reminderMin: reminder.value === '' ? null : Number(reminder.value),
      syncToGoogle: syncRow ? sync.checked : !!ev.syncToGoogle,
      recur,
    };
    if (initial.taskId) data.taskId = initial.taskId;

    // Tekrarlayan bir serinin tek tekrarı düzenleniyorsa: yalnız bu mu, tüm seri mi?
    let scope = 'all';
    if (series && occDate) {
      scope = await choiceDialog({
        title: 'Hangi tekrarlar değişsin?',
        message: `"${existing.title}" bir serinin parçası.`,
        choices: [
          { value: null, label: 'Vazgeç' },
          { value: 'one', label: 'Yalnız bu' },
          { value: 'all', label: 'Tüm seri', kind: 'primary' },
        ],
      });
      if (!scope) return;
    }

    if (scope === 'one') {
      data.recur = null;
    } else if (series && occDate) {
      // Tüm seri: bu tekrardaki saat/tarih kaymasını serinin başlangıcına uygula
      const delta = parseLocal(start) - occStartOrig;
      const dur = parseLocal(end) - parseLocal(start);
      const ms = new Date(parseLocal(existing.start).getTime() + delta);
      data.start = toLocalISO(ms); data.end = toLocalISO(new Date(ms.getTime() + dur));
      data.exdates = existing.exdates || [];
    }
    if (data.recur) {
      const aligned = alignStart(data.start, data.recur);
      if (aligned !== data.start) {
        const dur = parseLocal(data.end) - parseLocal(data.start);
        data.start = aligned; data.end = toLocalISO(new Date(parseLocal(aligned).getTime() + dur));
      }
    }

    const excludeId = scope === 'all' ? existing?.id : null;
    const conflicts = findConflictsFor(data, { excludeEventId: excludeId });
    if (conflicts.length) {
      const choice = await conflictDialog(data, conflicts);
      if (choice === 'back') return;
      if (choice?.moveTo) { data.start = toLocalISO(choice.moveTo.start); data.end = toLocalISO(choice.moveTo.end); }
    }

    let saved;
    if (scope === 'one') {
      skipOccurrence(existing.id, occDate);
      saved = upsertEvent({ ...data, exdates: [] });
    } else {
      if (existing) data.id = existing.id;
      if (!data.recur) data.exdates = [];
      saved = upsertEvent(data);
    }
    if (initial.taskId) {
      const task = state.tasks.find((x) => x.id === initial.taskId);
      if (task) { task.scheduledEventId = saved.id; commit('tasks'); }
    }
    close();
    if (saved.recur) toast(`${existing ? 'Güncellendi' : 'Eklendi'}: ${describe(saved.recur, saved.start)}, ${saved.allDay ? 'tüm gün' : timeStr(parseLocal(saved.start))}`);
    else toast(existing ? 'Plan güncellendi' : `Eklendi: ${fmtRange(parseLocal(saved.start), parseLocal(saved.end), saved.allDay)}`);
  }
  return modal;
}

// Sürükle-bırakla taşınan/uzatılan bir planı kaydet
export async function moveOccurrence(o, ns, ne) {
  const ev = o.ref;
  if (!ev || o.kind !== 'event') return false;
  let scope = 'all';
  if (o.recurring) {
    scope = await choiceDialog({
      title: 'Hangi tekrarlar taşınsın?', message: `"${ev.title}" bir serinin parçası.`,
      choices: [{ value: null, label: 'Vazgeç' }, { value: 'one', label: 'Yalnız bu' }, { value: 'all', label: 'Tüm seri', kind: 'primary' }],
    });
    if (!scope) return false;
  }
  const prev = { start: ev.start, end: ev.end, recur: ev.recur ? { ...ev.recur } : null };
  let data;
  if (scope === 'one') {
    data = {
      title: ev.title, categoryId: ev.categoryId, allDay: false, location: ev.location, notes: ev.notes,
      reminderMin: ev.reminderMin, syncToGoogle: ev.syncToGoogle, recur: null, exdates: [],
      start: toLocalISO(ns), end: toLocalISO(ne),
    };
  } else if (o.recurring) {
    const delta = ns - o.start;
    const ms = new Date(parseLocal(ev.start).getTime() + delta);
    const recur = { ...ev.recur };
    const dayShift = Math.round((startOfDay(ns) - startOfDay(o.start)) / 86400000);
    if (recur.freq === 'weekly' && recur.byDay?.length && dayShift) {
      recur.byDay = recur.byDay.map((d) => ((((Number(d) - 1 + dayShift) % 7) + 7) % 7) + 1).sort();
    }
    data = { id: ev.id, title: ev.title, allDay: false, recur, exdates: ev.exdates || [], start: toLocalISO(ms), end: toLocalISO(new Date(ms.getTime() + (ne - ns))) };
  } else {
    data = { id: ev.id, title: ev.title, allDay: false, start: toLocalISO(ns), end: toLocalISO(ne) };
  }
  const conflicts = findConflictsFor({ ...ev, ...data }, { excludeEventId: ev.id });
  if (conflicts.length) {
    const choice = await conflictDialog({ ...ev, ...data }, conflicts);
    if (choice === 'back') return false;
    if (choice?.moveTo) { data.start = toLocalISO(choice.moveTo.start); data.end = toLocalISO(choice.moveTo.end); }
  }
  if (scope === 'one') {
    skipOccurrence(ev.id, o.occDate);
    upsertEvent(data);
    toast(`Bu tekrar taşındı: ${fmtRange(parseLocal(data.start), parseLocal(data.end), false)}`);
  } else {
    upsertEvent(data);
    toast(`Taşındı: ${o.recurring ? describe(data.recur, data.start) + ', ' + timeStr(parseLocal(data.start)) : fmtRange(parseLocal(data.start), parseLocal(data.end), false)}`, {
      action: { label: 'Geri al', onClick: () => upsertEvent({ id: ev.id, ...prev }) },
    });
  }
  return true;
}

// Çakışma uyarısı — kullanıcı yine de ekleyebilir.
export function conflictDialog(data, conflicts) {
  return new Promise((resolve) => {
    let settled = false;
    const st = parseLocal(data.start), en = parseLocal(data.end);
    const dur = Math.round((en - st) / 60000);
    const recurring = !!data.recur;
    const slot = recurring ? null : findFreeSlot(dur, new Date(Math.max(Date.now(), startOfDay(st).getTime())));
    const shown = conflicts.slice(0, 8);
    const list = h('ul', { class: 'conflict-list' }, shown.map((c) => h('li', { style: { '--c': c.color } },
      h('span', { class: 'cl-icon' }, ic(c.icon, { size: 18 })),
      h('div', {},
        h('strong', {}, c.title),
        h('div', { class: 'muted small' },
          c.on ? `${fmtDateShort(c.on)}, ` : '',
          `${timeStr(c.start)}–${timeStr(c.end)}`,
          c.kind === 'course' ? ' · ders programı' : '',
          c.location ? ` · ${c.location}` : '')))));
    const days = recurring ? new Set(conflicts.map((c) => toDateKey(c.on))).size : 0;
    const intro = recurring
      ? [h('strong', {}, `"${data.title}"`), ` (${lcFirst(describe(data.recur, data.start))}) önümüzdeki dönemde ${days} tekrarda başka kayıtlarla çakışıyor:`]
      : [h('strong', {}, `"${data.title}"`), ` (${fmtRange(st, en, false)}) şu ${conflicts.length > 1 ? 'kayıtlarla' : 'kayıtla'} çakışıyor:`];
    const body = h('div', { class: 'conflict' },
      h('p', {}, intro),
      list,
      conflicts.length > shown.length ? h('p', { class: 'muted small' }, `…ve ${conflicts.length - shown.length} çakışma daha`) : null,
      slot ? h('div', { class: 'suggest' },
        h('span', {}, 'İlk boş zaman: ', h('strong', {}, fmtRange(slot.start, slot.end, false))),
        h('button', { type: 'button', class: 'btn small', onclick: () => { settled = true; m.close(); resolve({ moveTo: slot }); } }, 'Oraya taşı')) : null);
    const m = openModal({
      title: 'Çakışma var',
      body,
      actions: [
        { label: 'Geri dön', onClick: (_, close) => { settled = true; close(); resolve('back'); } },
        { label: 'Yine de ekle', kind: 'primary warn', onClick: (_, close) => { settled = true; close(); resolve('force'); } },
      ],
      onClose: () => { if (!settled) resolve('back'); },
    });
  });
}

// ---------------------------------------------------------------------------
// Ders formu (haftalık oturumlar + devamsızlık sınırı)
// ---------------------------------------------------------------------------
export function openCourseForm(courseId, { focus = '' } = {}) {
  const existing = courseId ? state.courses.find((c) => c.id === courseId) : null;
  const c = existing ? JSON.parse(JSON.stringify(existing)) : {
    name: '', code: '', instructor: '', color: PALET[state.courses.length % PALET.length], skips: [], absences: [],
    absenceLimit: '', absenceUnit: 'saat',
    sessions: [{ id: uid(), day: 1, start: '09:30', end: '11:20', location: '', type: 'Teori' }],
  };

  const name = h('input', { type: 'text', value: c.name, placeholder: 'Örn. Elektronik Devreler', autofocus: true });
  const code = h('input', { type: 'text', value: c.code, placeholder: 'Örn. ELE 271' });
  const instructor = h('input', { type: 'text', value: c.instructor || '', placeholder: 'İsteğe bağlı' });
  let color = c.color;
  const swatches = h('div', { class: 'swatches' });
  const renderSw = () => swatches.replaceChildren(...PALET.map((p) => h('button', {
    type: 'button', class: `swatch ${p === color ? 'on' : ''}`, style: { background: p }, 'aria-label': `Renk ${p}`,
    onclick: () => { color = p; renderSw(); },
  })));
  renderSw();

  const sessWrap = h('div', { class: 'sessions' });
  const renderSessions = () => {
    sessWrap.replaceChildren(...c.sessions.map((s, i) => {
      const day = select(GUNLER.map((g, k) => [k + 1, g]), s.day);
      const st = h('input', { type: 'time', value: s.start, step: 300 });
      const en = h('input', { type: 'time', value: s.end, step: 300 });
      const loc = h('input', { type: 'text', value: s.location || '', placeholder: 'Derslik' });
      const type = select([['Teori', 'Teori'], ['Lab', 'Lab'], ['PS', 'PS'], ['Uygulama', 'Uygulama']], s.type || 'Teori');
      const warn = h('div', { class: 'sess-warn' });
      const check = () => {
        const cf = courseSessionConflicts(existing?.id || '__new', s);
        warn.textContent = cf.length ? `Çakışıyor: ${cf.map((x) => `${x.course.code || x.course.name} (${x.session.start}–${x.session.end})`).join(', ')}` : '';
      };
      day.onchange = () => { s.day = Number(day.value); check(); };
      st.onchange = () => { s.start = st.value; check(); };
      en.onchange = () => { s.end = en.value; check(); };
      loc.oninput = () => { s.location = loc.value; };
      type.onchange = () => { s.type = type.value; };
      check();
      return h('div', { class: 'sess' },
        h('div', { class: 'sess-row' }, day, st, h('span', { class: 'muted' }, '–'), en, type, loc,
          h('button', {
            type: 'button', class: 'icon-btn', 'aria-label': 'Oturumu kaldır', disabled: c.sessions.length === 1,
            onclick: () => { c.sessions.splice(i, 1); renderSessions(); },
          }, '✕')),
        warn);
    }));
  };
  renderSessions();

  // Devamsızlık sınırı
  const limitIn = h('input', { type: 'number', min: 0, max: 200, value: c.absenceLimit, placeholder: 'Örn. 12', class: 'num wide' });
  const unitSel = select([['saat', 'ders saati'], ['oturum', 'ders (oturum)']], c.absenceUnit || 'saat');
  const suggestBtn = h('button', {
    type: 'button', class: 'btn small ghost', onclick: () => {
      const tmp = { ...c, absenceUnit: unitSel.value };
      limitIn.value = suggestAbsenceLimit(tmp, 0.3);
    },
  }, 'Dönemin %30\'u');

  // Konular: ders kodu okulun müfredatındaysa kendiliğinden dolar
  const topicsEd = topicsEditor(c, { code, name, isNew: !existing });

  const body = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid-2' }, field('Ders adı', name), field('Ders kodu', code)),
    h('div', { class: 'grid-2' }, field('Öğretim üyesi', instructor), field('Renk', swatches)),
    field('Haftalık oturumlar', h('div', {}, sessWrap,
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => { const last = c.sessions[c.sessions.length - 1]; c.sessions.push({ id: uid(), day: Math.min(7, (last?.day || 1) + 2), start: last?.start || '09:30', end: last?.end || '11:20', location: last?.location || '', type: 'Teori' }); renderSessions(); } }, '+ Oturum ekle'))),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Devamsızlık hakkı'),
      h('div', { class: 'row' }, limitIn, unitSel, suggestBtn),
      h('span', { class: 'field-hint' }, 'Boş bırakırsan yalnız sayar, uyarmaz. Oranı yönetmelikten ya da ders izlencesinden kontrol et. Bir derse gitmediğinde takvimde o derse tıklayıp "Gitmedim" de.')),
    topicsEd.el,
  );

  const actions = [];
  if (existing) actions.push({
    label: 'Dersi sil', kind: 'danger ghost left', onClick: async (_, close) => {
      if (await confirmDialog({ title: 'Ders silinsin mi?', message: `${existing.name} ders programından kaldırılacak.`, okLabel: 'Sil', danger: true })) {
        state.courses.splice(state.courses.indexOf(existing), 1);
        for (const t of state.tasks) if (t.courseId === existing.id) t.courseId = '';
        commit('courses'); close(); toast('Ders silindi');
      }
    },
  });
  actions.push({ label: 'Vazgeç', onClick: (_, close) => close() });
  actions.push({
    label: 'Kaydet', kind: 'primary', onClick: async (_, close) => {
      if (!name.value.trim()) { name.focus(); toast('Ders adı gerekli', { kind: 'warn' }); return; }
      for (const s of c.sessions) {
        if (!s.start || !s.end || hmToMin(s.end) <= hmToMin(s.start)) { toast('Her oturumun bitişi başlangıçtan sonra olmalı', { kind: 'warn' }); return; }
      }
      const cf = c.sessions.flatMap((s) => courseSessionConflicts(existing?.id || '__new', s));
      if (cf.length) {
        const ok = await confirmDialog({ title: 'Ders saatleri çakışıyor', message: `Bu ders ${[...new Set(cf.map((x) => x.course.code || x.course.name))].join(', ')} ile aynı saatlere denk geliyor. Yine de kaydedilsin mi?`, okLabel: 'Yine de kaydet' });
        if (!ok) return;
      }
      topicsEd.clean();
      const data = {
        ...c, name: name.value.trim(), code: code.value.trim(), instructor: instructor.value.trim(), color,
        absenceLimit: limitIn.value === '' ? '' : Math.max(0, Number(limitIn.value)), absenceUnit: unitSel.value,
      };
      if (existing) Object.assign(existing, data);
      else state.courses.push({ ...data, id: uid() });
      commit('courses');
      close();
      toast(existing ? 'Ders güncellendi' : 'Ders eklendi');
    },
  });
  openModal({ title: existing ? 'Dersi düzenle' : 'Ders ekle', body, actions, wide: true });
  if (focus === 'topics') requestAnimationFrame(() => topicsEd.el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}

export function absenceMeter(c, { compact = false } = {}) {
  const a = absenceInfo(c);
  if (!a.limit && !a.used) return null;
  const pct = a.limit ? Math.min(100, Math.round(a.ratio * 100)) : 0;
  const text = a.limit ? `${a.used} / ${a.limit} ${a.unit}` : `${a.used} ${a.unit}`;
  return h('div', { class: `abs ${a.level} ${compact ? 'compact' : ''}`, title: 'Devamsızlık' },
    h('span', { class: 'abs-label' }, compact ? 'Devamsızlık' : 'Devamsızlık', ' ', h('strong', {}, text)),
    a.limit ? h('span', { class: 'abs-bar', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': a.limit, 'aria-valuenow': a.used, 'aria-label': `Devamsızlık ${text}` }, h('span', { style: { width: `${pct}%` } })) : null,
    a.limit && !compact ? h('span', { class: 'abs-left' }, a.left > 0 ? `${a.left} ${a.unit} hakkın kaldı` : a.left === 0 ? 'Hakkın doldu' : `Sınırı ${-a.left} ${a.unit} aştın`) : null);
}

// Bir ders oturumuna tıklanınca: devamsızlık, iptal, ödevler, düzenle
// Birden çok ders saatli oturumda (10:30–12:20) hangi saatlere gidilmediği tek tek seçilebilir.
export function openCourseOccurrence(occ) {
  const c = state.courses.find((x) => x.id === occ.courseId);
  if (!c) return;
  const ses = c.sessions.find((x) => x.id === occ.sessionId);
  const key = `${occ.sessionId}|${occ.dateKey}`;
  const future = occ.start > new Date();
  const slots = ses ? hourSlots(ses) : [];
  const missed = () => (ses ? absentHours(c, ses, occ.dateKey) : []);
  const setMissed = (list) => setAbsentHours(c.id, occ.sessionId, occ.dateKey, list);
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const absToast = (before) => {
    const a = absenceInfo(c);
    const now = missed().length;
    const msg = now > before.length
      ? (a.limit ? (a.left > 0 ? `${courseLabel(c)}: devamsızlık ${a.used}/${a.limit} ${a.unit}, ${a.left} ${a.unit} hakkın kaldı` : `${courseLabel(c)}: devamsızlık sınırı ${a.left === 0 ? 'doldu' : 'aşıldı'} (${a.used}/${a.limit})`) : `${courseLabel(c)}: ${a.used} ${a.unit} devamsızlık`)
      : now ? `${courseLabel(c)}: ${now} saat devamsızlık` : 'Devamsızlık işareti kaldırıldı';
    toast(msg, { kind: now > before.length && a.level && a.level !== 'ok' ? 'warn' : '', ms: 5000, action: { label: 'Geri al', onClick: () => setMissed(before) } });
  };

  // Devamsızlık bölümü: not + sayaç + (çok saatli derste) saat seçici. Seçince yerinde yenilenir.
  const absWrap = h('div', { class: 'occ-abs' });
  const drawAbs = () => {
    const ms = missed();
    const full = ms.length && ms.length === slots.length;
    const showPicker = slots.length > 1 && c.absenceUnit !== 'oturum';
    absWrap.replaceChildren(...[
      full ? h('p', { class: 'absent-note' }, ic('x', { size: 15 }), ' Bu derse gitmedin olarak işaretli.')
        : ms.length ? h('p', { class: 'absent-note' }, ic('x', { size: 15 }), ` Bu dersin ${ms.length} saatine gitmedin (${ms.map((i) => `${hm(slots[i].a)}–${hm(slots[i].b)}`).join(', ')}).`) : null,
      showPicker ? h('div', { class: 'abs-hours', role: 'group', 'aria-label': 'Gitmediğin ders saatleri' },
        h('span', { class: 'abs-hours-label' }, future ? 'Gitmeyeceğin saatler' : 'Gitmediğin saatler'),
        h('div', { class: 'abs-hours-row' }, slots.map((sl) => {
          const on = ms.includes(sl.i);
          return h('button', {
            type: 'button', class: `abs-hour ${on ? 'on' : ''}`, 'aria-pressed': String(on),
            onclick: () => { const before = missed(); setMissed(on ? before.filter((i) => i !== sl.i) : [...before, sl.i]); drawAbs(); syncBtn(); absToast(before); },
          }, h('b', {}, `${sl.i + 1}. saat`), h('span', {}, `${hm(sl.a)}–${hm(sl.b)}`));
        }))) : null,
      absenceMeter(c),
    ].filter(Boolean));
  };
  drawAbs();

  const tasks = state.tasks.filter((t) => t.courseId === c.id && !t.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const body = h('div', { class: 'occ' },
    applyTexture(h('div', { class: 'occ-head', style: { '--c': c.color } }, h('strong', {}, occ.title),
      h('div', { class: 'muted' }, `${fmtDateLong(occ.start)} · ${timeStr(occ.start)}–${timeStr(occ.end)}`),
      h('div', { class: 'muted small' }, [occ.sub, occ.location, c.instructor].filter(Boolean).join(' · '))), textureKey(occ)),
    pinSection(occ),
    absWrap,
    occurrenceTopics(c, occ.start),
    h('div', { class: 'occ-tasks' },
      h('div', { class: 'occ-tasks-head' }, h('strong', {}, 'Ödevler ve teslimler'),
        h('button', { type: 'button', class: 'btn small ghost', onclick: () => { m.close(); openTaskForm(null, { courseId: c.id }); } }, '+ Ödev ekle')),
      tasks.length ? h('ul', {}, tasks.map((t) => h('li', {},
        h('button', { type: 'button', class: 'link-row', onclick: () => { m.close(); openTaskForm(t.id); } }, t.title,
          t.due ? h('span', { class: 'muted small' }, ` · ${fmtDateShort(dueDate(t))} ${t.dueTime || '23:59'} (${relativeDays(dueDate(t))})`) : null)))) : h('p', { class: 'muted small' }, 'Açık ödev yok.')));
  const absLabel = () => (missed().length ? 'Gittim (işareti kaldır)' : slots.length > 1 ? (future ? 'Hiç gitmeyeceğim' : 'Hiç gitmedim') : (future ? 'Gitmeyeceğim' : 'Gitmedim'));
  const m = openModal({
    title: 'Ders', body, actions: [
      { label: 'Bu haftaki dersi iptal et', kind: 'ghost left', onClick: (_, close) => { c.skips.push(key); commit('courses'); close(); toast('Bu oturum takvimden kaldırıldı', { action: { label: 'Geri al', onClick: () => { c.skips = c.skips.filter((k) => k !== key); commit('courses'); } } }); } },
      { label: 'Dersi düzenle', onClick: (_, close) => { close(); openCourseForm(c.id); } },
      {
        label: absLabel(), kind: missed().length ? '' : 'primary',
        onClick: (_, close) => {
          const before = missed();
          setMissed(before.length ? [] : slots.map((x) => x.i));
          close();
          absToast(before);
        },
      },
    ],
  });
  // Saat seçilince alttaki düğme de güncel kalsın
  const absBtn = m.dialog.querySelector('.modal-actions .btn:last-child');
  const syncBtn = () => { absBtn.textContent = absLabel(); absBtn.classList.toggle('primary', !missed().length); };
}

// ---------------------------------------------------------------------------
// Görev / ödev formu
// ---------------------------------------------------------------------------
export function openTaskForm(taskId, preset = {}) {
  const existing = taskId ? state.tasks.find((t) => t.id === taskId) : null;
  const dersCat = state.taskCategories.find((c) => c.id === 'ders')?.id;
  const t = existing ? { ...existing } : {
    title: '', priority: preset.courseId ? 'yuksek' : 'orta',
    categoryId: preset.courseId ? (dersCat || '') : (state.taskCategories[0]?.id || ''),
    due: '', dueTime: '', estimateMin: 60, notes: '', courseId: '', ...preset,
  };

  const title = h('input', { type: 'text', value: t.title, placeholder: 'Örn. Bankaya uğra, Ödev 3, Lab raporu', autofocus: true, maxlength: 200 });
  let pr = t.priority;
  const prRow = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Öncelik' });
  const renderPr = () => prRow.replaceChildren(...ONCELIKLER.map((p) => h('button', {
    type: 'button', class: `seg-btn ${p.id === pr ? 'on' : ''}`, style: { '--c': p.color }, role: 'radio', 'aria-checked': String(p.id === pr),
    onclick: () => { pr = p.id; renderPr(); },
  }, h('span', { class: 'dot' }), p.name)));
  renderPr();
  const course = select([['', 'Derse bağlı değil'], ...state.courses.map((c) => [c.id, [c.code, c.name].filter(Boolean).join(' · ')])], t.courseId);
  const cat = select([['', 'Kategorisiz'], ...state.taskCategories.map((c) => [c.id, c.name])], t.categoryId);
  const due = h('input', { type: 'date', value: t.due || '' });
  const dueTime = h('input', { type: 'time', value: t.dueTime || '23:59', step: 300 });
  const est = select(SURELER.map((m) => [m, durationText(m)]), t.estimateMin || 60);
  const notes = h('textarea', { rows: 3, placeholder: 'Notlar, bağlantılar…' }, t.notes || '');
  const dueLabel = h('span', { class: 'field-label' });
  const dueHint = h('span', { class: 'field-hint' });
  const dueField = h('div', { class: 'field' }, dueLabel, h('div', { class: 'dt' }, due, dueTime), dueHint);
  const syncCourse = () => {
    const isHw = !!course.value;
    dueLabel.textContent = isHw ? 'Teslim tarihi' : 'Son tarih';
    dueHint.textContent = isHw ? 'Takvimde ve ders programında görünür' : 'Boş bırakabilirsin';
    dueTime.hidden = !isHw;
    if (isHw && !existing && dersCat && cat.value !== dersCat) cat.value = dersCat;
  };
  // Tekrar: "her hafta Lab föyü" gibi. Tarihi geçince sıradaki tekrar kendiliğinden eklenir.
  const ser = existing ? seriesOf(existing) : null;
  const curRec = ser?.recur || preset.recur || null;
  const recKey = (r) => (r?.freq ? `${r.freq}${Math.max(1, Number(r.interval) || 1)}` : '');
  const TEKRAR = [['', 'Tekrarlanmaz'], ['weekly1', 'Her hafta'], ['weekly2', '2 haftada bir'], ['daily1', 'Her gün'], ['monthly1', 'Her ay']];
  if (curRec && !TEKRAR.some(([v]) => v === recKey(curRec))) TEKRAR.push([recKey(curRec), describe({ ...curRec, until: '' }, `${t.due || toDateKey(new Date())}T00:00`)]);
  const rep = select(TEKRAR, recKey(curRec));
  const until = h('input', { type: 'date', value: curRec?.until || '' });
  const repHint = h('span', { class: 'field-hint' });
  const untilField = h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Bitiş'), until, h('span', { class: 'field-hint' }, 'Boşsa süresiz'));
  const recurFromForm = () => {
    if (!rep.value) return null;
    const freq = rep.value.replace(/\d+$/, '');
    const interval = Number(rep.value.match(/\d+$/)[0]);
    // Birden çok günlü haftalık kural (hızlı eklemeden "her pazartesi ve çarşamba") korunur
    const multi = curRec && recKey(curRec) === rep.value && (curRec.byDay || []).length > 1;
    const byDay = freq !== 'weekly' ? [] : multi ? curRec.byDay.map(Number) : (due.value ? [isoWeekday(parseLocal(due.value))] : []);
    return { freq, interval, byDay, until: until.value };
  };
  const syncRep = () => {
    untilField.hidden = !rep.value;
    if (!rep.value) { repHint.textContent = ''; return; }
    repHint.textContent = due.value
      ? `${describe(recurFromForm(), `${due.value}T00:00`)}. Tarihi geçince sıradaki kendiliğinden eklenir.`
      : 'Tekrar için tarih gir: ilk tekrar o gün olur.';
  };
  rep.onchange = () => {
    if (rep.value && !until.value && course.value && state.term.end && state.term.end > (due.value || '')) until.value = state.term.end;
    syncRep();
  };
  due.addEventListener('change', syncRep); until.addEventListener('change', syncRep);
  syncRep();

  course.onchange = () => { syncCourse(); syncRep(); };
  syncCourse();

  const form = h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
    field('Görev', title),
    field('Öncelik', prRow),
    state.courses.length ? h('div', { class: 'grid-2' }, field('Ders', course), field('Kategori', cat)) : field('Kategori', cat),
    h('div', { class: 'grid-2' }, dueField, field('Tahmini süre', est)),
    h('div', { class: 'grid-2' }, h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Tekrar'), rep, repHint), untilField),
    field('Notlar', notes));

  const actions = [];
  if (existing) actions.push({
    label: 'Sil', kind: 'danger ghost left', onClick: async (_, close) => {
      if (ser) { seriesDeleteDialog(existing, ser, close); return; }
      if (await confirmDialog({ title: 'Görev silinsin mi?', message: existing.title, okLabel: 'Sil', danger: true })) { deleteTask(existing.id); close(); toast('Görev silindi'); }
    },
  });
  if (existing) actions.push({
    label: existing.done ? 'Tamamlanmadı' : 'Tamamlandı', kind: 'ghost', onClick: (_, close) => {
      existing.done = !existing.done; existing.doneAt = existing.done ? new Date().toISOString() : null; commit('tasks'); close();
      toast(existing.done ? `Tamamlandı: ${existing.title}` : 'Görev yeniden açıldı');
    },
  });
  actions.push({ label: 'Vazgeç', onClick: (_, close) => close() });
  const submit = (close) => {
    if (!title.value.trim()) { title.focus(); toast('Görev adı boş olamaz', { kind: 'warn' }); return; }
    if (course.value && !due.value) { due.focus(); toast('Ödev için teslim tarihi gir', { kind: 'warn' }); return; }
    const recur = recurFromForm();
    if (recur && !due.value) { due.focus(); toast('Tekrar için tarih gir: ilk tekrar o gün olur', { kind: 'warn' }); return; }
    if (recur?.until && recur.until < due.value) { until.focus(); toast('Tekrarın bitişi ilk tarihten önce olamaz', { kind: 'warn' }); return; }
    const data = {
      title: title.value.trim(), priority: pr, categoryId: cat.value,
      courseId: course.value, due: due.value, dueTime: course.value ? (dueTime.value || '23:59') : '',
      estimateMin: Number(est.value), notes: notes.value.trim(),
    };
    const what = course.value ? 'Ödev' : 'Görev';
    if (!existing && recur) {
      createSeries(data, recur);
      close(); toast(`Tekrarlayan ${what.toLocaleLowerCase('tr')} eklendi: ${lcFirst(describe(recur, `${data.due}T00:00`))}`, { ms: 5000 });
      return;
    }
    const tk = upsertTask({ ...(existing ? { id: existing.id } : {}), ...data });
    if (existing && ser && recur) { updateSeriesFrom(tk, recur); commit('tasks'); }
    else if (existing && ser && !recur) { endSeries(ser.id); delete tk.seriesId; commit('tasks'); toast('Tekrar kaldırıldı; bu görev yerinde kaldı'); close(); return; }
    else if (existing && !ser && recur) { createSeries(data, recur, { task: tk }); toast(`${what} artık tekrarlıyor: ${lcFirst(describe(recur, `${data.due}T00:00`))}`, { ms: 5000 }); close(); return; }
    close(); toast(existing ? `${what} güncellendi${ser ? ' (sonraki tekrarlar da)' : ''}` : `${what} eklendi`);
  };
  actions.push({ label: existing ? 'Kaydet' : 'Ekle', kind: 'primary', onClick: (_, close) => submit(close) });
  const isHw = !!t.courseId;
  const m = openModal({ title: existing ? `${ser ? 'Tekrarlayan ' : ''}${isHw ? (ser ? 'ödevi' : 'Ödevi') : (ser ? 'görevi' : 'Görevi')} düzenle` : (isHw ? 'Yeni ödev' : 'Yeni görev'), body: form, actions });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(m.close); } });
}

// Tekrarlayan bir görevi silerken: yalnız bu tekrar mı, seri mi?
function seriesDeleteDialog(t, s, closeForm) {
  openModal({
    title: 'Tekrarlayan görevi sil',
    body: h('p', {}, `"${t.title}" bir serinin parçası (${lcFirst(describe(s.recur, `${s.start}T00:00`))}).`),
    actions: [
      { label: 'Vazgeç', onClick: (_, close) => close() },
      {
        label: 'Seriyi bitir', kind: 'danger ghost', onClick: (_, close) => {
          endSeries(s.id);
          // Açık tekrarlar gider; tamamlananlar geçmiş olarak kalır
          state.tasks = state.tasks.filter((x) => !(x.seriesId === s.id && !x.done));
          commit('tasks'); close(); closeForm(); toast('Seri bitirildi');
        },
      },
      {
        label: 'Yalnız bunu sil', kind: 'danger', onClick: (_, close) => {
          deleteTask(t.id); close(); closeForm();
          const next = s.lastKey > t.due ? '' : '; sıradaki, bu tarih geçince gelir';
          toast(`Bu tekrar silindi${next}`);
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Görevi takvimde boş bir zamana yerleştir
// ---------------------------------------------------------------------------
export function openScheduleTask(taskId) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t) return;
  const dur = t.estimateMin || 60;
  let slot = findFreeSlot(dur, new Date());
  const info = h('div', { class: 'slot-info' });
  const render = () => {
    if (!slot) { info.replaceChildren(h('p', {}, 'Önümüzdeki 3 haftada bu süreye uygun boş zaman bulunamadı. Saati kendin seçebilirsin.')); return; }
    const late = t.due && slot.end > dueDate(t);
    info.replaceChildren(
      h('p', { class: 'muted' }, `${durationText(dur)} sürecek bir boşluk aranıyor (ayarlardaki ${state.settings.freeSlotStart}–${state.settings.freeSlotEnd} aralığında).`),
      h('div', { class: 'slot-big' }, h('strong', {}, fmtDateLong(slot.start)), h('span', {}, `${timeStr(slot.start)} – ${timeStr(slot.end)}`)),
      late ? h('p', { class: 'warn-text' }, `Dikkat: bu zaman ${t.courseId ? 'teslim' : 'son'} tarihinden (${fmtDateShort(dueDate(t))}) sonra.`) : '');
  };
  render();
  openModal({
    title: `Takvime yerleştir: ${t.title}`, body: info, actions: [
      { label: 'Saati kendim seçeyim', kind: 'ghost left', onClick: (_, close) => { close(); openEventForm({ title: t.title, categoryId: 'gorev', start: toLocalISO(slot ? slot.start : roundNext(new Date())), end: toLocalISO(slot ? slot.end : addMinutes(roundNext(new Date()), dur)), notes: t.notes, taskId: t.id }); } },
      { label: 'Sonraki boşluk', onClick: () => { if (slot) { slot = findFreeSlot(dur, addMinutes(slot.start, 15)); render(); } } },
      {
        label: 'Takvime ekle', kind: 'primary', onClick: (_, close) => {
          if (!slot) return;
          const ev = upsertEvent({ title: t.title, categoryId: 'gorev', start: toLocalISO(slot.start), end: toLocalISO(slot.end), notes: t.notes, taskId: t.id, reminderMin: 10, syncToGoogle: !!state.settings.googleConnected });
          t.scheduledEventId = ev.id; commit('tasks'); close();
          toast(`Görev ${fmtRange(slot.start, slot.end, false)} zamanına yerleştirildi`);
        },
      },
    ],
  });
}

export { addDays };
