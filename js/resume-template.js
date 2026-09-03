import { companyIconMarkup } from './experience-icons.js';
import { iconMarkup } from './icons.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length < 2) return { first: name || '', last: '' };
  return {
    first: parts.slice(0, -1).join(' ').toUpperCase(),
    last: parts[parts.length - 1].toUpperCase(),
  };
}

function renderSidebarIcon(name) {
  const icon = iconMarkup(name);
  if (!icon) return '';
  return `<span class="resume-sidebar-icon" aria-hidden="true">${icon}</span>`;
}

function renderSidebarItem(iconName, text, href) {
  const label = href
    ? `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
    : escapeHtml(text);

  return `
    <li class="resume-sidebar-item">
      ${renderSidebarIcon(iconName)}
      <span class="resume-sidebar-item-text">${label}</span>
    </li>
  `;
}

function renderSkillGroups(resume) {
  if (!resume?.skills) return '';
  return `
    <ul class="resume-sidebar-bullets resume-skill-list">
      ${Object.entries(resume.skills)
    .map(([group, items]) => `
        <li class="resume-skill-group">
          <span class="resume-skill-group-title">${escapeHtml(group)}</span>
          <span class="resume-skill-items">${items.map(escapeHtml).join(', ')}</span>
        </li>
      `)
    .join('')}
    </ul>
  `;
}

function renderLanguages(languages) {
  if (!languages?.length) return '';
  return languages
    .map((lang) => {
      if (typeof lang === 'string') {
        const [name, ...rest] = lang.split(' — ');
        return `<div class="resume-lang-item"><span class="resume-lang-name">${escapeHtml(name)}</span><span class="resume-lang-level">${escapeHtml(rest.join(' — '))}</span></div>`;
      }
      return `<div class="resume-lang-item"><span class="resume-lang-name">${escapeHtml(lang.name)}</span><span class="resume-lang-level">${escapeHtml(lang.level)}</span></div>`;
    })
    .join('');
}

function renderWorkCompanyMeta(item) {
  const logo = companyIconMarkup(item.id, '', {
    className: 'resume-company-logo',
    width: 18,
    height: 18,
  });
  const suffixParts = [];
  if (item.team) suffixParts.push(item.team);
  suffixParts.push(item.dates);
  const suffix = suffixParts.map((part) => `| ${part}`).join(' ');

  return `
    <p class="resume-role-meta">
      <strong class="resume-company-name">${escapeHtml(item.company)}</strong>${logo}<span class="resume-company-suffix">${escapeHtml(suffix)}</span>
    </p>
  `;
}

function renderWorkRoles(experience) {
  return (experience || [])
    .filter((item) => !item.webOnly && !item.resumeOnly && !item.armyService)
    .map((item) => `
      <article class="resume-role">
        <h3 class="resume-role-title">${escapeHtml(item.title)}</h3>
        ${renderWorkCompanyMeta(item)}
        ${item.stack?.length ? `<p class="resume-role-stack">${item.stack.map(escapeHtml).join(', ')}</p>` : ''}
        ${item.summary ? `<p class="resume-role-summary">${escapeHtml(item.summary)}</p>` : ''}
        ${item.bullets?.length ? `<ul class="resume-role-list">${item.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
        ${item.highlights?.length ? `<p class="resume-role-features"><strong>Key Features:</strong> ${item.highlights.map(escapeHtml).join(', ')}.</p>` : ''}
      </article>
    `)
    .join('');
}

function renderArmyService(experience) {
  const item = (experience || []).find((entry) => entry.armyService);
  if (!item) return '';

  return `
    <section class="resume-section resume-section--main resume-section--timeline">
      <h2 class="resume-section-title">Army Service</h2>
      <article class="resume-role">
        <p class="resume-role-meta">${escapeHtml(item.company)} | ${escapeHtml(item.dates)}</p>
        <h3 class="resume-role-title">${escapeHtml(item.title)}</h3>
        ${item.bullets?.length ? `<ul class="resume-role-list">${item.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
      </article>
    </section>
  `;
}

function renderEducation(education) {
  return (education || [])
    .map((item) => `
      <article class="resume-edu-item">
        <h3 class="resume-edu-degree">${escapeHtml(item.degree)}</h3>
        <p class="resume-edu-school">${escapeHtml(item.school)} | ${escapeHtml(item.dates)}</p>
        <p class="resume-edu-field">${escapeHtml(item.field)}</p>
      </article>
    `)
    .join('');
}

export function renderResumeHtml(profile) {
  const resume = profile.resume || {};
  const { first, last } = splitName(profile.name);
  const resumeHeadline = resume.headline || profile.headline;
  const resumeLocation = resume.location || profile.location;
  const overview = (resume.overview || profile.about || [])
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');

  return `
    <article class="resume-sheet resume-sheet--cv">
      <div class="resume-layout">
        <aside class="resume-sidebar">
          <div class="resume-name-block">
            <span class="resume-name-line">${escapeHtml(first)}</span>
            ${last ? `<span class="resume-name-line">${escapeHtml(last)}</span>` : ''}
          </div>
          <p class="resume-sidebar-title">${escapeHtml(resumeHeadline)}</p>

          <section class="resume-sidebar-section">
            <h2 class="resume-sidebar-heading">Contact</h2>
            <ul class="resume-sidebar-list">
              ${renderSidebarItem('mail', profile.email, `mailto:${profile.email}`)}
              ${resume.phone ? renderSidebarItem('phone', resume.phone) : ''}
              ${resumeLocation ? renderSidebarItem('location', resumeLocation) : ''}
            </ul>
          </section>

          <section class="resume-sidebar-section">
            <h2 class="resume-sidebar-heading">Connect</h2>
            <ul class="resume-sidebar-list">
              ${profile.urls?.portfolio ? renderSidebarItem('globe', 'Portfolio', profile.urls.portfolio) : ''}
              ${profile.urls?.linkedin ? renderSidebarItem('linkedin', 'Gal Jacobson', profile.urls.linkedin) : ''}
              ${profile.urls?.github ? renderSidebarItem('github', 'JacobsonGal', profile.urls.github) : ''}
            </ul>
          </section>

          <section class="resume-sidebar-section">
            <h2 class="resume-sidebar-heading">Hard Skills</h2>
            <div class="resume-sidebar-skills">${renderSkillGroups(resume)}</div>
          </section>

          ${resume.softSkills?.length ? `
            <section class="resume-sidebar-section">
              <h2 class="resume-sidebar-heading">Soft Skills</h2>
              <ul class="resume-sidebar-bullets">
                ${resume.softSkills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join('')}
              </ul>
            </section>
          ` : ''}

          ${resume.languages?.length ? `
            <section class="resume-sidebar-section">
              <h2 class="resume-sidebar-heading">Languages</h2>
              <div class="resume-lang-grid">${renderLanguages(resume.languages)}</div>
            </section>
          ` : ''}
        </aside>

        <div class="resume-main">
          <section class="resume-section resume-section--main">
            <h2 class="resume-section-title">Overview</h2>
            <div class="resume-overview">${overview}</div>
          </section>

          <section class="resume-section resume-section--main resume-section--timeline">
            <h2 class="resume-section-title">Work Experience</h2>
            ${renderWorkRoles(profile.experience)}
          </section>

          <section class="resume-section resume-section--main resume-section--timeline">
            <h2 class="resume-section-title">Education</h2>
            ${renderEducation(profile.education)}
          </section>

          ${renderArmyService(profile.experience)}
        </div>
      </div>
    </article>
  `;
}
