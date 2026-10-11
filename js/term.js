// Dönem haritası: dönemin tamamı tek şeritte — sınavlar, teslimler, tatiller, haftalık yük.
import { h } from './ui.js';
import { state, occurrencesInRange } from './store.js';
import { parseLocal, startOfWeek, addDays, daysBetween, fmtDateShort, AYLAR, timeStr } from './dates.js';
import { openOccurrence } from './forms.js';

export function renderTerm(root, { onGoCourses } = {}) {
  const { start, end, breaks } = state.term;
  if (!start || !end) {
    root.replaceChildren(h('div', { class: 'empty' },
      h('p', {}, 'Dönem haritası için önce dönemin başlangıç ve bitiş tarihlerini gir.'),
      h('button', { class: 'btn primary', onclick: () => onGoCourses?.() }, 'Ders programına git')));
    return;
  }
  const now = new Date();
  const s0 = startOfWeek(parseLocal(start));
  const termEnd = parseLocal(end);
  const W = Math.max(1, Math.ceil((daysBetween(s0, termEnd) + 1) / 7));
  const DAYS = W * 7;
  const e0 = addDays(s0, DAYS);
  const pct = (d) => `${Math.max(0, Math.min(100, (d / DAYS) * 100))}%`;
  const dayIdx = (date) => daysBetween(s0, date);
  const curWeek = Math.floor(dayIdx(now) / 7);
  const inside = now >= s0 && now < e0;

  const all = occurrencesInRange(s0, e0);
  const exams = all.filter((o) => o.kind === 'event' && o.categoryId === 'sinav');
  const deadlines = all.filter((o) => o.kind === 'deadline');

  // Haftalık yük (saat) ve içerik sayıları
  const weeks = Array.from({ length: W }, (_, i) => ({ i, start: addDays(s0, i * 7), min: 0, exams: 0, dues: 0 }));
  for (const o of all) {
    const wi = Math.floor(dayIdx(o.start) / 7);
    if (wi < 0 || wi >= W) continue;
    if (!o.allDay) weeks[wi].min += Math.max(0, (o.end - o.start) / 60000);
    if (o.kind === 'event' && o.categoryId === 'sinav') weeks[wi].exams++;
    if (o.kind === 'deadline') weeks[wi].dues++;
  }
  // Sınav ve teslimleri yük puanına ekle (her biri ~4 saat hazırlık)
  for (const w of weeks) { w.hours = Math.round(w.min / 60); w.score = w.hours + (w.exams + w.dues) * 4; }
  const sorted = weeks.map((w) => w.score).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const maxScore = Math.max(1, ...weeks.map((w) => w.score));

  // Ay etiketleri
  const months = [];
  for (let d = new Date(s0.getFullYear(), s0.getMonth(), 1); d < e0; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const idx = Math.max(0, dayIdx(d));
    months.push(h('span', { class: 'tm-month', style: { left: pct(idx) } }, AYLAR[d.getMonth()]));
  }

  const marker = (o, i, kind) => {
    const at = kind === 'deadline' ? o.due : o.start;
    const label = kind === 'deadline' ? `${o.title}` : o.title;
    return h('button', {
      class: `tm-mark ${kind} ${at < now ? 'past' : ''} ${kind === 'deadline' && o.done ? 'done' : ''}`,
      style: { left: pct(dayIdx(at) + 0.5), top: i % 2 ? '38px' : '10px' },
      title: `${label}\n${fmtDateShort(at)} ${timeStr(at)}`,
      onclick: () => openOccurrence(o),
    }, h('span', { class: 'tm-shape', 'aria-hidden': 'true' }), h('span', { class: 'tm-label' }, label, h('small', {}, ` ${fmtDateShort(at)}`)));
  };

  const breakBars = breaks.map((b) => {
    const a = dayIdx(parseLocal(b.start)), z = dayIdx(parseLocal(b.end || b.start)) + 1;
    if (z <= 0 || a >= DAYS) return null;
    return [
      h('div', { class: 'tm-break', style: { left: pct(a), width: `${((z - a) / DAYS) * 100}%` }, title: b.label }),
      h('span', { class: 'tm-break-l', style: { left: `calc(${pct(z)} + 6px)` } }, b.label),
    ];
  });

  const loadBars = weeks.map((w) => {
    const heavy = w.score >= Math.max(median * 1.4, median + 6) && w.score > 0;
    const past = w.i < curWeek;
    return h('div', { class: 'tm-load-col', title: `${w.i + 1}. hafta: ${w.hours} saat plan${w.exams ? `, ${w.exams} sınav` : ''}${w.dues ? `, ${w.dues} teslim` : ''}` },
      h('span', {}, w.hours || ''),
      h('div', { class: `tm-bar ${heavy ? 'heavy' : ''} ${past ? 'past' : ''} ${w.i === curWeek ? 'cur' : ''}`, style: { height: `${Math.round((w.score / maxScore) * 80) + 2}px` } }));
  });

  const progress = inside ? Math.round((dayIdx(now) / DAYS) * 100) : now >= e0 ? 100 : 0;
  const lanesBg = { backgroundSize: `calc(100% / ${W}) 100%` };

  // Özet kartları
  const future = weeks.filter((w) => w.i >= Math.max(0, curWeek));
  const busiest = future.slice().sort((a, b) => b.score - a.score)[0];
  const lightest = future.filter((w) => w.i > curWeek).sort((a, b) => a.score - b.score)[0];
  const nextItem = [...exams.map((o) => ({ o, at: o.start, k: 'Sınav' })), ...deadlines.filter((o) => !o.done).map((o) => ({ o, at: o.due, k: 'Teslim' }))]
    .filter((x) => x.at > now).sort((a, b) => a.at - b.at);
  const wkRange = (w) => `${fmtDateShort(w.start)} – ${fmtDateShort(addDays(w.start, 6))}`;
  const wkWhat = (w) => [w.exams ? `${w.exams} sınav` : null, w.dues ? `${w.dues} teslim` : null, `${w.hours} saat plan`].filter(Boolean).join(', ');

  root.replaceChildren(h('div', { class: 'term' },
    h('div', { class: 'term-head' },
      h('div', {}, h('span', { class: 'muted' }, `${fmtDateShort(parseLocal(start))} – ${fmtDateShort(termEnd)} · ${W} hafta`)),
      h('div', { class: 'term-prog' },
        h('strong', {}, inside ? `${curWeek + 1}. hafta · dönemin %${progress}'i geçti` : now < s0 ? 'Dönem henüz başlamadı' : 'Dönem bitti'),
        h('span', { class: 'term-prog-bar' }, h('span', { style: { width: `${progress}%` } })))),
    h('section', { class: 'card term-chart' },
      h('div', { class: 'tm-row' }, h('span', { class: 'tm-lab' }), h('div', { class: 'tm-months' }, months)),
      h('div', { class: 'tm-row' }, h('span', { class: 'tm-lab small muted' }, 'Hafta'),
        h('div', { class: 'tm-weeks', style: { gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` } },
          weeks.map((w) => h('span', { class: w.i === curWeek ? 'cur' : '' }, w.i + 1)))),
      h('div', { class: 'tm-row tm-body' },
        h('div', { class: 'tm-labs' }, h('span', { class: 'l70' }, 'Sınavlar'), h('span', { class: 'l70' }, 'Teslimler'), h('span', { class: 'l40' }, 'Tatiller'), h('span', { class: 'l110' }, 'Yük')),
        h('div', { class: 'tm-lanes', style: lanesBg },
          h('div', { class: 'tm-lane l70' }, exams.length ? exams.map((o, i) => marker(o, i, 'exam')) : h('span', { class: 'tm-empty' }, 'Sınav eklemek için planı "Sınav" kategorisinde ekle')),
          h('div', { class: 'tm-lane l70' }, deadlines.length ? deadlines.map((o, i) => marker(o, i, 'deadline')) : h('span', { class: 'tm-empty' }, 'Derse bağlı ödevler burada görünür')),
          h('div', { class: 'tm-lane l40' }, breakBars),
          h('div', { class: 'tm-lane l110 tm-load', style: { gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` } }, loadBars),
          inside ? h('div', { class: 'tm-today', style: { left: pct(dayIdx(now) + 0.5) } }, h('span', {}, 'Bugün')) : null))),
    h('div', { class: 'term-cards' },
      busiest ? h('div', { class: 'card tc' }, h('span', { class: 'tc-k red' }, 'En yoğun hafta'), h('strong', {}, wkRange(busiest)), h('span', { class: 'muted small' }, wkWhat(busiest))) : null,
      nextItem[0] ? h('button', { class: 'card tc', onclick: () => openOccurrence(nextItem[0].o) }, h('span', { class: 'tc-k teal' }, `Sıradaki ${nextItem[0].k.toLocaleLowerCase('tr')}`),
        h('strong', {}, `${nextItem[0].o.kind === 'deadline' ? nextItem[0].o.title : nextItem[0].o.title} · ${fmtDateShort(nextItem[0].at)}`),
        h('span', { class: 'muted small' }, nextItem[1] ? `Ardından ${daysBetween(nextItem[0].at, nextItem[1].at)} gün sonra ${nextItem[1].o.title}` : 'Sonrasında başka sınav ya da teslim yok')) : null,
      lightest ? h('div', { class: 'card tc' }, h('span', { class: 'tc-k' }, 'En hafif hafta'), h('strong', {}, wkRange(lightest)), h('span', { class: 'muted small' }, `${wkWhat(lightest)}; ders çalışmak ya da ertelenen işler için iyi bir aralık`)) : null)));
}
