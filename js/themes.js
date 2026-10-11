// Kategori dokuları ve tematik kartlar.
// Her plan türü kendi dünyasının desenini taşır: halısaha biçilmiş çim, konser ekolayzır, ders kareli defter,
// Lab breadboard, sınav optik form, roket takımı gece göğü ve uçuş yayı… Desenler hem CSS maskesi
// (takvim blokları, kartlar) hem SVG deseni (kadran dilimleri) olarak aynı kaynaktan üretilir.
import { h, onColor } from './ui.js';
import { state, category } from './store.js';
import { timeStr, daysBetween, fmtDateShort, GUNLER, GUNLER_KISA, isoWeekday, addMinutes } from './dates.js';
import { ic } from './icons.js';

// ---------------------------------------------------------------------------
// Dokular: siyah şekil = desen (maske olarak kullanılır)
// ---------------------------------------------------------------------------
const K = '#000';
export const TEXTURES = {
  cim: { // biçilmiş çim şeritleri + orta saha
    name: 'Çim', w: 28, h: 28, tile: `<rect width="14" height="28" fill="${K}"/>`,
    extra: { w: 120, h: 120, svg: `<g fill="none" stroke="${K}" stroke-width="3.2"><circle cx="60" cy="60" r="34"/><path d="M60 0V120"/></g><circle cx="60" cy="60" r="4" fill="${K}"/>`, pos: 'right -44px center' },
  },
  ses: { // ekolayzır çubukları, alttan yükselir
    name: 'Ekolayzır', w: 60, h: 48, repeat: 'repeat-x', pos: 'left bottom',
    tile: `<g fill="${K}"><rect x="3" y="26" width="6" height="22" rx="1.5"/><rect x="13" y="12" width="6" height="36" rx="1.5"/><rect x="23" y="32" width="6" height="16" rx="1.5"/><rect x="33" y="6" width="6" height="42" rx="1.5"/><rect x="43" y="20" width="6" height="28" rx="1.5"/><rect x="53" y="36" width="6" height="12" rx="1.5"/></g>`,
  },
  kareli: { // kareli defter
    name: 'Kareli', w: 14, h: 14, tile: `<path d="M0 .5H14M.5 0V14" stroke="${K}" stroke-width="1"/>`,
  },
  nokta: { // noktalı kâğıt (problem saati)
    name: 'Noktalı', w: 14, h: 14, tile: `<circle cx="7" cy="7" r="1.4" fill="${K}"/>`,
  },
  breadboard: { // breadboard delikleri + jumper
    name: 'Breadboard', w: 12, h: 12, tile: `<rect x="4.5" y="4.5" width="3" height="3" rx=".8" fill="${K}"/>`,
    extra: { w: 90, h: 46, svg: `<path d="M6 30H38V12H84" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="30" r="3.5" fill="${K}"/><circle cx="84" cy="12" r="3.5" fill="${K}"/>`, pos: 'right 6px bottom 6px' },
  },
  optik: { // optik form baloncukları
    name: 'Optik form', w: 18, h: 18, tile: `<circle cx="9" cy="9" r="5.2" fill="none" stroke="${K}" stroke-width="1.4"/>`,
  },
  yorunge: { // yıldızlar + uçuş yayı
    name: 'Gece göğü', w: 64, h: 64, tile: `<g fill="${K}"><circle cx="8" cy="10" r="1.2"/><circle cx="40" cy="6" r=".9"/><circle cx="54" cy="30" r="1.4"/><circle cx="22" cy="40" r="1"/><circle cx="46" cy="56" r="1.1"/><circle cx="6" cy="58" r=".8"/></g>`,
    extra: { w: 160, h: 110, svg: `<path d="M4 108 Q70 -20 156 84" fill="none" stroke="${K}" stroke-width="2.4" stroke-dasharray="4 6" stroke-linecap="round"/><circle cx="74" cy="44" r="5" fill="${K}"/>`, pos: 'right -10px bottom -6px' },
  },
  kahve: { // fincan halkası lekeleri
    name: 'Kahve', w: 74, h: 74, tile: `<g fill="none" stroke="${K}" stroke-width="2.4" stroke-linecap="round"><path d="M38 20a16 16 0 1 1-14 6"/><path d="M14 58a8 8 0 1 1 6 4" stroke-width="1.6"/></g>`,
  },
  milimetrik: { // milimetrik kâğıt
    name: 'Milimetrik', w: 20, h: 20, tile: `<path d="M0 5H20M0 10H20M0 15H20M5 0V20M10 0V20M15 0V20" stroke="${K}" stroke-width=".5"/><path d="M0 .6H20M.6 0V20" stroke="${K}" stroke-width="1.2"/>`,
  },
  film: { // film şeridi delikleri
    name: 'Film şeridi', w: 16, h: 10, repeat: 'repeat-x', pos: 'left top', tile: `<rect x="4" y="2.5" width="8" height="5" rx="1.2" fill="${K}"/>`,
    extra: { w: 16, h: 10, svg: `<rect x="4" y="2.5" width="8" height="5" rx="1.2" fill="${K}"/>`, pos: 'left bottom', repeat: 'repeat-x' },
  },
  piksel: { // piksel
    name: 'Piksel', w: 16, h: 16, tile: `<g fill="${K}"><rect width="4" height="4"/><rect x="8" y="8" width="4" height="4"/><rect x="12" y="0" width="4" height="4"/></g>`,
  },
  kod: { // kod satırları
    name: 'Kod', w: 64, h: 12, tile: `<g fill="${K}"><rect x="0" y="4" width="14" height="3" rx="1.5"/><rect x="18" y="4" width="22" height="3" rx="1.5"/><rect x="44" y="4" width="8" height="3" rx="1.5"/></g>`,
  },
  dalga: { // spor: nabız çizgisi
    name: 'Nabız', w: 80, h: 30, tile: `<path d="M0 18H26l4-10 6 20 5-14 3 4H80" fill="none" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>`,
  },
  harita: { // yolculuk: uçuş rotası
    name: 'Rota', w: 40, h: 40, tile: `<path d="M2 30c10-4 14-14 24-14s10-8 12-12" fill="none" stroke="${K}" stroke-width="1.6" stroke-dasharray="3 4" stroke-linecap="round"/>`,
  },
};

// Kategori ikonuna göre doku (kullanıcının eklediği kategoriler de ikonuna göre doku alır)
const BY_ICON = {
  ball: 'cim', music: 'ses', exam: 'optik', rocket: 'yorunge', cup: 'kahve', check: 'milimetrik', book: 'kareli', cap: 'kareli',
  chip: 'breadboard', code: 'kod', film: 'film', game: 'piksel', dumbbell: 'dalga', plane: 'harita', people: 'kahve',
};
export function textureKey(o) {
  if (!o) return null;
  if (o.kind === 'course') return ['Lab', 'Uygulama'].includes(o.sub) ? 'breadboard' : o.sub === 'PS' ? 'nokta' : 'kareli';
  if (o.kind === 'deadline') return 'kareli';
  return BY_ICON[category(o.categoryId)?.icon] || null;
}
export const textureForIcon = (icon) => BY_ICON[icon] || null;

const svgUrl = (w, hh, inner) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${hh}' viewBox='0 0 ${w} ${hh}'>${inner}</svg>`)}")`;

// Desenleri CSS kuralı olarak bir kez ekle: .tx[data-tx="cim"]::before { mask-image: … }
let injected = false;
export function injectTextureCSS() {
  if (injected) return;
  injected = true;
  const rules = Object.entries(TEXTURES).map(([k, t]) => {
    const imgs = [svgUrl(t.w, t.h, t.tile)];
    const sizes = [`${t.w}px ${t.h}px`];
    const reps = [t.repeat || 'repeat'];
    const poss = [t.pos || '0 0'];
    if (t.extra) {
      imgs.push(svgUrl(t.extra.w, t.extra.h, t.extra.svg));
      sizes.push(`${t.extra.w}px ${t.extra.h}px`);
      reps.push(t.extra.repeat || 'no-repeat');
      poss.push(t.extra.pos || 'right center');
    }
    const body = `mask-image:${imgs.join(',')};mask-size:${sizes.join(',')};mask-repeat:${reps.join(',')};mask-position:${poss.join(',')};`
      + `-webkit-mask-image:${imgs.join(',')};-webkit-mask-size:${sizes.join(',')};-webkit-mask-repeat:${reps.join(',')};-webkit-mask-position:${poss.join(',')};`;
    return `.tx[data-tx="${k}"]::before{${body}}`;
  }).join('\n');
  document.head.append(h('style', { id: 'tx-css' }, rules));
}

// Bir öğeye doku ver
export function applyTexture(el, key) {
  if (!key || !TEXTURES[key]) return el;
  el.classList.add('tx');
  el.dataset.tx = key;
  return el;
}

// SVG kadranı için desen (aynı kaynaktan): <pattern id="tx-cim-w">…
export function svgPattern(defs, key, tone, uid) {
  const t = TEXTURES[key];
  if (!t) return null;
  const id = `tx-${uid}-${key}-${tone}`;
  if (defs.querySelector(`#${id}`)) return id;
  const color = tone === 'w' ? '#fff' : '#1A1F36';
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
  p.setAttribute('id', id);
  p.setAttribute('patternUnits', 'userSpaceOnUse');
  p.setAttribute('width', t.w); p.setAttribute('height', t.h);
  p.innerHTML = t.tile.replaceAll(K, color);
  defs.append(p);
  return id;
}

// ---------------------------------------------------------------------------
// Tematik kartlar (Bugün geri sayımı ve plan penceresinin başlığı)
// ---------------------------------------------------------------------------
export function cardVariant(o) {
  if (o.kind === 'deadline') return 'odev';
  if (o.kind === 'course') return 'ders';
  const icon = category(o.categoryId)?.icon;
  if (o.categoryId === 'sinav' || icon === 'exam') return 'optik';
  if (icon === 'ball') return 'skorbord';
  if (icon === 'music') return 'bilet';
  if (icon === 'rocket') return 'tminus';
  return 'duz';
}

const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
const led = (n, label) => h('span', { class: 'led-cell' }, h('span', { class: 'led' }, pad(n)), h('i', {}, label));
const when = (at, now) => {
  const n = daysBetween(now, at);
  const d = n === 0 ? 'bugün' : n === 1 ? 'yarın' : `${GUNLER_KISA[isoWeekday(at) - 1]} ${fmtDateShort(at)}`;
  return `${d} ${timeStr(at)}`;
};
function left(at, now) {
  const ms = Math.max(0, at - now);
  return { d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000), m: Math.floor((ms % 3600000) / 60000), days: daysBetween(now, at) };
}

export function themedCard(o, now = new Date(), { banner = false, onClick } = {}) {
  const v = cardVariant(o);
  const at = o.kind === 'deadline' ? o.due : o.start;
  const L = left(at, now);
  const live = o.kind !== 'deadline' && o.start <= now && now < o.end;
  const course = o.kind === 'deadline' ? state.courses.find((c) => c.id === o.ref.courseId) : null;
  const color = o.kind === 'deadline' ? (course?.color || o.color) : o.color;
  const title = o.kind === 'deadline' ? o.ref.title : o.title;
  const base = (cls, ...kids) => h(onClick ? 'button' : 'div', {
    type: onClick ? 'button' : null, class: `tcard ${cls} ${banner ? 'banner' : ''}`, style: { '--c': color }, onclick: onClick || null,
    'aria-label': `${title}, ${when(at, now)}`,
  }, ...kids);

  if (v === 'skorbord') {
    const el = base('tc-skor',
      h('span', { class: 'tc-k' }, ic('ball', { size: 14 }), live ? ' Maç sürüyor' : ' Maça kalan'),
      h('div', { class: 'led-row', 'aria-hidden': 'true' },
        live ? led(Math.floor((o.end - now) / 60000), 'dk kaldı')
          : [led(L.d, 'gün'), h('span', { class: 'led-sep' }, ':'), led(L.h, 'saat'), h('span', { class: 'led-sep' }, ':'), led(L.m, 'dk')]),
      h('span', { class: 'tc-t' }, title),
      h('span', { class: 'tc-s' }, [when(at, now), o.location].filter(Boolean).join(' · ')));
    return applyTexture(el, 'cim');
  }
  if (v === 'bilet') {
    const el = base('tc-bilet',
      h('div', { class: 'tb-main' },
        h('span', { class: 'tc-k' }, ic('music', { size: 14 }), ' Bilet'),
        h('span', { class: 'tc-n' }, L.days <= 0 ? (live ? 'Şimdi' : 'Bugün') : L.days),
        L.days > 0 ? h('span', { class: 'tc-u' }, 'gün kaldı') : null,
        h('span', { class: 'tc-t' }, title),
        h('span', { class: 'tc-s' }, [o.location, `${GUNLER[isoWeekday(at) - 1]} ${fmtDateShort(at)}`].filter(Boolean).join(' · '))),
      h('div', { class: 'tb-stub', 'aria-hidden': 'true' },
        h('span', {}, 'Kapı', h('b', {}, timeStr(addMinutes(at, -30)))),
        h('span', {}, 'Başlar', h('b', {}, timeStr(at))),
        h('i', { class: 'tb-code' })));
    return applyTexture(el, 'ses');
  }
  if (v === 'optik') {
    const n = Math.max(0, L.days);
    const COLS = 10, total = n > 30 ? 30 : Math.max(10, Math.ceil(n / COLS) * COLS);
    const bubbles = h('div', { class: 'opt-grid', 'aria-hidden': 'true' }, Array.from({ length: total }, (_, i) => h('i', { class: i < Math.min(n, 30) ? 'on' : '' })));
    return base('tc-optik',
      h('div', { class: 'opt-head' }, h('span', { class: 'tc-k' }, ic('exam', { size: 14 }), ' Sınav'), h('span', { class: 'opt-abc', 'aria-hidden': 'true' }, 'A B C D E')),
      h('div', { class: 'opt-num' }, h('span', { class: 'tc-n' }, n <= 0 ? (live ? 'Şimdi' : 'Bugün') : n), n > 0 ? h('span', { class: 'tc-u' }, n > 30 ? 'gün · 30 baloncuktan fazla' : 'gün · her gün bir baloncuk boşalır') : null),
      n > 0 ? bubbles : null,
      h('span', { class: 'tc-t' }, title),
      h('span', { class: 'tc-s' }, [when(at, now), o.location].filter(Boolean).join(' · ')));
  }
  if (v === 'tminus') {
    const el = base('tc-tminus',
      h('span', { class: 'tc-k' }, ic('rocket', { size: 14 }), live ? ' Uçuşta' : ' Geri sayım'),
      h('span', { class: 'tm-clock' }, live ? `T+${pad(Math.floor((now - o.start) / 60000))} dk` : `T−${L.d ? `${L.d}g ` : ''}${pad(L.h)}:${pad(L.m)}`),
      h('span', { class: 'tc-t' }, title),
      h('span', { class: 'tc-s' }, [when(at, now), o.location].filter(Boolean).join(' · ')));
    return applyTexture(el, 'yorunge');
  }
  if (v === 'odev') {
    const n = L.days;
    const [num, unit] = n <= 0 ? [Math.max(1, Math.round((at - now) / 3600000)), 'saat kaldı'] : [n, n === 1 ? 'gün · yarın' : 'gün kaldı'];
    const el = base('tc-odev',
      h('span', { class: 'od-tab' }, ic('book', { size: 13 }), ` ${course?.code || course?.name || 'Ödev'}`),
      h('span', { class: 'tc-n' }, num), h('span', { class: 'tc-u' }, unit),
      h('span', { class: 'tc-t' }, title),
      h('span', { class: 'tc-s' }, `Teslim ${when(at, now)}`));
    return applyTexture(el, 'kareli');
  }
  // Düz: kategorinin rengi ve dokusu
  const el = base('tc-duz',
    h('span', { class: 'tc-k' }, ic(category(o.categoryId)?.icon || 'star', { size: 14 }), ` ${category(o.categoryId)?.name || ''}`),
    h('span', { class: 'tc-n' }, live ? 'Şimdi' : L.days <= 0 ? timeStr(at) : L.days),
    !live && L.days > 0 ? h('span', { class: 'tc-u' }, 'gün kaldı') : null,
    h('span', { class: 'tc-t' }, title),
    h('span', { class: 'tc-s' }, [when(at, now), o.location].filter(Boolean).join(' · ')));
  return applyTexture(el, textureKey(o));
}

export { onColor };
