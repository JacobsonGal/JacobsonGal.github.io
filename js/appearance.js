function resolveAppearance() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyAppearance() {
  const appearance = resolveAppearance();
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.style.colorScheme = appearance;
}

export function initAppearance() {
  applyAppearance();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAppearance);
}
