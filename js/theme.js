const STORAGE_KEY = 'gal-portfolio-theme';

export const THEMES = {
  arctic: {
    label: 'Arctic',
    description: 'Icy blues from your logo',
    swatch: ['hsl(205 68% 42%)', 'hsl(210 40% 97%)'],
  },
  editorial: {
    label: 'Editorial',
    description: 'Warm cream and rust',
    swatch: ['hsl(18 42% 46%)', 'hsl(38 24% 94%)'],
  },
};

export const DEFAULT_THEME = 'arctic';

export function getTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && THEMES[stored] ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setTheme(id) {
  if (!THEMES[id]) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore quota errors
  }
  applyTheme(id);
}

export function applyTheme(id) {
  document.documentElement.dataset.theme = id || getTheme();
}

applyTheme(getTheme());
