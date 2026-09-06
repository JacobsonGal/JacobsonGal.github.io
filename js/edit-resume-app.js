import {
  loadProfile,
  saveDraft,
  clearDraft,
  fetchServerProfile,
} from './profile-store.js';
import { renderResumeHtml } from './resume-template.js';
import { requireResumeEditorAuth } from './resume-auth-ui.js';
import {
  GITHUB_PROFILE_PATH,
  GITHUB_REPO,
} from './auth-config.js';
import {
  isPublishConfigured,
  hasPublishCredentials,
  publishProfile,
  PublishAuthRequiredError,
} from './github-publish.js';
import {
  getSessionPublishToken,
  setSessionPublishToken,
  publishTokenSetupUrl,
  validatePublishToken,
} from './publish-token.js';
import './theme-init.js';

const params = new URLSearchParams(window.location.search);
const isEmbed = params.get('embed') === '1';

if (!isEmbed) {
  window.location.replace('admin.html#resume');
}

if (isEmbed) {
  document.body.classList.add('edit-resume-page--embed');
  const backLink = document.querySelector('.edit-panel-head a[href="resume.html"]');
  if (backLink) backLink.hidden = true;
}

const gateRoot = document.getElementById('editor-gate');
const editorRoot = document.getElementById('editor-root');

const user = isEmbed ? await requireResumeEditorAuth(gateRoot) : null;
if (!isEmbed) {
  // Redirecting to admin — skip editor boot.
} else if (!user) {
  editorRoot.hidden = true;
} else {
  gateRoot.hidden = true;
  editorRoot.hidden = false;
  initEditor(user);
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

function initEditor(user) {
  const form = document.getElementById('edit-form');
  const frame = document.getElementById('preview-frame');
  const layout = document.getElementById('editor-root');

  function bindMobilePaneTabs() {
    if (!layout) return;
    layout.dataset.mobilePane = layout.dataset.mobilePane || 'form';
    const tabs = layout.querySelectorAll('[data-edit-pane]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const pane = tab.dataset.editPane;
        layout.dataset.mobilePane = pane;
        tabs.forEach((node) => {
          const active = node.dataset.editPane === pane;
          node.classList.toggle('is-active', active);
          node.setAttribute('aria-selected', String(active));
        });
      });
    });
  }

  bindMobilePaneTabs();
  const publishToggle = document.getElementById('publish-option');
  const editStatus = document.getElementById('edit-status');
  const tokenPanel = document.getElementById('publish-token-panel');
  const tokenInput = document.getElementById('publish-token-input');
  const tokenSave = document.getElementById('publish-token-save');
  const tokenLink = document.getElementById('publish-token-link');

  // Publish on by default so edits become live commits.
  let publishOnSave = isPublishConfigured();
  let profile;
  let publishTimer;
  let publishInFlight = false;
  let pendingPublishProfile = null;
  let awaitingToken = false;

  function canPublishNow() {
    return hasPublishCredentials(user);
  }

  function syncPublishToggleUi() {
    publishToggle.setAttribute('aria-pressed', String(publishOnSave));
    publishToggle.title = publishOnSave
      ? 'Publish to GitHub on edit (on)'
      : 'Publish to GitHub on edit (off — local draft only)';
  }

  function showTokenPanel(visible) {
    if (!tokenPanel) return;
    tokenPanel.hidden = !visible;
    awaitingToken = visible;
    if (visible && tokenInput) {
      tokenInput.value = getSessionPublishToken();
      tokenInput.focus();
    }
  }

  if (tokenLink) {
    tokenLink.href = publishTokenSetupUrl();
  }

  // One-time setup: without proxy / GitHub OAuth token, ask for a PAT.
  if (!canPublishNow()) {
    showTokenPanel(true);
    setStatus('Add a publish token once — then every edit commits live to GitHub.', 'info');
  }

  syncPublishToggleUi();

  publishToggle.addEventListener('click', () => {
    publishOnSave = !publishOnSave;
    syncPublishToggleUi();
    if (publishOnSave) schedulePublish();
  });

  tokenSave?.addEventListener('click', async () => {
    const raw = tokenInput?.value || '';
    tokenSave.disabled = true;
    setStatus('Checking GitHub token…', 'info');
    try {
      await validatePublishToken(raw, {
        owner: GITHUB_REPO.owner,
        repo: GITHUB_REPO.name,
        path: GITHUB_PROFILE_PATH,
        branch: GITHUB_REPO.branch,
      });
      setSessionPublishToken(raw);
      showTokenPanel(false);
      publishOnSave = true;
      syncPublishToggleUi();
      setStatus('Publish token saved. Publishing current resume…', 'info');
      await persistProfile(formToProfile(profile), { publish: true });
    } catch (error) {
      showTokenPanel(true);
      setStatus(error.message || 'Could not save publish token.', 'error');
    } finally {
      tokenSave.disabled = false;
    }
  });

  function shouldPublish() {
    return publishOnSave;
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
    if (canPublishNow() && publishOnSave) {
      setStatus('Live publish is on — edits commit to GitHub automatically.', 'info');
    }
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
    const overview = form.about.value.split('\n').map((line) => line.trim()).filter(Boolean);
    const softSkills = form.softSkills.value.split('\n').map((line) => line.trim()).filter(Boolean);
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

    if (!canPublishNow()) {
      showTokenPanel(true);
      setStatus('Add a GitHub publish token to make this change live.', 'error');
      return profile;
    }

    pendingPublishProfile = profile;
    if (publishInFlight) return profile;

    publishInFlight = true;
    setStatus('Publishing to GitHub…', 'info');

    try {
      while (pendingPublishProfile) {
        const toPublish = pendingPublishProfile;
        pendingPublishProfile = null;
        const published = await publishProfile(toPublish);
        // Prefer any newer edit queued while this request was in flight.
        if (!pendingPublishProfile) {
          profile = published;
          clearDraft();
          saveDraft(profile);
          showTokenPanel(false);
          setStatus('Published to GitHub. Live on the site in about a minute.', 'success');
        }
      }
      return profile;
    } catch (error) {
      pendingPublishProfile = null;
      if (error instanceof PublishAuthRequiredError || error?.code === 'publish_auth_required') {
        showTokenPanel(true);
      }
      setStatus(error.message || 'Publish failed.', 'error');
      throw error;
    } finally {
      publishInFlight = false;
    }
  }

  function schedulePublish() {
    if (!shouldPublish()) return;
    if (!canPublishNow()) {
      showTokenPanel(true);
      return;
    }
    window.clearTimeout(publishTimer);
    publishTimer = window.setTimeout(() => {
      persistProfile(formToProfile(profile), { publish: true }).catch(() => {});
    }, 900);
  }

  function previewShellAttrs() {
    const { theme, appearance } = document.documentElement.dataset;
    return `data-theme="${theme || 'arctic'}" data-appearance="${appearance || 'light'}"`;
  }

  function renderPreview(p) {
    const doc = `<!DOCTYPE html><html ${previewShellAttrs()}><head><link rel="stylesheet" href="css/resume.css" /><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" /></head><body class="resume-page resume-page--preview"><main class="resume-stage">${renderResumeHtml(p)}</main></body></html>`;
    frame.srcdoc = doc;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await persistProfile(formToProfile(profile), {
        publish: shouldPublish(),
        statusMessage: shouldPublish() ? undefined : 'Draft saved in this browser only.',
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
