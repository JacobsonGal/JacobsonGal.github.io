const STORAGE_KEY = 'gal-portfolio-appearance';
const OVERRIDE_KEY = 'gal-portfolio-appearance-override';
const APPEARANCE_TRANSITION_MS = 650;

function getAppearanceLock() {
  const lock = document.querySelector('meta[name="appearance-lock"]')?.content;
  return lock === 'light' || lock === 'dark' ? lock : null;
}

const SUN_ICON = '<svg class="appearance-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18"/><path d="M5.5 18a6.5 6.5 0 0 1 13 0"/><path d="M12 10V5.5"/><path d="m8.25 12.75 1.4-1.4"/><path d="m15.75 12.75-1.4-1.4"/><path d="M12 3v1.75"/></svg>';

const MOON_ICON = '<svg class="appearance-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" fill="currentColor" fill-opacity="0.14"/><path d="M18.75 3v1.75M20.75 5h-1.75"/><path d="M5.25 6.25l.85.85M6.1 5.4l-.85.85"/><circle cx="17.25" cy="7.75" r="0.7" fill="currentColor" stroke="none"/></svg>';

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
