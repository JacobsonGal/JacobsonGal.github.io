function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSkillGroups(resume) {
  if (!resume?.skills) return '';
  return Object.entries(resume.skills)
    .map(([group, items]) => `
      <div class="resume-skill-group">
        <h4>${escapeHtml(group)}</h4>
        <p>${items.map(escapeHtml).join(' · ')}</p>
      </div>
    `)
    .join('');
}

function renderExperienceForResume(experience) {
  return (experience || [])
    .filter((item) => !item.webOnly)
    .map((item) => `
      <article class="resume-role">
        <div class="resume-role-head">
          <h3>${escapeHtml(item.title)}</h3>
          <span class="resume-dates mono-label">${escapeHtml(item.dates)}</span>
        </div>
        <p class="resume-company mono-label">${escapeHtml(item.company)}${item.location ? ` · ${escapeHtml(item.location)}` : ''}</p>
        <p>${escapeHtml(item.summary)}</p>
        ${item.bullets?.length ? `<ul>${item.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
        ${item.stack?.length ? `<p class="resume-stack mono-label">${item.stack.map(escapeHtml).join(' · ')}</p>` : ''}
      </article>
    `)
    .join('');
}

function renderEducation(education) {
  return (education || [])
    .map((item) => `
      <article class="resume-edu-item">
        <h3>${escapeHtml(item.degree)}</h3>
        <p>${escapeHtml(item.field)}</p>
        <p class="mono-label">${escapeHtml(item.school)} · ${escapeHtml(item.dates)}</p>
      </article>
    `)
    .join('');
}

export function renderResumeHtml(profile) {
  const resume = profile.resume || {};
  const about = (profile.about || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('');

  return `
    <article class="resume-sheet">
      <header class="resume-header">
        <div>
          <p class="resume-kicker mono-label">${escapeHtml(profile.headline)}</p>
          <h1 class="resume-name">${escapeHtml(profile.name)}</h1>
          <p class="resume-contact mono-label">
            ${escapeHtml(profile.email)}
            ${resume.phone ? ` · ${escapeHtml(resume.phone)}` : ''}
            ${profile.location ? ` · ${escapeHtml(profile.location)}` : ''}
          </p>
          <p class="resume-links mono-label">
            ${profile.urls?.portfolio ? escapeHtml(profile.urls.portfolio) : ''}
            ${profile.urls?.linkedin ? ` · LinkedIn` : ''}
            ${profile.urls?.github ? ` · GitHub` : ''}
          </p>
        </div>
        <img class="resume-mark" src="assets/images/logo.png" alt="" width="56" height="56" />
      </header>

      <section class="resume-section">
        <h2 class="mono-label">Overview</h2>
        <div class="resume-overview">${about}</div>
      </section>

      <section class="resume-section resume-skills">
        <h2 class="mono-label">Skills</h2>
        <div class="resume-skills-grid">${renderSkillGroups(resume)}</div>
        ${resume.softSkills?.length ? `<p class="resume-soft mono-label">${resume.softSkills.map(escapeHtml).join(' · ')}</p>` : ''}
        ${resume.languages?.length ? `<p class="resume-lang mono-label">${resume.languages.map(escapeHtml).join(' · ')}</p>` : ''}
      </section>

      <section class="resume-section">
        <h2 class="mono-label">Experience</h2>
        ${renderExperienceForResume(profile.experience)}
      </section>

      <section class="resume-section">
        <h2 class="mono-label">Education</h2>
        ${renderEducation(profile.education)}
      </section>
    </article>
  `;
}
