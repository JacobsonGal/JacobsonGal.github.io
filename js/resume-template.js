import { companyIconMarkup } from './experience-icons.js';

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

function renderSkillGroups(resume) {
  if (!resume?.skills) return '';
  return Object.entries(resume.skills)
    .map(([group, items]) => `
      <div class="resume-skill-group">
        <h4>${escapeHtml(group)}</h4>
        <p>${items.map(escapeHtml).join(', ')}</p>
      </div>
    `)
    .join('');
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

function renderRoleIcon(id) {
  const icon = companyIconMarkup(id, '', {
    className: 'resume-role-icon',
    width: 32,
    height: 32,
  });
  if (!icon) return '';
  return `<span class="resume-role-icon-wrap" aria-hidden="true">${icon}</span>`;
}

function renderRoleHead(item, companyLine) {
  const icon = renderRoleIcon(item.id);
  return `
    <div class="resume-role-head">
      ${icon}
      <div class="resume-role-copy">
        <h3 class="resume-role-title">${escapeHtml(item.title)}</h3>
        <p class="resume-role-meta">${escapeHtml(companyLine)}</p>
      </div>
    </div>
  `;
}

function renderWorkRoles(experience) {
  return (experience || [])
    .filter((item) => !item.webOnly && !item.resumeOnly && !item.armyService)
    .map((item) => {
      const companyLine = [
        item.company,
        item.team ? `| ${item.team}` : '',
        `| ${item.dates}`,
      ].filter(Boolean).join(' ');

      return `
        <article class="resume-role">
          ${renderRoleHead(item, companyLine)}
          ${item.stack?.length ? `<p class="resume-role-stack">${item.stack.map(escapeHtml).join(', ')}</p>` : ''}
          ${item.summary ? `<p class="resume-role-summary">${escapeHtml(item.summary)}</p>` : ''}
          ${item.bullets?.length ? `<ul class="resume-role-list">${item.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
          ${item.highlights?.length ? `<p class="resume-role-features"><strong>Key Features:</strong> ${item.highlights.map(escapeHtml).join(', ')}.</p>` : ''}
        </article>
      `;
    })
    .join('');
}

function renderArmyService(experience) {
  const item = (experience || []).find((entry) => entry.armyService);
  if (!item) return '';

  const companyLine = `${item.company} | ${item.dates}`;

  return `
    <section class="resume-section resume-section--main">
      <h2 class="resume-section-title">Army Service</h2>
      <article class="resume-role">
        ${renderRoleHead(item, companyLine)}
        ${item.bullets?.length ? `<ul class="resume-role-list">${item.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
      </article>
    </section>
  `;
}

function renderEducation(education) {
  return (education || [])
    .map((item) => {
      const icon = renderRoleIcon(item.id || 'colman');
      return `
        <article class="resume-edu-item">
          <div class="resume-role-head">
            ${icon}
            <div class="resume-role-copy">
              <h3>${escapeHtml(item.degree)}</h3>
              <p class="resume-edu-school">${escapeHtml(item.school)} | ${escapeHtml(item.dates)}</p>
              <p class="resume-edu-field">${escapeHtml(item.field)}</p>
            </div>
          </div>
        </article>
      `;
    })
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
              <li><a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a></li>
              ${resume.phone ? `<li>${escapeHtml(resume.phone)}</li>` : ''}
              ${resumeLocation ? `<li>${escapeHtml(resumeLocation)}</li>` : ''}
            </ul>
          </section>

          <section class="resume-sidebar-section">
            <h2 class="resume-sidebar-heading">Connect</h2>
            <ul class="resume-sidebar-list">
              ${profile.urls?.portfolio ? `<li><a href="${escapeHtml(profile.urls.portfolio)}">Portfolio</a></li>` : ''}
              ${profile.urls?.linkedin ? `<li><a href="${escapeHtml(profile.urls.linkedin)}">Gal Jacobson</a></li>` : ''}
              ${profile.urls?.github ? `<li><a href="${escapeHtml(profile.urls.github)}">JacobsonGal</a></li>` : ''}
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

          <section class="resume-section resume-section--main">
            <h2 class="resume-section-title">Work Experience</h2>
            ${renderWorkRoles(profile.experience)}
          </section>

          <section class="resume-section resume-section--main">
            <h2 class="resume-section-title">Education</h2>
            ${renderEducation(profile.education)}
          </section>

          ${renderArmyService(profile.experience)}
        </div>
      </div>
    </article>
  `;
}
