import {
  loadProfile,
  loadDraft,
  saveDraft,
  clearDraft,
  fetchServerProfile,
  downloadJson,
} from './profile-store.js?v=admin-mobile-3';
import { renderResumeHtml } from './resume-template.js?v=admin-mobile-3';
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
import {
  getProfileDef,
  DEFAULT_PROFILE_ID,
  ACTIVE_PROFILE_STORAGE_KEY,
  seedProfile,
  experienceToText,
  textToExperience,
  educationToText,
  textToEducation,
} from './resume-profiles.js?v=admin-mobile-3';
import { downloadResumePdf, getResumePdfFilename } from './resume-pdf.js';
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

function getStoredActiveId() {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || DEFAULT_PROFILE_ID;
  } catch {
    return DEFAULT_PROFILE_ID;
  }
}

function setStoredActiveId(id) {
  try {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, id);
  } catch {
    // ignore storage failures
  }
}

function jsonFilenameFor(profile) {
  const slug = (profile?.name || 'resume')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'resume'}-profile.json`;
}

function initEditor(user) {
  const form = document.getElementById('edit-form');
  const frame = document.getElementById('preview-frame');
  const layout = document.getElementById('editor-root');
  const profileTabs = [...document.querySelectorAll('.edit-profile-tab')];
  const profileNote = document.getElementById('edit-profile-note');
  const extraFields = document.getElementById('edit-extra-fields');
  const pdfButton = document.getElementById('download-resume-pdf');
  const jsonButton = document.getElementById('export-json');

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

  let activeProfile = getProfileDef(getStoredActiveId());
  // Publish on by default so edits become live commits (only for the live profile).
  let publishOnSave = isPublishConfigured() && activeProfile.publishable;
  let profile;
  let publishTimer;
  let publishInFlight = false;
  let pendingPublishProfile = null;
  let awaitingToken = false;

  function isPublishable() {
    return activeProfile.publishable;
  }

  function canPublishNow() {
    return isPublishable() && hasPublishCredentials(user);
  }

  function saveActiveDraft(next) {
    saveDraft(next, activeProfile.draftKey);
  }

  function clearActiveDraft() {
    clearDraft(activeProfile.draftKey);
  }

  async function loadActiveProfile() {
    if (activeProfile.id === 'gal') {
      return loadProfile({ preferDraft: true });
    }
    const draft = loadDraft(activeProfile.draftKey);
    return draft || seedProfile(activeProfile.id);
  }

  function syncPublishToggleUi() {
    publishToggle.setAttribute('aria-pressed', String(publishOnSave));
    publishToggle.title = publishOnSave
      ? 'Publish to GitHub on edit (on)'
      : 'Publish to GitHub on edit (off — local draft only)';
  }

  function applyProfileUi() {
    profileTabs.forEach((tab) => {
      const active = tab.dataset.profile === activeProfile.id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    if (extraFields) extraFields.hidden = !activeProfile.editsExtras;
    if (publishToggle) publishToggle.hidden = !isPublishable();
    if (!isPublishable() && tokenPanel) tokenPanel.hidden = true;
    if (profileNote) {
      if (activeProfile.live) {
        profileNote.hidden = true;
        profileNote.textContent = '';
      } else {
        profileNote.hidden = false;
        profileNote.textContent =
          'Editor-only resume — saved to this browser, never published or shown on the public site. Use Download PDF / Export JSON to keep it.';
      }
    }
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

  applyProfileUi();

  // One-time setup: without proxy / GitHub OAuth token, ask for a PAT.
  if (isPublishable() && !canPublishNow()) {
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
    return publishOnSave && isPublishable();
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
    profile = await loadActiveProfile();
    profileToForm(profile);
    renderPreview(profile);
    if (!activeProfile.live) {
      setStatus('Editing Liat Shalev — saved to this browser only.', 'info');
    } else if (canPublishNow() && publishOnSave) {
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
    if (activeProfile.editsExtras) {
      if (form.experience) form.experience.value = experienceToText(p.experience);
      if (form.education) form.education.value = educationToText(p.education);
    }
  }

  function formToProfile(base) {
    const overview = form.about.value.split('\n').map((line) => line.trim()).filter(Boolean);
    const softSkills = form.softSkills.value.split('\n').map((line) => line.trim()).filter(Boolean);
    const skills = parseSkillsFormText(form.hardSkills.value);

    const next = {
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

    if (activeProfile.editsExtras) {
      next.experience = textToExperience(form.experience ? form.experience.value : '');
      next.education = textToEducation(form.education ? form.education.value : '');
    }

    return next;
  }

  async function persistProfile(nextProfile, { publish = false, statusMessage } = {}) {
    profile = nextProfile;
    saveActiveDraft(profile);
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
          clearActiveDraft();
          saveActiveDraft(profile);
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

  function waitForPreviewReady(p) {
    return new Promise((resolve) => {
      const done = () => resolve();
      frame.addEventListener('load', done, { once: true });
      renderPreview(p);
      window.setTimeout(done, 900);
    });
  }

  async function switchProfile(id) {
    const def = getProfileDef(id);
    if (def.id === activeProfile.id) return;

    // Persist the current profile's draft before switching away.
    saveActiveDraft(formToProfile(profile));

    activeProfile = def;
    setStoredActiveId(def.id);
    publishOnSave = isPublishConfigured() && isPublishable();

    applyProfileUi();
    syncPublishToggleUi();

    if (isPublishable() && !canPublishNow()) {
      showTokenPanel(publishOnSave);
    } else {
      showTokenPanel(false);
    }

    profile = await loadActiveProfile();
    profileToForm(profile);
    renderPreview(profile);
    setStatus(
      def.live
        ? 'Editing the live site resume.'
        : 'Editing Liat Shalev — saved to this browser only.',
      'info',
    );
  }

  profileTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchProfile(tab.dataset.profile));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await persistProfile(formToProfile(profile), {
        publish: shouldPublish(),
        statusMessage: shouldPublish()
          ? undefined
          : activeProfile.live
            ? 'Draft saved in this browser only.'
            : 'Saved to this browser only.',
      });
    } catch {
      // status already set
    }
  });

  form.addEventListener('input', () => {
    const nextProfile = formToProfile(profile);
    saveActiveDraft(nextProfile);
    renderPreview(nextProfile);
    schedulePublish();
  });

  document.getElementById('reset-draft').addEventListener('click', async () => {
    clearActiveDraft();
    profile = activeProfile.id === 'gal'
      ? await fetchServerProfile()
      : seedProfile(activeProfile.id);
    profileToForm(profile);
    renderPreview(profile);
    setStatus(
      activeProfile.live
        ? 'Reset to the live site profile.'
        : 'Reset to a blank Liat Shalev template.',
      'info',
    );
  });

  pdfButton?.addEventListener('click', async () => {
    if (pdfButton.disabled) return;
    const originalLabel = pdfButton.textContent;
    pdfButton.disabled = true;
    pdfButton.textContent = 'Generating…';
    try {
      const current = formToProfile(profile);
      await waitForPreviewReady(current);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const sheet = frame.contentDocument?.querySelector('.resume-sheet');
      if (!sheet) throw new Error('Preview is not ready yet.');
      await downloadResumePdf({ element: sheet, filename: getResumePdfFilename(current) });
      setStatus('PDF ready.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Could not generate the PDF.', 'error');
    } finally {
      pdfButton.disabled = false;
      pdfButton.textContent = originalLabel;
    }
  });

  jsonButton?.addEventListener('click', () => {
    const current = formToProfile(profile);
    downloadJson(current, jsonFilenameFor(current));
    setStatus('Exported JSON.', 'success');
  });

  document.addEventListener('appearancechange', () => {
    renderPreview(formToProfile(profile));
  });

  bootstrap();
}
