import { iconMarkup } from './icons.js';
import { companyIconMarkup, companyLinkMarkup, highlightLinkMarkup } from './experience-icons.js';
import { initMotion, initRevealAnimations } from './motion.js';
import { getAuthorizedUser } from './github-auth.js';
import { mountAppearanceToggle } from './appearance.js';
import { mountOwnerSecretEntry } from './owner-secret-entry.js';
import './theme-init.js';

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
  const highlightTags = (item.highlights || []).map((h) => highlightLinkMarkup(h)).join('');
  const bullets = (item.bullets || []).map((b) => `<li>${b}</li>`).join('');
  const icon = companyIconMarkup(item.id, BASE_PATH) || `<span class="mono-label exp-letter">${item.letter}</span>`;

  const tagSections = [
    highlightTags ? `<div class="exp-panel-group"><p class="mono-label panel-label">Key features</p><div class="tag-row">${highlightTags}</div></div>` : '',
    stackTags ? `<div class="exp-panel-group"><p class="mono-label panel-label">Skills</p><div class="tag-row">${stackTags}</div></div>` : '',
  ].filter(Boolean).join('');

  return `
    <article class="experience-item" data-id="${item.id}" data-reveal data-reveal-delay="${index * 80}">
      <div class="exp-timeline-track" aria-hidden="true">
        <div class="exp-timeline-node">${icon}</div>
        <span class="exp-timeline-line"></span>
      </div>
      <div class="exp-timeline-main">
        <time class="exp-timeline-date mono-label">${item.dates}</time>
        <div class="exp-timeline-card">
          <button class="experience-toggle" type="button" aria-expanded="false">
            <div class="exp-header">
              <div class="exp-header-main">
                <h3 class="exp-title">${item.title}</h3>
                <p class="exp-meta-line">
                  <span class="exp-company">${companyLinkMarkup(item.company, item.id, 'exp-company-link')}</span>
                  <span class="exp-meta-sep" aria-hidden="true">·</span>
                  <span class="exp-location">${item.location}</span>
                </p>
              </div>
            </div>
            ${CHEVRON}
          </button>
          <div class="experience-panel-wrap">
            <div class="experience-panel">
              <div class="experience-panel-inner">
                <div class="exp-panel-copy">
                  ${item.summary ? `<p class="exp-summary">${item.summary}</p>` : ''}
                  ${bullets ? `<ul class="exp-bullets">${bullets}</ul>` : ''}
                </div>
                ${tagSections ? `<div class="exp-panel-tags">${tagSections}</div>` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function orderEducationForHomepage(education) {
  const rank = (item) => {
    if (/bachelor|\bBS\b/i.test(item.degree)) return 0;
    if (/master|\bMBA\b/i.test(item.degree)) return 1;
    return 2;
  };

  return [...education].sort((a, b) => rank(a) - rank(b));
}

function renderEducationItem(item, index) {
  const schoolLogo = companyIconMarkup(item.id, BASE_PATH, {
    className: 'education-school-logo',
    width: 48,
    height: 48,
  });
  const schoolLine = schoolLogo
    ? `<p class="education-school">${schoolLogo}<span>${item.school}</span></p>`
    : `<p>${item.school}</p>`;

  return `
    <article class="education-item" data-reveal data-reveal-delay="${index * 100}">
      <span class="mono-label">0${index + 1}</span>
      <h3>${item.degree}</h3>
      ${schoolLine}
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
    { label: 'GitHub', href: profile.urls.github, icon: iconMarkup('github'), external: true },
    { label: 'Instagram', href: profile.urls.instagram, icon: iconMarkup('instagram'), external: true },
    { label: 'Email', href: `mailto:${profile.email}`, icon: iconMarkup('mail'), external: true },
    { label: 'Resume', href: resumeHref, icon: iconMarkup('resume'), external: false },
  ];

  return links.map((link) => `
    <a class="floating-link mono-label stagger-item" href="${link.href}" ${link.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
      <span class="floating-link-icon" aria-hidden="true">${link.icon}</span>
      <span>${link.label}</span>
    </a>
  `).join('');
}

function collectHardSkills(profile) {
  const skillsByCategory = profile.resume?.skills;
  if (!skillsByCategory) return [];

  const seen = new Set();
  const skills = [];

  Object.values(skillsByCategory).forEach((group) => {
    group.forEach((skill) => {
      const key = skill.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      skills.push(skill);
    });
  });

  return skills;
}

function renderHeroRailTrack(skills) {
  const items = skills
    .map((skill) => `<span>${skill.toUpperCase()}</span>`)
    .join('<span class="hero-rail-sep" aria-hidden="true">·</span>');

  const set = `<div class="hero-rail-set">${items}</div>`;
  return `${set}<div class="hero-rail-set" aria-hidden="true">${items}</div>`;
}

function applyHeroRail(profile) {
  const heroRail = document.querySelector('[data-hero-rail]');
  const hardSkills = collectHardSkills(profile);
  if (!heroRail || !hardSkills.length) return;

  heroRail.innerHTML = renderHeroRailTrack(hardSkills);
  heroRail.style.setProperty('--rail-duration', `${Math.max(28, hardSkills.length * 1.8)}s`);
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

  const heroCompany = document.querySelector('[data-hero-company]');
  if (heroCompany && profile.currentRole) {
    const { company, id } = profile.currentRole;
    heroCompany.innerHTML = companyLinkMarkup(company, id, 'hero-company-link');
  }

  const experienceList = document.querySelector('[data-list="experience"]');
  if (experienceList && profile.experience) {
    experienceList.innerHTML = profile.experience
      .filter((item) => !item.webOnly && !item.hideOnWeb)
      .map((item, index) => renderExperienceItem(item, index))
      .join('');
    bindExperienceToggles();
  }

  const educationList = document.querySelector('[data-list="education"]');
  if (educationList && profile.education) {
    educationList.innerHTML = orderEducationForHomepage(profile.education)
      .map((item, index) => renderEducationItem(item, index))
      .join('');
  }

  const floatingLinks = document.getElementById('floating-links');
  if (floatingLinks) floatingLinks.innerHTML = renderFloatingLinks(profile);

  applyHeroRail(profile);

  initRevealAnimations();
}

function bindExperienceToggles() {
  document.querySelectorAll('[data-company-link]').forEach((link) => {
    link.addEventListener('click', (event) => event.stopPropagation());
  });

  document.querySelectorAll('.experience-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.experience-item');
      const isOpen = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
    });
  });
}

function bindUi(cleanup) {
  const header = document.getElementById('site-header');
  const onScroll = () => {
    header?.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanup.push(() => window.removeEventListener('scroll', onScroll));

  const navCta = document.getElementById('site-nav-cta');
  const menu = document.getElementById('mobile-menu');
  const toggle = document.querySelector('.menu-toggle');

  const setMenuOpen = (open) => {
    navCta?.classList.toggle('open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    toggle?.classList.toggle('is-open', open);
    menu?.setAttribute('aria-hidden', String(!open));
  };

  const onToggleClick = (event) => {
    event.stopPropagation();
    setMenuOpen(!navCta?.classList.contains('open'));
  };
  toggle?.addEventListener('click', onToggleClick);
  cleanup.push(() => toggle?.removeEventListener('click', onToggleClick));

  menu?.querySelectorAll('a').forEach((link) => {
    const onMenuLinkClick = () => {
      const href = link.getAttribute('href') ?? '';
      if (href.startsWith('#')) setMenuOpen(false);
    };
    link.addEventListener('click', onMenuLinkClick);
    cleanup.push(() => link.removeEventListener('click', onMenuLinkClick));
  });

  const onDocumentClick = (event) => {
    if (!navCta?.classList.contains('open')) return;
    if (!navCta.contains(event.target)) setMenuOpen(false);
  };
  document.addEventListener('click', onDocumentClick);
  cleanup.push(() => document.removeEventListener('click', onDocumentClick));

  const onDocumentKeydown = (event) => {
    if (event.key === 'Escape') setMenuOpen(false);
  };
  document.addEventListener('keydown', onDocumentKeydown);
  cleanup.push(() => document.removeEventListener('keydown', onDocumentKeydown));

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

function ensureMobileEditLink() {
  const mobileNav = document.querySelector('.nav-menu-links');
  if (!mobileNav || mobileNav.querySelector('[data-owner-edit]')) return;

  const editLink = document.createElement('a');
  editLink.href = 'edit-resume.html';
  editLink.className = 'nav-menu-link';
  editLink.dataset.ownerEdit = 'true';
  editLink.innerHTML = '<span>Edit Resume</span><span class="mono-label">05</span>';
  mobileNav.append(editLink);
}

async function refreshOwnerUi() {
  const user = await getAuthorizedUser();
  if (user) ensureMobileEditLink();
  return user;
}

let homeCleanup = null;

export async function mountHomePage() {
  if (homeCleanup) {
    destroyHomePage();
  }

  const cleanup = [];
  bindUi(cleanup);
  initMotion();
  mountAppearanceToggle(document.getElementById('appearance-tools'));
  const profile = await loadProfile();
  applyProfile(profile);
  refreshLinkedInOverlay(profile);

  await refreshOwnerUi();

  mountOwnerSecretEntry({
    selectors: [
      '.brand .accent',
      '.portrait-mark',
      '.hero-title-line--accent .accent',
    ],
    corners: ['tr'],
    onAuthed: refreshOwnerUi,
  });

  homeCleanup = () => {
    cleanup.forEach((fn) => fn());
    homeCleanup = null;
  };
}

export function destroyHomePage() {
  homeCleanup?.();
}
