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

  let appearance = null;
  try {
    const storedAppearance = localStorage.getItem('gal-portfolio-appearance');
    if (storedAppearance === 'light' || storedAppearance === 'dark') appearance = storedAppearance;
  } catch {
    // ignore storage errors
  }

  if (!appearance) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    appearance = prefersDark ? 'dark' : 'light';
  }

  root.dataset.appearance = appearance;
  root.style.colorScheme = appearance;
}());
