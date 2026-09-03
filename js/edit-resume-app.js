import {
  loadProfile,
  saveDraft,
  clearDraft,
  fetchServerProfile,
} from './profile-store.js';
import { renderResumeHtml } from './resume-template.js';
import { requireResumeEditorAuth } from './resume-auth-ui.js';
import { isPublishConfigured, publishProfile } from './github-publish.js';
import './theme-init.js';

const gateRoot = document.getElementById('editor-gate');
const editorRoot = document.getElementById('editor-root');

const user = await requireResumeEditorAuth(gateRoot);
if (!user) {
  editorRoot.hidden = true;
} else {
  gateRoot.hidden = true;
  editorRoot.hidden = false;
  initEditor();
}

function skillsToFormText(skills = {}) {
  return Object.entries(skills)
    .map(([group, items]) => `${group}: ${items.join(', ')}`)
    .join('\n');
}

function parseSkillsFormText(text) {
  const skills = {};

  text.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) return;

    const group = trimmed.slice(0, colonIndex).trim();
    const items = trimmed
      .slice(colonIndex + 1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (group && items.length) {
      skills[group] = items;
    }
  });

  return skills;
}

function initEditor() {
  const form = document.getElementById('edit-form');
  const frame = document.getElementById('preview-frame');
  const publishToggle = document.getElementById('publish-option');
  const editStatus = document.getElementById('edit-status');
  const publishEnabled = isPublishConfigured();
  let publishOnSave = publishEnabled;
  let profile;
  let publishTimer;
  let publishInFlight = false;

  function syncPublishToggleUi() {
    publishToggle.setAttribute('aria-pressed', String(publishOnSave));
  }

  if (!publishEnabled) {
    publishOnSave = false;
    publishToggle.title = 'Publish to Github (not configured — saves draft locally)';
  }

  syncPublishToggleUi();

  publishToggle.addEventListener('click', () => {
    publishOnSave = !publishOnSave;
    syncPublishToggleUi();
  });

  function shouldPublish() {
    return publishEnabled && publishOnSave;
  }

  function setStatus(message, type = 'info') {
    if (!message) {
      editStatus.hidden = true;
      editStatus.textContent = '';
      editStatus.dataset.status = '';
      return;
    }
    editStatus.hidden = false;
    editStatus.textContent = message;
    editStatus.dataset.status = type;
  }

  async function bootstrap() {
    profile = await loadProfile({ preferDraft: true });
    profileToForm(profile);
    renderPreview(profile);
  }

  function profileToForm(p) {
    const resume = p.resume || {};
    form.name.value = p.name || '';
    form.headline.value = resume.headline || p.headline || '';
    form.email.value = p.email || '';
    form.phone.value = resume.phone || '';
    form.location.value = resume.location || p.location || '';
    form.about.value = (resume.overview || p.about || []).join('\n');
    form.hardSkills.value = skillsToFormText(resume.skills);
    form.softSkills.value = (resume.softSkills || []).join('\n');
    form.portfolio.value = p.urls?.portfolio || '';
    form.linkedin.value = p.urls?.linkedin || '';
    form.github.value = p.urls?.github || '';
  }

  function formToProfile(base) {
    const overview = form.about.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const softSkills = form.softSkills.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const skills = parseSkillsFormText(form.hardSkills.value);

    return {
      ...base,
      updatedAt: new Date().toISOString(),
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      about: overview.length ? overview : base.about,
      urls: {
        ...base.urls,
        portfolio: form.portfolio.value.trim(),
        linkedin: form.linkedin.value.trim(),
        github: form.github.value.trim(),
      },
      resume: {
        ...base.resume,
        headline: form.headline.value.trim(),
        phone: form.phone.value.trim(),
        location: form.location.value.trim(),
        overview,
        skills,
        softSkills,
      },
    };
  }

  async function persistProfile(nextProfile, { publish = false, statusMessage } = {}) {
    profile = nextProfile;
    saveDraft(profile);
    renderPreview(profile);

    if (!publish || !shouldPublish()) {
      if (statusMessage) setStatus(statusMessage, 'info');
      return profile;
    }

    if (publishInFlight) return profile;

    publishInFlight = true;
    setStatus('Publishing to GitHub…', 'info');

    try {
      const published = await publishProfile(profile);
      profile = published;
      clearDraft();
      saveDraft(profile);
      setStatus('Published to GitHub. Site updates in about a minute.', 'success');
      return profile;
    } catch (error) {
      setStatus(error.message || 'Publish failed.', 'error');
      throw error;
    } finally {
      publishInFlight = false;
    }
  }

  function schedulePublish() {
    if (!shouldPublish()) return;
    window.clearTimeout(publishTimer);
    publishTimer = window.setTimeout(() => {
      persistProfile(formToProfile(profile), { publish: true }).catch(() => {});
    }, 1500);
  }

  function previewShellAttrs() {
    const { theme, appearance } = document.documentElement.dataset;
    return `data-theme="${theme || 'arctic'}" data-appearance="${appearance || 'light'}"`;
  }

  function renderPreview(p) {
    const doc = `<!DOCTYPE html><html ${previewShellAttrs()}><head><link rel="stylesheet" href="css/resume.css" /><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" /></head><body class="resume-page resume-page--preview"><main class="resume-stage">${renderResumeHtml(p)}</main></body></html>`;
    frame.srcdoc = doc;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await persistProfile(formToProfile(profile), {
        publish: shouldPublish(),
        statusMessage: shouldPublish() ? undefined : 'Draft saved in this browser.',
      });
    } catch {
      // status already set
    }
  });

  form.addEventListener('input', () => {
    const nextProfile = formToProfile(profile);
    saveDraft(nextProfile);
    renderPreview(nextProfile);
    schedulePublish();
  });

  document.getElementById('reset-draft').addEventListener('click', async () => {
    clearDraft();
    profile = await fetchServerProfile();
    profileToForm(profile);
    renderPreview(profile);
    setStatus('Reset to the live site profile.', 'info');
  });

  document.addEventListener('appearancechange', () => {
    renderPreview(formToProfile(profile));
  });

  bootstrap();
}
