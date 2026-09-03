import {
  loadProfile,
  saveDraft,
  clearDraft,
  downloadJson,
  fetchServerProfile,
} from './profile-store.js';
import { renderResumeHtml } from './resume-template.js';
import { requireResumeEditorAuth } from './resume-auth-ui.js';
import { mountThemePicker } from './theme-picker.js';
import './theme-init.js';

const gateRoot = document.getElementById('editor-gate');
const editorRoot = document.getElementById('editor-root');

const user = await requireResumeEditorAuth(gateRoot);
if (!user) {
  editorRoot.hidden = true;
} else {
  gateRoot.hidden = true;
  editorRoot.hidden = false;
  mountThemePicker(document.querySelector('.edit-panel-head'));
  initEditor();
}

function initEditor() {
  const form = document.getElementById('edit-form');
  const frame = document.getElementById('preview-frame');
  let profile;

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
    form.portfolio.value = p.urls?.portfolio || '';
    form.linkedin.value = p.urls?.linkedin || '';
    form.github.value = p.urls?.github || '';
  }

  function formToProfile(base) {
    const overview = form.about.value.split('\n').map((l) => l.trim()).filter(Boolean);
    return {
      ...base,
      updatedAt: new Date().toISOString(),
      name: form.name.value.trim(),
      email: form.email.value.trim(),
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
      },
    };
  }

  function renderPreview(p) {
    const doc = `<!DOCTYPE html><html><head><link rel="stylesheet" href="css/resume.css" /><link rel="stylesheet" href="css/themes.css" /><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" /></head><body class="resume-page resume-page--preview"><main class="resume-stage">${renderResumeHtml(p)}</main></body></html>`;
    frame.srcdoc = doc;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    profile = formToProfile(profile);
    saveDraft(profile);
    renderPreview(profile);
  });

  form.addEventListener('input', () => {
    renderPreview(formToProfile(profile));
  });

  document.getElementById('reset-draft').addEventListener('click', async () => {
    clearDraft();
    profile = await fetchServerProfile();
    profileToForm(profile);
    renderPreview(profile);
  });

  document.getElementById('export-json').addEventListener('click', () => {
    downloadJson(formToProfile(profile));
  });

  bootstrap();
}
