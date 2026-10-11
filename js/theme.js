// Renk temaları (Kadran): her temanın bir "kadran rengi" (büyük renk blokları) ve bağlantı/odak rengi var.
// Yüzeyler, metin ve çizgiler style.css'te.
import { onColor } from './ui.js';

export const PALETTES = {
  firuze: {
    name: 'Firuze',
    light: { hero: '#0E8C8A', primary: '#0B7472' },
    dark: { hero: '#0C7D7A', primary: '#4FC9C5' },
  },
  mercan: {
    name: 'Mercan',
    light: { hero: '#E8553A', primary: '#C43F26' },
    dark: { hero: '#E8553A', primary: '#F58A72' },
  },
  kobalt: {
    name: 'Kobalt',
    light: { hero: '#2B47B9', primary: '#2B47B9' },
    dark: { hero: '#3D5AD0', primary: '#8DA2F2' },
  },
  safran: {
    name: 'Safran',
    light: { hero: '#F2B33D', primary: '#9A6A08' },
    dark: { hero: '#F2B33D', primary: '#F5C766' },
  },
  murdum: {
    name: 'Mürdüm',
    light: { hero: '#7A4C8F', primary: '#6C3F80' },
    dark: { hero: '#8E5CA6', primary: '#C79BDB' },
  },
  murekkep: {
    name: 'Mürekkep',
    light: { hero: '#1A1F36', primary: '#2B47B9' },
    dark: { hero: '#2A3160', primary: '#8DA2F2' },
  },
};

// Eski tema adları → yenileri
export const PALETTE_ALIAS = { lale: 'mercan', zumrut: 'firuze', gece: 'murekkep' };

const dark = (settings) => settings.theme === 'dark'
  || (settings.theme !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

export function applyTheme(settings) {
  const root = document.documentElement;
  if (settings.theme === 'auto' || !settings.theme) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);
  const pal = PALETTES[PALETTE_ALIAS[settings.palette] || settings.palette] || PALETTES.firuze;
  const isDark = dark(settings);
  const v = { ...(isDark ? pal.dark : pal.light) };
  if (settings.accent) { v.hero = settings.accent; v.primary = settings.accent; }
  root.style.setProperty('--hero', v.hero);
  root.style.setProperty('--on-hero', onColor(v.hero));
  root.style.setProperty('--primary', v.primary);
  root.style.setProperty('--today', `color-mix(in srgb, ${v.hero} ${isDark ? 12 : 8}%, transparent)`);
  root.dataset.pattern = settings.pattern || 'soft';
}

// Sistem açık/koyu değiştirince yeniden uygula
export function watchSystemTheme(getSettings) {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(getSettings()));
}
