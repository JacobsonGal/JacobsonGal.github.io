import { mountAppearanceToggle } from './appearance.js';
import { adminApi, isAdminApiConfigured } from './admin-api.js';
import { signOut as signOutGitHub } from './github-auth.js';
import {
  APPLICATION_STAGES,
  STAGE_LABELS,
  createApplication,
  createCampaign,
  groupApplicationsByStage,
} from './jobs-core.js';
import {
  clearOwnerSession,
  getOwnerCodeForPublish,
  getOwnerSession,
  unlockWithOwnerCode,
} from './owner-auth.js';
import { requireResumeEditorAuth } from './resume-auth-ui.js';
import './theme-init.js';

const LOCAL_JOBS_KEY = 'portfolio_admin_jobs_v1';
const LOCAL_STATS_KEY = 'portfolio_admin_stats_v1';
const NAV_COLLAPSED_KEY = 'portfolio_admin_nav_collapsed';

const gate = document.getElementById('admin-gate');
const shell = document.getElementById('admin-shell');
const toastEl = document.getElementById('admin-toast');

let campaigns = [];
let activeCampaignId = null;
let applications = [];
let googleState = { configured: false, connected: false, email: null };

function showToast(message, isError = false) {
  if (!toastEl) return;
  if (!message) {
    toastEl.hidden = true;
    toastEl.textContent = '';
    return;
  }
  toastEl.hidden = false;
  toastEl.textContent = message;
  toastEl.style.background = isError ? 'hsl(0 55% 42% / 0.18)' : 'hsl(18 42% 46% / 0.16)';
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 4200);
}

function readLocalJobs() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_JOBS_KEY) || '{"campaigns":[],"apps":{}}');
  } catch {
    return { campaigns: [], apps: {} };
  }
}

function writeLocalJobs(data) {
  localStorage.setItem(LOCAL_JOBS_KEY, JSON.stringify(data));
}

function sectionButtons() {
  return [...document.querySelectorAll('[data-admin-section]')];
}

function showSection(name) {
  sectionButtons().forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.adminSection === name);
  });
  document.querySelectorAll('.admin-section').forEach((section) => {
    section.hidden = section.dataset.section !== name;
  });
  history.replaceState(null, '', `#${name}`);
  if (name === 'resume') ensureResumeFrame();
  if (name === 'jobs') refreshJobs();
  if (name === 'analytics') refreshAnalytics();
}

function ensureResumeFrame() {
  const frame = document.getElementById('resume-frame');
  if (!frame || frame.dataset.loaded) return;
  frame.src = 'edit-resume.html?embed=1';
  frame.dataset.loaded = 'true';
}

function promptDialog({ title, fields, confirmLabel = 'Save' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'admin-dialog-backdrop';
    const dialog = document.createElement('form');
    dialog.className = 'admin-dialog';
    dialog.innerHTML = `<h3 style="margin:0;font-family:'Space Grotesk',sans-serif">${title}</h3>`;

    fields.forEach((field) => {
      const label = document.createElement('label');
      label.textContent = field.label;
      let input;
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = field.rows || 4;
        input.value = field.value || '';
      } else if (field.type === 'select') {
        input = document.createElement('select');
        (field.options || []).forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.label;
          if (option.value === (field.value || '')) opt.selected = true;
          input.append(opt);
        });
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
        input.value = field.value || '';
      }
      input.name = field.name;
      if (field.required) input.required = true;
      label.append(input);
      dialog.append(label);
    });

    const actions = document.createElement('div');
    actions.className = 'admin-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'admin-btn admin-btn--ghost';
    cancel.textContent = 'Cancel';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'admin-btn admin-btn--primary';
    save.textContent = confirmLabel;
    actions.append(cancel, save);
    dialog.append(actions);
    backdrop.append(dialog);
    document.body.append(backdrop);

    function close(value) {
      backdrop.remove();
      resolve(value);
    }

    cancel.addEventListener('click', () => close(null));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(null);
    });
    dialog.addEventListener('submit', (event) => {
      event.preventDefault();
      close(Object.fromEntries(new FormData(dialog).entries()));
    });
  });
}

function toLocalInput(iso) {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function refreshAnalytics() {
  const hint = document.getElementById('analytics-hint');
  try {
    let stats;
    if (isAdminApiConfigured() && getOwnerCodeForPublish()) {
      stats = await adminApi.getStats();
      hint.textContent = stats.generatedAt
        ? `Updated ${new Date(stats.generatedAt).toLocaleString()}`
        : '';
    } else {
      stats = JSON.parse(localStorage.getItem(LOCAL_STATS_KEY) || 'null') || {
        today: { pageviews: 0, uniques: 0 },
        week: { pageviews: 0, uniques: 0 },
        all: { pageviews: 0, uniques: 0 },
      };
      hint.textContent = isAdminApiConfigured()
        ? 'Re-enter your owner code once this session to load live Worker stats.'
        : 'Worker URL not set — showing local placeholder totals. Set GITHUB_AUTH_PROXY_URL and deploy the Worker for live analytics.';
    }

    document.querySelectorAll('[data-stat]').forEach((node) => {
      const [bucket, metric] = node.dataset.stat.split('.');
      node.textContent = String(stats?.[bucket]?.[metric] ?? 0);
    });
  } catch (error) {
    showToast(error.message || 'Could not load analytics', true);
  }
}

async function refreshGoogleStatus() {
  const status = document.getElementById('google-status');
  const connectBtn = document.getElementById('google-connect');
  const syncBtn = document.getElementById('gmail-sync');
  const disconnectBtn = document.getElementById('google-disconnect');

  if (!isAdminApiConfigured() || !getOwnerCodeForPublish()) {
    googleState = { configured: false, connected: false, email: null };
    status.textContent = 'Connect your Worker + owner code to enable Gmail/Calendar.';
    connectBtn.hidden = true;
    syncBtn.hidden = true;
    disconnectBtn.hidden = true;
    return;
  }

  try {
    googleState = await adminApi.googleStatus();
    connectBtn.hidden = false;
    if (googleState.connected) {
      status.textContent = `Google connected${googleState.email ? ` as ${googleState.email}` : ''}.`;
      connectBtn.textContent = 'Reconnect Google';
      syncBtn.hidden = false;
      disconnectBtn.hidden = false;
    } else if (googleState.configured === false) {
      status.textContent = 'Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on the Worker to enable Gmail + Calendar.';
      connectBtn.hidden = true;
      syncBtn.hidden = true;
      disconnectBtn.hidden = true;
    } else {
      status.textContent = 'Google is configured. Connect to sync recruiting email and push interview events.';
      connectBtn.textContent = 'Connect Google';
      syncBtn.hidden = true;
      disconnectBtn.hidden = true;
    }
  } catch (error) {
    status.textContent = error.message || 'Could not check Google status.';
  }
}

async function refreshJobs() {
  await refreshGoogleStatus();
  try {
    if (isAdminApiConfigured() && getOwnerCodeForPublish()) {
      const data = await adminApi.listCampaigns();
      campaigns = data.campaigns || [];
    } else {
      campaigns = readLocalJobs().campaigns || [];
    }
  } catch (error) {
    showToast(error.message || 'Could not load campaigns', true);
    campaigns = readLocalJobs().campaigns || [];
  }

  renderCampaignList();
  if (!activeCampaignId && campaigns[0]) activeCampaignId = campaigns[0].id;
  if (activeCampaignId && campaigns.some((item) => item.id === activeCampaignId)) {
    await openCampaign(activeCampaignId);
  } else {
    activeCampaignId = null;
    document.getElementById('jobs-board-toolbar').hidden = true;
    document.getElementById('jobs-board').innerHTML =
      '<p class="admin-hint">Create a campaign to start tracking applications.</p>';
    renderCalendar([]);
  }
}

function renderCampaignList() {
  const root = document.getElementById('jobs-campaigns');
  root.replaceChildren();
  campaigns.forEach((campaign) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `jobs-campaign${campaign.id === activeCampaignId ? ' is-active' : ''}`;
    btn.innerHTML = `<strong>${campaign.name}</strong><div class="admin-hint">${campaign.status}</div>`;
    btn.addEventListener('click', () => openCampaign(campaign.id));
    root.append(btn);
  });
}

async function openCampaign(campaignId) {
  activeCampaignId = campaignId;
  renderCampaignList();
  const campaign = campaigns.find((item) => item.id === campaignId);
  document.getElementById('jobs-board-toolbar').hidden = false;
  document.getElementById('jobs-board-title').textContent = campaign?.name || 'Campaign';

  try {
    if (isAdminApiConfigured() && getOwnerCodeForPublish()) {
      const data = await adminApi.getCampaign(campaignId);
      applications = data.applications || [];
    } else {
      applications = readLocalJobs().apps?.[campaignId] || [];
    }
  } catch (error) {
    showToast(error.message || 'Could not load applications', true);
    applications = [];
  }

  renderBoard();
  renderCalendar(applications);
}

function renderBoard() {
  const board = document.getElementById('jobs-board');
  board.replaceChildren();
  const grouped = groupApplicationsByStage(applications);

  APPLICATION_STAGES.forEach((stage) => {
    const column = document.createElement('section');
    column.className = 'jobs-column';
    column.innerHTML = `<h3>${STAGE_LABELS[stage]} · ${grouped[stage].length}</h3>`;
    const cards = document.createElement('div');
    cards.className = 'jobs-column-cards';

    grouped[stage].forEach((app) => {
      const card = document.createElement('article');
      card.className = 'job-card';
      card.innerHTML = `
        <strong>${app.company}</strong>
        <span>${app.role}</span>
        ${app.location ? `<small>${app.location}</small>` : ''}
        ${app.interviewAt ? `<small>Interview · ${new Date(app.interviewAt).toLocaleString()}</small>` : ''}
      `;
      const actions = document.createElement('div');
      actions.className = 'job-card-actions';

      const select = document.createElement('select');
      APPLICATION_STAGES.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = STAGE_LABELS[value];
        if (value === app.stage) option.selected = true;
        select.append(option);
      });
      select.addEventListener('change', async () => {
        await patchApplication(app.id, { stage: select.value });
      });

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => editApplication(app));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete ${app.company}?`)) return;
        await removeApplication(app.id);
      });

      actions.append(select, editBtn, delBtn);
      card.append(actions);
      cards.append(card);
    });

    column.append(cards);
    board.append(column);
  });
}

function renderCalendar(apps) {
  const root = document.getElementById('jobs-calendar-list');
  const interviews = apps
    .filter((app) => app.interviewAt)
    .sort((a, b) => new Date(a.interviewAt) - new Date(b.interviewAt));

  root.replaceChildren();
  if (!interviews.length) {
    root.innerHTML =
      '<p class="admin-hint">Interview dates from applications show up here. Optional Google Calendar push is available when connected.</p>';
    return;
  }

  interviews.forEach((app) => {
    const item = document.createElement('article');
    item.className = 'jobs-calendar-item';
    item.innerHTML = `
      <strong>${app.company} · ${app.role}</strong>
      <span>${new Date(app.interviewAt).toLocaleString()}</span>
    `;
    root.append(item);
  });
}

async function saveLocalApps(campaignId, apps) {
  const data = readLocalJobs();
  data.apps = data.apps || {};
  data.apps[campaignId] = apps;
  data.campaigns = campaigns;
  writeLocalJobs(data);
}

async function patchApplication(appId, payload) {
  try {
    if (isAdminApiConfigured() && getOwnerCodeForPublish()) {
      const result = await adminApi.updateApplication(activeCampaignId, appId, payload);
      applications = applications.map((app) => (app.id === appId ? result.application : app));
      if (payload.interviewAt && googleState.connected) {
        await maybePushCalendar(result.application);
      }
    } else {
      applications = applications.map((app) => (
        app.id === appId ? { ...app, ...payload, updatedAt: new Date().toISOString() } : app
      ));
      await saveLocalApps(activeCampaignId, applications);
    }
    renderBoard();
    renderCalendar(applications);
  } catch (error) {
    showToast(error.message || 'Update failed', true);
  }
}

async function removeApplication(appId) {
  try {
    if (isAdminApiConfigured() && getOwnerCodeForPublish()) {
      await adminApi.deleteApplication(activeCampaignId, appId);
    }
    applications = applications.filter((app) => app.id !== appId);
    await saveLocalApps(activeCampaignId, applications);
    renderBoard();
    renderCalendar(applications);
  } catch (error) {
    showToast(error.message || 'Delete failed', true);
  }
}

async function maybePushCalendar(app) {
  if (!app.interviewAt || !googleState.connected) return;
  try {
    const start = new Date(app.interviewAt);
    const result = await adminApi.createCalendarEvent({
      title: `Interview · ${app.company} · ${app.role}`,
      description: app.notes || app.url || '',
      start: start.toISOString(),
      end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    });
    if (result.event?.id) {
      await adminApi.updateApplication(activeCampaignId, app.id, { calendarEventId: result.event.id });
      showToast('Interview added to Google Calendar');
    }
  } catch (error) {
    showToast(error.message || 'Calendar push failed', true);
  }
}

async function editApplication(app) {
  const values = await promptDialog({
    title: 'Edit application',
    confirmLabel: 'Save',
    fields: [
      { name: 'company', label: 'Company', value: app.company, required: true },
      { name: 'role', label: 'Role', value: app.role, required: true },
      { name: 'location', label: 'Location', value: app.location || '' },
      { name: 'url', label: 'Link', value: app.url || '' },
      {
        name: 'interviewAt',
        label: 'Interview (local datetime)',
        type: 'datetime-local',
        value: app.interviewAt ? toLocalInput(app.interviewAt) : '',
      },
      { name: 'notes', label: 'Notes', type: 'textarea', value: app.notes || '' },
    ],
  });
  if (!values) return;
  const payload = {
    ...values,
    interviewAt: values.interviewAt ? new Date(values.interviewAt).toISOString() : null,
  };
  await patchApplication(app.id, payload);
}

function readNavCollapsed() {
  try {
    const stored = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (stored === '0') return false;
    if (stored === '1') return true;
  } catch {
    // ignore storage errors
  }
  return true; // collapsed by default
}

function writeNavCollapsed(collapsed) {
  try {
    localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function applyNavCollapsed(collapsed) {
  if (!shell) return;
  shell.classList.toggle('is-nav-collapsed', collapsed);
  const toggle = document.getElementById('admin-nav-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.title = collapsed ? 'Expand menu' : 'Collapse menu';
  }
}

function bindNavCollapse() {
  applyNavCollapsed(readNavCollapsed());
  document.getElementById('admin-nav-toggle')?.addEventListener('click', () => {
    const next = !shell.classList.contains('is-nav-collapsed');
    applyNavCollapsed(next);
    writeNavCollapsed(next);
  });
}

function bindShell() {
  mountAppearanceToggle(document.getElementById('appearance-tools'));
  bindNavCollapse();

  sectionButtons().forEach((btn) => {
    btn.addEventListener('click', () => showSection(btn.dataset.adminSection));
  });

  document.getElementById('admin-signout')?.addEventListener('click', () => {
    clearOwnerSession();
    signOutGitHub();
    window.location.reload();
  });

  document.getElementById('new-campaign')?.addEventListener('click', async () => {
    const values = await promptDialog({
      title: 'New job-search campaign',
      confirmLabel: 'Create',
      fields: [{ name: 'name', label: 'Campaign name', required: true, value: '' }],
    });
    if (!values?.name) return;
    try {
      if (isAdminApiConfigured() && getOwnerCodeForPublish()) {
        const result = await adminApi.createCampaign({ name: values.name });
        campaigns.unshift(result.campaign);
      } else {
        const campaign = createCampaign({ name: values.name });
        campaigns.unshift(campaign);
        const data = readLocalJobs();
        data.campaigns = campaigns;
        data.apps = data.apps || {};
        data.apps[campaign.id] = [];
        writeLocalJobs(data);
      }
      activeCampaignId = campaigns[0].id;
      await refreshJobs();
    } catch (error) {
      showToast(error.message || 'Could not create campaign', true);
    }
  });

  document.getElementById('new-application')?.addEventListener('click', async () => {
    if (!activeCampaignId) return;
    const values = await promptDialog({
      title: 'Add application',
      confirmLabel: 'Add',
      fields: [
        { name: 'company', label: 'Company', required: true },
        { name: 'role', label: 'Role', required: true },
        { name: 'location', label: 'Location' },
        { name: 'url', label: 'Link' },
        {
          name: 'stage',
          label: 'Stage',
          type: 'select',
          options: APPLICATION_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] })),
          value: 'wishlist',
        },
      ],
    });
    if (!values) return;
    try {
      if (isAdminApiConfigured() && getOwnerCodeForPublish()) {
        const result = await adminApi.createApplication(activeCampaignId, values);
        applications.unshift(result.application);
      } else {
        const application = createApplication(values);
        applications.unshift(application);
        await saveLocalApps(activeCampaignId, applications);
      }
      renderBoard();
      renderCalendar(applications);
    } catch (error) {
      showToast(error.message || 'Could not add application', true);
    }
  });

  document.getElementById('google-connect')?.addEventListener('click', async () => {
    try {
      const result = await adminApi.googleStart();
      if (result.url) window.location.assign(result.url);
    } catch (error) {
      showToast(error.message || 'Could not start Google OAuth', true);
    }
  });

  document.getElementById('google-disconnect')?.addEventListener('click', async () => {
    try {
      await adminApi.googleDisconnect();
      await refreshGoogleStatus();
      showToast('Google disconnected');
    } catch (error) {
      showToast(error.message || 'Disconnect failed', true);
    }
  });

  document.getElementById('gmail-sync')?.addEventListener('click', async () => {
    try {
      const result = await adminApi.gmailSync();
      const root = document.getElementById('jobs-gmail');
      const list = document.getElementById('jobs-gmail-list');
      root.hidden = false;
      list.replaceChildren();
      (result.messages || []).forEach((message) => {
        const item = document.createElement('article');
        item.className = 'jobs-gmail-item';
        item.innerHTML = `
          <strong>${message.subject || '(no subject)'}</strong>
          <span>${message.from || ''}</span>
          <small>${message.date || ''}</small>
          <p class="admin-hint">${message.snippet || ''}</p>
          ${message.gmailUrl ? `<a href="${message.gmailUrl}" target="_blank" rel="noopener noreferrer">Open in Gmail</a>` : ''}
        `;
        list.append(item);
      });
      showToast(`Loaded ${result.messages?.length || 0} recruiting emails`);
    } catch (error) {
      showToast(error.message || 'Gmail sync failed', true);
    }
  });
}

function showBootError(message) {
  const errorEl = document.getElementById('admin-boot-error');
  const fallback = gate?.querySelector('[data-admin-fallback]');
  if (fallback) fallback.hidden = false;
  if (errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }
  if (gate) {
    gate.hidden = false;
    if (!gate.querySelector('.auth-gate') && !fallback) {
      gate.innerHTML = `<section class="admin-boot-fallback"><h1>Admin</h1><p class="admin-boot-error">${message}</p></section>`;
    }
  }
  console.error(message);
}

async function boot() {
  if (!gate || !shell) {
    throw new Error('Admin markup is missing #admin-gate or #admin-shell.');
  }

  // Prefer the fast local owner session — never block first paint on GitHub.
  let user = getOwnerSession();
  if (!user) {
    user = await requireResumeEditorAuth(gate);
  }
  if (!user) {
    const title = gate.querySelector('.auth-gate-title');
    const copy = gate.querySelector('.auth-gate-copy');
    if (title) title.textContent = 'Admin';
    if (copy) {
      copy.textContent = 'Enter your private owner code to open analytics, job search, and the resume editor.';
    }
    const fallback = gate.querySelector('[data-admin-fallback]');
    if (fallback) fallback.remove();
    return;
  }

  gate.replaceChildren();
  gate.hidden = true;
  shell.hidden = false;

  const name = getOwnerSession()?.login || user.login || 'Owner';
  document.querySelectorAll('[data-admin-name]').forEach((node) => {
    node.textContent = name;
  });

  // Show the shell immediately — never block analytics behind an optional code dialog.
  bindShell();
  const hash = location.hash || '#analytics';
  const initial = hash.replace('#', '').split('?')[0];
  showSection(['analytics', 'jobs', 'resume'].includes(initial) ? initial : 'analytics');

  if (getOwnerSession() && !getOwnerCodeForPublish() && isAdminApiConfigured()) {
    const values = await promptDialog({
      title: 'Confirm owner code',
      confirmLabel: 'Unlock APIs',
      fields: [{ name: 'code', label: 'Owner code', type: 'password', required: true }],
    });
    if (values?.code) {
      try {
        await unlockWithOwnerCode(values.code);
        showToast('Owner APIs unlocked');
      } catch (error) {
        showToast(error.message || 'Owner code rejected', true);
      }
    }
  }

  if (hash.includes('google=connected') || new URLSearchParams(location.search).get('google') === 'connected') {
    showToast('Google connected');
    history.replaceState(null, '', `${location.pathname}#${initial}`);
  }
}

boot().catch((error) => {
  showBootError(error?.message || 'Admin failed to boot. Hard-refresh and check the console.');
});
