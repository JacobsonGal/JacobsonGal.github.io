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

/**
 * Two separate menus:
 * 1) #floating-cta / #floating-links — bottom-right hover/click social CTA
 * 2) #context-menu — right-click menu (social + Admin + appearance)
 *
 * Separate DOM nodes so dismissing right-click never flashes the corner CTA.
 */
export function initFloatingCta() {
  floatingCtaCleanup?.();

  const cta = document.getElementById('floating-cta');
  const trigger = cta?.querySelector('.floating-trigger');
  const links = document.getElementById('floating-links');
  const contextMenu = document.getElementById('context-menu');
  if (!cta || !trigger || !links) {
    floatingCtaCleanup = null;
    return;
  }

  const MENU_GAP = 8;
  const EDGE_PAD = 12;
  let ignoreHoverUntil = 0;

  const isContextOpen = () => Boolean(contextMenu && !contextMenu.hidden);

  const setHoverOpen = (open) => {
    if (open) {
      cta.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      links.setAttribute('aria-hidden', 'false');
      return;
    }
    cta.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    links.setAttribute('aria-hidden', 'true');
  };

  const closeContextMenu = () => {
    if (!contextMenu || contextMenu.hidden) return;
    contextMenu.hidden = true;
    contextMenu.setAttribute('aria-hidden', 'true');
    contextMenu.classList.remove('open');
    contextMenu.style.removeProperty('left');
    contextMenu.style.removeProperty('top');
    // Avoid instantly reopening the corner CTA if the pointer is still over it.
    ignoreHoverUntil = performance.now() + 400;
  };

  const openContextMenu = (clientX, clientY) => {
    if (!contextMenu || !contextMenu.children.length) return false;

    setHoverOpen(false);
    ignoreHoverUntil = performance.now() + 500;

    contextMenu.hidden = false;
    contextMenu.setAttribute('aria-hidden', 'false');
    contextMenu.classList.add('open');
    contextMenu.style.left = `${clientX}px`;
    contextMenu.style.top = `${clientY}px`;

    requestAnimationFrame(() => {
      if (!contextMenu.isConnected || contextMenu.hidden) return;
      const rect = contextMenu.getBoundingClientRect();
      let x = clientX + MENU_GAP;
      let y = clientY + MENU_GAP;

      if (x + rect.width > window.innerWidth - EDGE_PAD) {
        x = Math.max(EDGE_PAD, clientX - rect.width - MENU_GAP);
      }
      if (y + rect.height > window.innerHeight - EDGE_PAD) {
        y = Math.max(EDGE_PAD, clientY - rect.height - MENU_GAP);
      }

      contextMenu.style.left = `${x}px`;
      contextMenu.style.top = `${y}px`;
    });

    return true;
  };

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const onMouseEnter = () => {
    if (isContextOpen()) return;
    if (performance.now() < ignoreHoverUntil) return;
    setHoverOpen(true);
  };
  const onMouseLeave = () => {
    if (isContextOpen()) return;
    setHoverOpen(false);
  };

  if (canHover) {
    cta.addEventListener('mouseenter', onMouseEnter);
    cta.addEventListener('mouseleave', onMouseLeave);
  }

  const onTriggerClick = (event) => {
    event.stopPropagation();
    if (isContextOpen()) {
      closeContextMenu();
      return;
    }
    setHoverOpen(!cta.classList.contains('open'));
  };
  trigger.addEventListener('click', onTriggerClick);

  const onLinksClick = (event) => {
    const el = eventElement(event.target);
    if (!el?.closest('a')) return;
    setHoverOpen(false);
  };
  links.addEventListener('click', onLinksClick);

  const onContextMenuClick = (event) => {
    const el = eventElement(event.target);
    if (!el?.closest('a')) return;
    if (el.closest('[data-floating-appearance]')) return;
    closeContextMenu();
  };
  contextMenu?.addEventListener('click', onContextMenuClick);

  const onContextMenu = (event) => {
    if (event.shiftKey) return;
    const el = eventElement(event.target);
    if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!contextMenu?.children.length) return;

    event.preventDefault();
    openContextMenu(event.clientX, event.clientY);
  };
  document.addEventListener('contextmenu', onContextMenu, true);

  const onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    closeContextMenu();
    setHoverOpen(false);
  };
  document.addEventListener('keydown', onKeydown);

  const onPointerDown = (event) => {
    if (event.button === 2) return;

    if (isContextOpen()) {
      if (contextMenu.contains(event.target)) return;
      closeContextMenu();
      return;
    }

    if (performance.now() < ignoreHoverUntil) return;
    if (!cta.classList.contains('open')) return;
    if (cta.contains(event.target)) return;
    setHoverOpen(false);
  };
  document.addEventListener('pointerdown', onPointerDown, true);

  const onScroll = () => {
    closeContextMenu();
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  floatingCtaCleanup = () => {
    if (canHover) {
      cta.removeEventListener('mouseenter', onMouseEnter);
      cta.removeEventListener('mouseleave', onMouseLeave);
    }
    trigger.removeEventListener('click', onTriggerClick);
    links.removeEventListener('click', onLinksClick);
    contextMenu?.removeEventListener('click', onContextMenuClick);
    document.removeEventListener('contextmenu', onContextMenu, true);
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('scroll', onScroll);
    closeContextMenu();
    setHoverOpen(false);
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
