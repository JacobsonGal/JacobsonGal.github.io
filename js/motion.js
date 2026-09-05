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

let floatingCtaCleanup = null;

function eventElement(target) {
  if (target instanceof Element) return target;
  return target?.parentElement ?? null;
}

function clearContextStyles(links) {
  if (!links) return;
  ['--ctx-x', '--ctx-y', 'position', 'top', 'left', 'right', 'bottom', 'z-index', 'opacity', 'transform', 'pointer-events', 'align-items']
    .forEach((prop) => links.style.removeProperty(prop));
}

/**
 * Social actions menu: logo hover/click + right-click at the cursor.
 * Positions with inline styles so a stale CSS cache still shows the menu,
 * and rebinds cleanly across SPA remounts.
 */
export function initFloatingCta() {
  floatingCtaCleanup?.();

  const cta = document.getElementById('floating-cta');
  const trigger = cta?.querySelector('.floating-trigger');
  const links = document.getElementById('floating-links');
  if (!cta || !trigger || !links) {
    floatingCtaCleanup = null;
    return;
  }

  const MENU_GAP = 8;
  const EDGE_PAD = 12;
  let ignorePointerUntil = 0;

  const isContextOpen = () => cta.classList.contains('context-open');

  const clearContextMode = () => {
    cta.classList.remove('context-open');
    cta.style.removeProperty('z-index');
    clearContextStyles(links);
  };

  const setOpen = (open, { context = false } = {}) => {
    if (!open || !context) clearContextMode();

    cta.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    links.setAttribute('aria-hidden', String(!open));
  };

  const placeAtCursor = (clientX, clientY) => {
    if (!links.children.length) return false;

    ignorePointerUntil = performance.now() + 500;
    cta.classList.add('open', 'context-open');
    cta.style.zIndex = '200';
    trigger.setAttribute('aria-expanded', 'true');
    links.setAttribute('aria-hidden', 'false');

    // Inline styles beat stale cached CSS that lacks .context-open rules.
    links.style.position = 'fixed';
    links.style.right = 'auto';
    links.style.bottom = 'auto';
    links.style.zIndex = '200';
    links.style.opacity = '1';
    links.style.transform = 'none';
    links.style.pointerEvents = 'auto';
    links.style.alignItems = 'stretch';
    links.style.left = `${clientX}px`;
    links.style.top = `${clientY}px`;
    links.style.setProperty('--ctx-x', `${clientX}px`);
    links.style.setProperty('--ctx-y', `${clientY}px`);

    requestAnimationFrame(() => {
      if (!links.isConnected || !isContextOpen()) return;
      const rect = links.getBoundingClientRect();
      let x = clientX + MENU_GAP;
      let y = clientY + MENU_GAP;

      if (x + rect.width > window.innerWidth - EDGE_PAD) {
        x = Math.max(EDGE_PAD, clientX - rect.width - MENU_GAP);
      }
      if (y + rect.height > window.innerHeight - EDGE_PAD) {
        y = Math.max(EDGE_PAD, clientY - rect.height - MENU_GAP);
      }

      links.style.left = `${x}px`;
      links.style.top = `${y}px`;
      links.style.setProperty('--ctx-x', `${x}px`);
      links.style.setProperty('--ctx-y', `${y}px`);
    });

    return true;
  };

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const onMouseEnter = () => {
    if (isContextOpen()) return;
    setOpen(true);
  };
  const onMouseLeave = () => {
    if (isContextOpen()) return;
    setOpen(false);
  };

  if (canHover) {
    cta.addEventListener('mouseenter', onMouseEnter);
    cta.addEventListener('mouseleave', onMouseLeave);
  }

  const onTriggerClick = (event) => {
    event.stopPropagation();
    if (isContextOpen()) {
      setOpen(false);
      return;
    }
    setOpen(!cta.classList.contains('open'));
  };
  trigger.addEventListener('click', onTriggerClick);

  const onLinksClick = (event) => {
    if (eventElement(event.target)?.closest('a')) setOpen(false);
  };
  links.addEventListener('click', onLinksClick);

  const onContextMenu = (event) => {
    if (event.shiftKey) return;
    const el = eventElement(event.target);
    if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!links.children.length) return;

    event.preventDefault();
    placeAtCursor(event.clientX, event.clientY);
  };
  // Capture so SPA routers / nested handlers cannot swallow the gesture.
  document.addEventListener('contextmenu', onContextMenu, true);

  const onKeydown = (event) => {
    if (event.key === 'Escape') setOpen(false);
  };
  document.addEventListener('keydown', onKeydown);

  const onPointerDown = (event) => {
    // Right-button sequence must not dismiss the menu we just opened.
    if (event.button === 2) return;
    if (performance.now() < ignorePointerUntil) return;
    if (!cta.classList.contains('open')) return;
    if (cta.contains(event.target)) return;
    setOpen(false);
  };
  document.addEventListener('pointerdown', onPointerDown, true);

  const onScroll = () => {
    if (isContextOpen()) setOpen(false);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  floatingCtaCleanup = () => {
    if (canHover) {
      cta.removeEventListener('mouseenter', onMouseEnter);
      cta.removeEventListener('mouseleave', onMouseLeave);
    }
    trigger.removeEventListener('click', onTriggerClick);
    links.removeEventListener('click', onLinksClick);
    document.removeEventListener('contextmenu', onContextMenu, true);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('scroll', onScroll);
    clearContextMode();
    floatingCtaCleanup = null;
  };
}

export function destroyFloatingCta() {
  floatingCtaCleanup?.();
}

export function initMotion() {
  initHeroParallax();
  initHeroEntrance();
  initRevealAnimations();
  initFloatingCta();
  import('./hero-canvas.js').then(({ initHeroCanvas }) => initHeroCanvas()).catch(() => {});
}

export function destroyMotion() {
  destroyFloatingCta();
}
