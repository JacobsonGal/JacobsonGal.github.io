import { iconMarkup } from './icons.js';
import { initMotion, initRevealAnimations } from './motion.js';

const CHEVRON = '<svg class="exp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

const BASE_PATH = document.querySelector('meta[name="base-path"]')?.content || '/';
const PROFILE_PATHS = [
  `${BASE_PATH}data/profile.json`,
  'https://raw.githubusercontent.com/JacobsonGal/JacobsonGal.github.io/main/data/profile.json',
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

function renderExperienceItem(item, index) {
  const stackTags = (item.stack || []).map((s) => `<span class="tag">${s}</span>`).join('');
  const highlightTags = (item.highlights || []).map((h) => `<span class="tag">${h}</span>`).join('');
  const bullets = (item.bullets || []).map((b) => `<li><span class="mono-label">—</span><span>${b}</span></li>`).join('');

  return `
    <article class="experience-item" data-id="${item.id}" data-reveal data-reveal-delay="${index * 80}">
      <button class="experience-toggle" type="button" aria-expanded="false">
        <span class="mono-label">${item.letter}</span>
        <div>
          <h3 class="exp-title">${item.title}</h3>
          <div class="exp-meta">
            <span class="mono-label">${item.company}</span>
            <span class="mono-label exp-meta-mobile">${item.location}</span>
            <span class="mono-label exp-meta-mobile">${item.dates}</span>
          </div>
        </div>
        <span class="mono-label exp-meta-inline">${item.location}</span>
        <span class="mono-label exp-meta-inline">${item.dates}</span>
        ${CHEVRON}
      </button>
      <div class="experience-panel-wrap">
        <div class="experience-panel">
          <div class="experience-panel-inner">
            <div>
              <p>${item.summary}</p>
              ${bullets ? `<ul>${bullets}</ul>` : ''}
            </div>
            <div>
              ${highlightTags ? `<p class="mono-label panel-label">Key Features</p><div class="tag-row">${highlightTags}</div>` : ''}
              ${stackTags ? `<p class="mono-label panel-label">Skills</p><div class="tag-row">${stackTags}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderEducationItem(item, index) {
  return `
    <article class="education-item" data-reveal data-reveal-delay="${index * 100}">
      <span class="mono-label">0${index + 1}</span>
      <h3>${item.degree}</h3>
      <p>${item.school}</p>
      <div class="education-item-footer">
        <span class="mono-label">${item.field}</span>
        <span class="mono-label">${item.dates}</span>
      </div>
    </article>
  `;
}

function renderFloatingLinks(profile) {
  const resumeHref = asset(profile.urls.cv || 'resume.html');
  const links = [
    { label: 'LinkedIn', href: profile.urls.linkedin, icon: iconMarkup('linkedin'), external: true },
    { label: 'Resume', href: resumeHref, icon: 'brand', external: false },
    { label: 'GitHub', href: profile.urls.github, icon: iconMarkup('github'), external: true },
    { label: 'Instagram', href: profile.urls.instagram, icon: iconMarkup('instagram'), external: true },
    { label: 'Email', href: `mailto:${profile.email}`, icon: iconMarkup('mail'), external: true },
  ];

  return links.map((link) => `
    <a class="floating-link mono-label stagger-item" href="${link.href}" ${link.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
      <span class="floating-link-icon ${link.icon === 'brand' ? 'floating-link-icon--brand' : ''}" aria-hidden="true">
        ${link.icon === 'brand' ? '' : link.icon}
      </span>
      <span>${link.label}</span>
    </a>
  `).join('');
}

function applyProfile(profile) {
  document.title = profile.name;

  document.querySelectorAll('[data-field]').forEach((el) => {
    const value = getNested(profile, el.dataset.field);
    if (value != null) el.textContent = value;
  });

  const aboutList = document.querySelector('[data-list="about"]');
  if (aboutList && profile.about) {
    aboutList.innerHTML = profile.about.map((p, index) => `
      <div class="numbered-item" data-reveal data-reveal-delay="${200 + index * 80}">
        <span class="mono-label numbered-index">0${index + 1}</span>
        <p>${p}</p>
      </div>
    `).join('');
  }

  const eduSummary = document.querySelector('[data-list="educationSummary"]');
  if (eduSummary && profile.educationSummary) {
    eduSummary.innerHTML = profile.educationSummary.map((e) => `<span>${e}</span>`).join('');
  }

  const experienceList = document.querySelector('[data-list="experience"]');
  if (experienceList && profile.experience) {
    experienceList.innerHTML = profile.experience
      .filter((item) => !item.webOnly)
      .map((item, index) => renderExperienceItem(item, index))
      .join('');
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

  initRevealAnimations();
}

function bindExperienceToggles() {
  document.querySelectorAll('.experience-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.experience-item');
      const isOpen = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
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
  initMotion();
  const profile = await loadProfile();
  applyProfile(profile);
  refreshLinkedInOverlay(profile);
}

init();
