const BASE_PATH = document.querySelector('meta[name="base-path"]')?.content || '/';
const PROFILE_PATHS = [
  `${BASE_PATH}data/profile.json`,
  'https://raw.githubusercontent.com/JacobsonGal/Portfolio/main/data/profile.json',
];

const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/jacobsongal';

function asset(path) {
  if (path.startsWith('http') || path.startsWith('mailto:')) return path;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_PATH}${normalized}`;
}

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function renderExperienceItem(item) {
  const stackTags = (item.stack || []).map((s) => `<span class="tag">${s}</span>`).join('');
  const highlightTags = (item.highlights || []).map((h) => `<span class="tag">${h}</span>`).join('');
  const bullets = (item.bullets || []).map((b) => `<li>${b}</li>`).join('');

  return `
    <article class="experience-item" data-id="${item.id}">
      <button class="experience-toggle" type="button" aria-expanded="false">
        <span class="mono-label">${item.letter}</span>
        <div>
          <h3 class="exp-title">${item.title}</h3>
          <div class="exp-meta">
            <span class="mono-label">${item.company}</span>
            <span class="mono-label">${item.location}</span>
            <span class="mono-label">${item.dates}</span>
          </div>
        </div>
        <span class="mono-label">+</span>
      </button>
      <div class="experience-panel">
        <p>${item.summary}</p>
        ${bullets ? `<ul>${bullets}</ul>` : ''}
        ${highlightTags ? `<div class="tag-row">${highlightTags}</div>` : ''}
        ${stackTags ? `<div class="tag-row">${stackTags}</div>` : ''}
      </div>
    </article>
  `;
}

function renderEducationItem(item) {
  return `
    <article class="education-item">
      <h3>${item.degree}</h3>
      <p>${item.field}</p>
      <p class="mono-label">${item.school} · ${item.location}</p>
      <p class="mono-label">${item.dates}</p>
    </article>
  `;
}

function renderFloatingLinks(profile) {
  const links = [
    { label: 'LinkedIn', href: profile.urls.linkedin },
    { label: 'CV', href: asset(profile.urls.cv || 'cv/gal-jacobson-cv.pdf'), download: true },
    { label: 'GitHub', href: profile.urls.github },
    { label: 'Instagram', href: profile.urls.instagram },
    { label: 'Email', href: `mailto:${profile.email}` },
  ];

  return links.map((link) => `
    <a class="floating-link mono-label" href="${link.href}" target="_blank" rel="noopener noreferrer" ${link.download ? 'download' : ''}>
      ${link.label}
    </a>
  `).join('');
}

function applyProfile(profile) {
  document.title = `${profile.name} — ${profile.headline}`;

  document.querySelectorAll('[data-field]').forEach((el) => {
    const value = getNested(profile, el.dataset.field);
    if (value != null) el.textContent = value;
  });

  const aboutList = document.querySelector('[data-list="about"]');
  if (aboutList && profile.about) {
    aboutList.innerHTML = profile.about.map((p) => `<p>${p}</p>`).join('');
  }

  const eduSummary = document.querySelector('[data-list="educationSummary"]');
  if (eduSummary && profile.educationSummary) {
    eduSummary.innerHTML = profile.educationSummary.map((e) => `<span>${e}</span>`).join('');
  }

  const experienceList = document.querySelector('[data-list="experience"]');
  if (experienceList && profile.experience) {
    experienceList.innerHTML = profile.experience.map(renderExperienceItem).join('');
    bindExperienceToggles();
  }

  const educationList = document.querySelector('[data-list="education"]');
  if (educationList && profile.education) {
    educationList.innerHTML = profile.education.map(renderEducationItem).join('');
  }

  const floatingLinks = document.getElementById('floating-links');
  if (floatingLinks) floatingLinks.innerHTML = renderFloatingLinks(profile);

  const syncStatus = document.getElementById('sync-status');
  if (syncStatus && profile.syncedAt) {
    const when = new Date(profile.syncedAt).toLocaleString();
    syncStatus.textContent = `Profile synced ${when}${profile.source ? ` · ${profile.source}` : ''}`;
  }
}

function bindExperienceToggles() {
  document.querySelectorAll('.experience-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.experience-item');
      const isOpen = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
      btn.querySelector('.mono-label:last-child').textContent = isOpen ? '−' : '+';
    });
  });
}

function bindUi() {
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  const menu = document.getElementById('mobile-menu');
  const toggle = document.querySelector('.menu-toggle');
  const closeBtn = document.querySelector('.menu-close');

  const openMenu = () => {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('open'));
    toggle.setAttribute('aria-expanded', 'true');
  };
  const closeMenu = () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    setTimeout(() => { menu.hidden = true; }, 450);
  };

  toggle?.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

  const cta = document.getElementById('floating-cta');
  const trigger = cta?.querySelector('.floating-trigger');
  trigger?.addEventListener('click', () => {
    const open = cta.classList.toggle('open');
    trigger.setAttribute('aria-expanded', String(open));
    document.getElementById('floating-links')?.setAttribute('aria-hidden', String(!open));
  });

  const buildDate = document.querySelector('[data-build-date]');
  if (buildDate) {
    const now = new Date();
    buildDate.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

async function loadProfile() {
  for (const path of PROFILE_PATHS) {
    try {
      const profile = await fetchJson(`${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`);
      return profile;
    } catch {
      // try next source
    }
  }
  throw new Error('Could not load profile.json');
}

async function refreshLinkedInOverlay(profile) {
  try {
    const { mergeLinkedInProfile } = await import('./linkedin.js');
    const merged = await mergeLinkedInProfile(profile, LINKEDIN_PROFILE_URL);
    if (merged) applyProfile(merged);
  } catch {
    // LinkedIn fetch is best-effort; seeded profile.json remains source of truth
  }
}

async function init() {
  bindUi();
  const profile = await loadProfile();
  applyProfile(profile);
  refreshLinkedInOverlay(profile);
}

init();
