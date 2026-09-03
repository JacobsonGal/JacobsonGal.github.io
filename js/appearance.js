const STORAGE_KEY = 'gal-portfolio-appearance';

const SUN_ICON = '<svg class="appearance-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

const MOON_ICON = '<svg class="appearance-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"/></svg>';

function systemAppearance() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getAppearancePreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore storage errors
  }
  return null;
}

export function resolveAppearance() {
  return getAppearancePreference() || systemAppearance();
}

export function applyAppearance() {
  const appearance = resolveAppearance();
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.style.colorScheme = appearance;
  document.dispatchEvent(new CustomEvent('appearancechange', { detail: { appearance } }));
}

export function setAppearance(mode) {
  if (mode !== 'light' && mode !== 'dark') return;

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }

  applyAppearance();
}

export function mountAppearanceToggle(container) {
  if (!container) return;

  container.querySelectorAll('[data-appearance-ui]').forEach((node) => node.remove());

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'appearance-toggle-btn';
  btn.dataset.appearanceUi = 'true';

  function syncActiveState() {
    const isDark = resolveAppearance() === 'dark';
    btn.innerHTML = isDark ? SUN_ICON : MOON_ICON;
    btn.setAttribute('aria-label', isDark ? 'Switch to bright mode' : 'Switch to dark mode');
    btn.setAttribute('aria-pressed', String(isDark));
    btn.title = isDark ? 'Bright mode' : 'Dark mode';
  }

  btn.addEventListener('click', () => {
    setAppearance(resolveAppearance() === 'dark' ? 'light' : 'dark');
  });

  syncActiveState();
  document.addEventListener('appearancechange', syncActiveState);
  container.append(btn);
}

export function initAppearance() {
  applyAppearance();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getAppearancePreference()) applyAppearance();
  });
}
