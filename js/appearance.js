const STORAGE_KEY = 'gal-portfolio-appearance';
const OVERRIDE_KEY = 'gal-portfolio-appearance-override';
const APPEARANCE_TRANSITION_MS = 650;

function getAppearanceLock() {
  const lock = document.querySelector('meta[name="appearance-lock"]')?.content;
  return lock === 'light' || lock === 'dark' ? lock : null;
}

const SUN_ICON = '<svg class="appearance-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

const MOON_ICON = '<svg class="appearance-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"/></svg>';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function runAppearanceChange(update, { animate = false } = {}) {
  if (!animate || prefersReducedMotion()) {
    update();
    return;
  }

  const root = document.documentElement;

  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => {
      update();
    });
    return;
  }

  root.classList.add('appearance-animate');
  update();
  window.setTimeout(() => {
    root.classList.remove('appearance-animate');
  }, APPEARANCE_TRANSITION_MS);
}

function systemAppearance() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function clearLegacyAppearanceStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getAppearancePreference() {
  const lock = getAppearanceLock();
  if (lock) return lock;

  try {
    if (sessionStorage.getItem(OVERRIDE_KEY) !== 'true') return null;

    const stored = sessionStorage.getItem(STORAGE_KEY);
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
  document.querySelectorAll('[data-appearance-label]').forEach((node) => {
    node.textContent = appearance === 'light' ? 'Editorial' : 'Arctic';
  });
  document.dispatchEvent(new CustomEvent('appearancechange', { detail: { appearance } }));
}

export function setAppearance(mode, { animate = true } = {}) {
  if (getAppearanceLock()) return;
  if (mode !== 'light' && mode !== 'dark') return;

  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
    sessionStorage.setItem(OVERRIDE_KEY, 'true');
    clearLegacyAppearanceStorage();
  } catch {
    // ignore storage errors
  }

  runAppearanceChange(applyAppearance, { animate });
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
    btn.classList.add('is-toggling');
    setAppearance(resolveAppearance() === 'dark' ? 'light' : 'dark');
    window.setTimeout(() => {
      btn.classList.remove('is-toggling');
    }, APPEARANCE_TRANSITION_MS);
  });

  syncActiveState();
  document.addEventListener('appearancechange', syncActiveState);
  container.append(btn);
}

export function initAppearance() {
  clearLegacyAppearanceStorage();
  applyAppearance();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getAppearancePreference()) applyAppearance();
  });
}
