// Vazifedar ikon seti: 24×24 çizgi ikonlar (currentColor), çini yıldızıyla aynı çizgi dili.
const P = {
  exam: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6M9.5 8.5h2"/>',
  music: '<path d="M9 17.5V5.8l10-2.3v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8l3.3 2.4-1.3 3.9h-4l-1.3-3.9z"/><path d="M12 3.5V8M15.3 10.4l4.3-1.4M14 14.3l2.7 3.6M10 14.3l-2.7 3.6M8.7 10.4 4.4 9"/>',
  cup: '<path d="M5 9.5h11V14a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.3a2.5 2.5 0 0 1 0 5H16M8.5 3.5v3M11.5 3.5v3"/>',
  rocket: '<path d="M12 2.8c3 2.1 4.4 5.3 4.4 9.4l-1.9 4.3h-5l-1.9-4.3c0-4.1 1.4-7.3 4.4-9.4z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M7.6 12.6 4.8 15.8v2.7l3-1.2M16.4 12.6l2.8 3.2v2.7l-3-1.2M10.5 19.5l1.5 2 1.5-2"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 12.3l2.8 2.8 5.2-5.6"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  star: '<rect x="6.5" y="6.5" width="11" height="11"/><rect x="6.5" y="6.5" width="11" height="11" transform="rotate(45 12 12)"/><circle cx="12" cy="12" r="1.6"/>',
  book: '<path d="M4 5.6c2.7-1.4 5.3-1.4 8 0v14c-2.7-1.4-5.3-1.4-8 0zM12 5.6c2.7-1.4 5.3-1.4 8 0v14c-2.7-1.4-5.3-1.4-8 0z"/>',
  cap: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5M21.5 9v5.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  calendarPlus: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5"/>',
  repeat: '<path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19l-3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5l3 3"/>',
  alert: '<path d="M12 3.8 21.2 19.5H2.8z"/><path d="M12 10v4.2M12 16.8v.2"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17"/>',
  bag: '<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  film: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  dumbbell: '<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/>',
  plane: '<path d="M10.5 13.5 3.5 11l1.5-1.5 7 1 4.5-5c1-1 2.6-1.4 3.3-.7s.3 2.3-.7 3.3l-5 4.5 1 7-1.5 1.5-2.5-7-3.5 3.5v2.5L6 22l-1-3.5L1.5 17.5 3 16h2.5z"/>',
  game: '<path d="M7 8.5h10a4 4 0 0 1 4 4.3l-.4 3.4a2.4 2.4 0 0 1-4.3 1.2l-1.7-2.2H9.4l-1.7 2.2a2.4 2.4 0 0 1-4.3-1.2L3 12.8a4 4 0 0 1 4-4.3z"/><path d="M8 11v3M6.5 12.5h3M15.5 11.5v.1M17 13.3v.1"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c2.8-.4 5 1.7 5 4.8"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
};

// Kullanıcının kategori için seçebileceği ikonlar
export const ICON_CHOICES = ['exam', 'music', 'ball', 'cup', 'rocket', 'check', 'pin', 'star', 'book', 'cap', 'chip', 'code',
  'briefcase', 'bag', 'heart', 'film', 'dumbbell', 'plane', 'game', 'people', 'bell', 'clock'];

export const ICON_NAMES = {
  exam: 'Sınav kâğıdı', music: 'Nota', ball: 'Top', cup: 'Fincan', rocket: 'Roket', check: 'Onay', pin: 'Konum', star: 'Çini yıldızı',
  book: 'Kitap', cap: 'Kep', chip: 'Devre', code: 'Kod', briefcase: 'Çanta', bag: 'Alışveriş', heart: 'Kalp', film: 'Film',
  dumbbell: 'Spor', plane: 'Uçak', game: 'Oyun', people: 'Arkadaşlar', bell: 'Zil', clock: 'Saat',
};

// Eski emoji simgelerini ikon adlarına çevir
const EMOJI = { '📝': 'exam', '🎵': 'music', '⚽': 'ball', '☕': 'cup', '🚀': 'rocket', '✅': 'check', '📌': 'pin', '⭐': 'star', '📚': 'book', '🎓': 'cap' };
export function iconKey(v) {
  if (P[v]) return v;
  return EMOJI[v] || 'star';
}

const NS = 'http://www.w3.org/2000/svg';
export function ic(name, { size = 16, cls = '', label = '' } = {}) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('class', `ic ${cls}`.trim());
  if (label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } else s.setAttribute('aria-hidden', 'true');
  s.innerHTML = P[iconKey(name)];
  return s;
}
