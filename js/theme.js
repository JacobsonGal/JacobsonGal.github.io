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

function getThemeLock() {
  const lock = document.querySelector('meta[name="theme-lock"]')?.content;
  return lock && THEMES[lock] ? lock : null;
}

export function getTheme() {
  const lock = getThemeLock();
  if (lock) return lock;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && THEMES[stored] ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setTheme(id) {
  if (getThemeLock()) return;
  if (!THEMES[id]) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore quota errors
  }
  applyTheme(id);
}

export function applyTheme(id) {
  document.documentElement.dataset.theme = getThemeLock() || id || getTheme();
}

applyTheme(getTheme());
