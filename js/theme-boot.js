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
  root.dataset.appearance = prefersDark ? 'dark' : 'light';
  root.style.colorScheme = prefersDark ? 'dark' : 'light';
}());
