const STORAGE_KEY = 'gal-portfolio-appearance';

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

  const wrapper = document.createElement('div');
  wrapper.className = 'appearance-toggle';
  wrapper.dataset.appearanceUi = 'true';

  const label = document.createElement('span');
  label.className = 'appearance-toggle-label mono-label';
  label.textContent = 'Mode';

  const options = document.createElement('div');
  options.className = 'appearance-toggle-options';
  options.setAttribute('role', 'group');
  options.setAttribute('aria-label', 'Color mode');

  const modes = [
    { id: 'light', label: 'Bright' },
    { id: 'dark', label: 'Dark' },
  ];

  const buttons = modes.map(({ id, label: text }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'appearance-toggle-btn';
    btn.dataset.mode = id;
    btn.textContent = text;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => setAppearance(id));
    return btn;
  });

  function syncActiveState() {
    const current = resolveAppearance();
    buttons.forEach((btn) => {
      const active = btn.dataset.mode === current;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  syncActiveState();
  document.addEventListener('appearancechange', syncActiveState);

  options.append(...buttons);
  wrapper.append(label, options);
  container.append(wrapper);
}

export function initAppearance() {
  applyAppearance();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getAppearancePreference()) applyAppearance();
  });
}
