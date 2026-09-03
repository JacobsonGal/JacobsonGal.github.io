import { getTheme, setTheme, THEMES } from './theme.js';

export function mountThemePicker(container) {
  if (!container) return;

  container.querySelectorAll('[data-theme-ui]').forEach((node) => node.remove());

  const wrapper = document.createElement('div');
  wrapper.className = 'theme-picker';
  wrapper.dataset.themeUi = 'true';
  wrapper.dataset.authUi = 'true';

  const label = document.createElement('span');
  label.className = 'theme-picker-label mono-label';
  label.textContent = 'Palette';

  const options = document.createElement('div');
  options.className = 'theme-picker-options';
  options.setAttribute('role', 'group');
  options.setAttribute('aria-label', 'Color palette');

  const current = getTheme();

  Object.entries(THEMES).forEach(([id, theme]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `theme-swatch${id === current ? ' is-active' : ''}`;
    btn.title = `${theme.label} — ${theme.description}`;
    btn.setAttribute('aria-label', theme.label);
    btn.setAttribute('aria-pressed', String(id === current));
    btn.style.setProperty('--swatch-a', theme.swatch[0]);
    btn.style.setProperty('--swatch-b', theme.swatch[1]);
    btn.addEventListener('click', () => {
      setTheme(id);
      options.querySelectorAll('.theme-swatch').forEach((el) => {
        const active = el === btn;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-pressed', String(active));
      });
    });
    options.append(btn);
  });

  wrapper.append(label, options);
  container.append(wrapper);
}
