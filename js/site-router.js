const PAGE_CACHE = new Map();
let activePage = null;
let navigating = false;

function normalizePage(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path.endsWith('/index.html')) return 'home';
  if (path.endsWith('/resume.html')) return 'resume';
  return null;
}

function resolveUrl(href) {
  return new URL(href, window.location.href);
}

function isRoutablePage(url) {
  return url.origin === window.location.origin && normalizePage(url.pathname) != null;
}

async function fetchPageTemplate(path) {
  const cached = PAGE_CACHE.get(path);
  if (cached) return cached;

  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${path}`);

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const template = {
    title: doc.title,
    bodyClass: doc.body.className,
    bodyHtml: doc.body.innerHTML,
  };

  PAGE_CACHE.set(path, template);
  return template;
}

function syncStylesheets(page) {
  const homeSheets = ['css/styles.css', 'css/animations.css'];
  const resumeSheets = ['css/resume.css'];
  const wanted = new Set(page === 'home' ? homeSheets : resumeSheets);
  const allSheets = [...homeSheets, ...resumeSheets];

  allSheets.forEach((href) => {
    const existing = [...document.querySelectorAll(`link[rel="stylesheet"][href="${href}"]`)];
    if (wanted.has(href)) {
      if (existing.length) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.append(link);
      return;
    }

    existing.forEach((link) => link.remove());
  });
}

async function applyPageTemplate(page) {
  const path = page === 'home' ? 'index.html' : 'resume.html';
  const template = await fetchPageTemplate(path);

  document.body.className = template.bodyClass;
  document.body.innerHTML = template.bodyHtml;
  document.title = template.title;
  syncStylesheets(page);
}

async function mountPage(page) {
  if (page === 'home') {
    const { mountHomePage } = await import('./app.js');
    await mountHomePage();
  } else {
    const { mountResumePage } = await import('./resume-page.js');
    await mountResumePage();
  }
  activePage = page;
}

async function destroyPage(page) {
  if (page === 'home') {
    const { destroyHomePage } = await import('./app.js');
    destroyHomePage();
  } else if (page === 'resume') {
    const { destroyResumePage } = await import('./resume-page.js');
    destroyResumePage();
  }
}

export function closeSiteMenus() {
  const navCta = document.getElementById('site-nav-cta');
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');

  navCta?.classList.remove('open');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Open menu');
  toggle?.classList.remove('is-open');
  menu?.setAttribute('aria-hidden', 'true');
}

function scrollToHash(hash, { behavior = 'smooth' } = {}) {
  if (!hash) return;
  requestAnimationFrame(() => {
    document.querySelector(hash)?.scrollIntoView({ behavior });
  });
}

function pushHistory(page, hash, { replace = false } = {}) {
  const historyPath = page === 'home' ? '/' : '/resume.html';
  const historyUrl = `${historyPath}${hash}`;
  const state = { page };

  if (replace) {
    history.replaceState(state, '', historyUrl);
  } else {
    history.pushState(state, '', historyUrl);
  }
}

export async function navigateTo(href, { replace = false, initial = false } = {}) {
  const url = resolveUrl(href);
  const nextPage = normalizePage(url.pathname);

  if (!nextPage) {
    window.location.assign(url.href);
    return;
  }

  const pathnamePage = normalizePage(window.location.pathname);
  const isSamePage = nextPage === activePage && pathnamePage === nextPage;

  if (isSamePage && url.hash && !initial) {
    closeSiteMenus();
    pushHistory(nextPage, url.hash, { replace });
    scrollToHash(url.hash);
    return;
  }

  if (isSamePage && !url.hash && !initial) {
    closeSiteMenus();
    return;
  }

  if (navigating) return;
  navigating = true;

  try {
    closeSiteMenus();

    if (activePage) {
      await destroyPage(activePage);
    }

    const needsTemplate = !initial || pathnamePage !== nextPage;
    if (needsTemplate) {
      await applyPageTemplate(nextPage);
    } else {
      syncStylesheets(nextPage);
    }

    await mountPage(nextPage);

    pushHistory(nextPage, url.hash, { replace: initial || replace });

    if (url.hash) {
      scrollToHash(url.hash);
    } else {
      window.scrollTo(0, 0);
    }
  } finally {
    navigating = false;
  }
}

export function initSiteRouter() {
  window.addEventListener('popstate', () => {
    const page = history.state?.page || normalizePage(window.location.pathname);
    if (!page) return;

    const path = page === 'home' ? '/' : '/resume.html';
    navigateTo(`${path}${window.location.hash}`, { replace: true });
  });

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const url = resolveUrl(link.getAttribute('href'));
    if (!isRoutablePage(url)) return;

    const currentPage = activePage || normalizePage(window.location.pathname);
    const targetPage = normalizePage(url.pathname);

    if (currentPage === targetPage) {
      event.preventDefault();
      if (url.hash) {
        navigateTo(url.href).catch(() => {
          window.location.assign(url.href);
        });
      }
      return;
    }

    event.preventDefault();
    navigateTo(url.href).catch(() => {
      window.location.assign(url.href);
    });
  });
}

export function bootCurrentPage() {
  const page = normalizePage(window.location.pathname) || 'home';
  activePage = null;
  const path = page === 'home' ? '/' : '/resume.html';
  return navigateTo(`${path}${window.location.hash}`, { replace: true, initial: true });
}
