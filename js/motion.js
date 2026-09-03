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

  const setOpen = (open) => {
    cta.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    links.setAttribute('aria-hidden', String(!open));
  };

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (canHover) {
    cta.addEventListener('mouseenter', () => setOpen(true));
    cta.addEventListener('mouseleave', () => setOpen(false));
  }

  trigger.addEventListener('click', () => setOpen(!cta.classList.contains('open')));
}

export function initMotion() {
  initHeroParallax();
  initHeroEntrance();
  initRevealAnimations();
  initFloatingCta();
  import('./hero-canvas.js').then(({ initHeroCanvas }) => initHeroCanvas()).catch(() => {});
}
