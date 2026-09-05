export function initHeroParallax() {
  const media = document.querySelector('.page-backdrop .hero-media');
  if (!media || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const tick = () => {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    media.style.transform = `scale(1.08) translate(${currentX * -18}px, ${currentY * -18}px)`;
    requestAnimationFrame(tick);
  };

  window.addEventListener('mousemove', (event) => {
    targetX = (event.clientX / window.innerWidth) - 0.5;
    targetY = (event.clientY / window.innerHeight) - 0.5;
  });

  window.addEventListener('blur', () => {
    targetX = 0;
    targetY = 0;
  });

  requestAnimationFrame(tick);
}

export function initRevealAnimations() {
  const items = document.querySelectorAll('[data-reveal]:not(.is-revealed)');
  if (!items.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const delay = Number(entry.target.dataset.revealDelay || 0);
      window.setTimeout(() => entry.target.classList.add('is-revealed'), delay);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '-80px 0px', threshold: 0.08 });

  items.forEach((item) => observer.observe(item));
}

export function initHeroEntrance() {
  requestAnimationFrame(() => {
    document.querySelector('.hero')?.classList.add('hero--entered');
  });
}

export function initFloatingCta() {
  const cta = document.getElementById('floating-cta');
  const trigger = cta?.querySelector('.floating-trigger');
  const links = document.getElementById('floating-links');
  if (!cta || !trigger || !links) return;

  const MENU_GAP = 8;
  const EDGE_PAD = 12;
  let ignorePointerUntil = 0;

  const isContextOpen = () => cta.classList.contains('context-open');

  const clearContextMode = () => {
    cta.classList.remove('context-open');
    links.style.removeProperty('--ctx-x');
    links.style.removeProperty('--ctx-y');
  };

  const setOpen = (open, { context = false } = {}) => {
    if (!open) clearContextMode();
    else if (!context) clearContextMode();

    cta.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    links.setAttribute('aria-hidden', String(!open));
  };

  const placeAtCursor = (clientX, clientY) => {
    ignorePointerUntil = performance.now() + 350;
    cta.classList.add('open', 'context-open');
    trigger.setAttribute('aria-expanded', 'true');
    links.setAttribute('aria-hidden', 'false');

    // First paint at cursor so we can measure, then clamp into the viewport.
    links.style.setProperty('--ctx-x', `${clientX}px`);
    links.style.setProperty('--ctx-y', `${clientY}px`);

    requestAnimationFrame(() => {
      const rect = links.getBoundingClientRect();
      let x = clientX + MENU_GAP;
      let y = clientY + MENU_GAP;

      if (x + rect.width > window.innerWidth - EDGE_PAD) {
        x = Math.max(EDGE_PAD, clientX - rect.width - MENU_GAP);
      }
      if (y + rect.height > window.innerHeight - EDGE_PAD) {
        y = Math.max(EDGE_PAD, clientY - rect.height - MENU_GAP);
      }

      links.style.setProperty('--ctx-x', `${x}px`);
      links.style.setProperty('--ctx-y', `${y}px`);
    });
  };

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (canHover) {
    cta.addEventListener('mouseenter', () => {
      if (isContextOpen()) return;
      setOpen(true);
    });
    cta.addEventListener('mouseleave', () => {
      if (isContextOpen()) return;
      setOpen(false);
    });
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (isContextOpen()) {
      setOpen(false);
      return;
    }
    setOpen(!cta.classList.contains('open'));
  });

  links.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('contextmenu', (event) => {
    if (event.shiftKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;

    event.preventDefault();
    placeAtCursor(event.clientX, event.clientY);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  document.addEventListener('pointerdown', (event) => {
    if (performance.now() < ignorePointerUntil) return;
    if (!cta.classList.contains('open')) return;
    if (cta.contains(event.target)) return;
    setOpen(false);
  });

  window.addEventListener('scroll', () => {
    if (isContextOpen()) setOpen(false);
  }, { passive: true });
}

export function initMotion() {
  initHeroParallax();
  initHeroEntrance();
  initRevealAnimations();
  initFloatingCta();
  import('./hero-canvas.js').then(({ initHeroCanvas }) => initHeroCanvas()).catch(() => {});
}
