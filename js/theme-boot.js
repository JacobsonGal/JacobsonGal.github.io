(function bootTheme() {
  const root = document.documentElement;
  let theme = 'arctic';

  try {
    const stored = localStorage.getItem('gal-portfolio-theme');
    if (stored === 'arctic' || stored === 'editorial') theme = stored;
  } catch {
    // ignore storage errors
  }

  root.dataset.theme = theme;

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  let appearance = prefersDark ? 'dark' : 'light';

  try {
    if (sessionStorage.getItem('gal-portfolio-appearance-override') === 'true') {
      const storedAppearance = sessionStorage.getItem('gal-portfolio-appearance');
      if (storedAppearance === 'light' || storedAppearance === 'dark') {
        appearance = storedAppearance;
      }
    }

    localStorage.removeItem('gal-portfolio-appearance');
  } catch {
    // ignore storage errors
  }

  root.dataset.appearance = appearance;
  root.style.colorScheme = appearance;

  const label = document.querySelector('[data-appearance-label]');
  if (label) label.textContent = appearance === 'light' ? 'Editorial' : 'Arctic';
}());
