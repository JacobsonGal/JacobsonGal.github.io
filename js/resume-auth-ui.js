import {
  getAuthorizedUser,
  isAuthConfigured,
  pollDeviceFlow,
  signOut,
  startDeviceFlow,
} from './github-auth.js';
import { isOwnerAuthConfigured, unlockWithOwnerCode } from './owner-auth.js';
import { mountThemePicker } from './theme-picker.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function mountOwnerActions(container, { onSignOut } = {}) {
  container.querySelectorAll('[data-auth-ui]').forEach((node) => node.remove());

  const editLink = el('a', 'owner-tool-link resume-btn');
  editLink.dataset.authUi = 'true';
  editLink.href = 'edit-resume.html';
  editLink.textContent = 'Edit resume';

  const signOutBtn = el('button', 'owner-tool-link resume-btn resume-btn--ghost', 'Sign out');
  signOutBtn.dataset.authUi = 'true';
  signOutBtn.type = 'button';
  signOutBtn.addEventListener('click', async () => {
    signOut();
    if (onSignOut) await onSignOut();
  });

  container.prepend(editLink, signOutBtn);
  mountThemePicker(container);
}

export async function mountOwnerToolbar(container) {
  if (!container) return null;

  const user = await getAuthorizedUser();
  container.replaceChildren();

  if (!user) return null;

  mountOwnerActions(container, {
    onSignOut: async () => {
      container.replaceChildren();
    },
  });

  return user;
}

export async function mountResumeAuthToolbar(toolbarActions) {
  const user = await getAuthorizedUser();

  toolbarActions.querySelectorAll('[data-auth-ui]').forEach((node) => node.remove());

  if (user) {
    mountOwnerActions(toolbarActions, {
      onSignOut: async () => {
        await mountResumeAuthToolbar(toolbarActions);
      },
    });
    return user;
  }

  return null;
}

function isUnlockConfigured() {
  return isOwnerAuthConfigured() || isAuthConfigured();
}

export async function requireResumeEditorAuth(root) {
  const user = await getAuthorizedUser();
  if (user) return user;

  root.replaceChildren();
  const gate = el('section', 'auth-gate');
  const title = el('h1', 'auth-gate-title', 'Edit resume');
  const copy = el('p', 'auth-gate-copy', 'Unlock the editor with your private owner code.');

  gate.append(title, copy);

  if (!isUnlockConfigured()) {
    const setup = el('p', 'auth-gate-error', 'Owner unlock is not configured. Set OWNER_UNLOCK_HASH in js/auth-config.js.');
    gate.append(setup);
    root.append(gate);
    return null;
  }

  gate.append(createOwnerUnlockForm(async () => {
    const authed = await getAuthorizedUser();
    if (authed) window.location.reload();
  }));

  if (isAuthConfigured()) {
    const githubBtn = el('button', 'resume-btn', 'Sign in with GitHub instead');
    githubBtn.type = 'button';
    githubBtn.addEventListener('click', () => {
      promptGitHubSignIn(async () => {
        const authed = await getAuthorizedUser({ forceRefresh: true });
        if (authed) window.location.reload();
      });
    });
    gate.append(githubBtn);
  }

  const back = el('a', 'resume-btn', '← Back to resume');
  back.href = 'resume.html';

  gate.append(back);
  root.append(gate);
  return null;
}

export async function openResumeEditorFlow({ redirectTo = 'edit-resume.html', onAuthed } = {}) {
  const user = await getAuthorizedUser();
  if (user) {
    if (onAuthed) await onAuthed(user);
    if (redirectTo) window.location.href = redirectTo;
    return user;
  }

  if (!isUnlockConfigured()) return null;

  return new Promise((resolve) => {
    promptOwnerUnlock(async () => {
      const authed = await getAuthorizedUser();
      if (!authed) {
        resolve(null);
        return;
      }
      if (onAuthed) await onAuthed(authed);
      if (redirectTo) window.location.href = redirectTo;
      resolve(authed);
    });
  });
}

function createOwnerUnlockForm(onSuccess) {
  const form = el('form', 'auth-unlock-form');
  const label = el('label', 'auth-unlock-label', 'Owner code');
  const input = el('input', 'auth-unlock-input');
  input.type = 'password';
  input.name = 'ownerCode';
  input.autocomplete = 'off';
  input.required = true;
  label.append(input);

  const status = el('p', 'auth-dialog-status', '');
  const submit = el('button', 'resume-btn resume-btn--primary', 'Unlock editor');
  submit.type = 'submit';

  form.append(label, status, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    try {
      await unlockWithOwnerCode(input.value);
      if (onSuccess) await onSuccess();
    } catch (error) {
      status.textContent = error.message || 'Unlock failed.';
    }
  });

  return form;
}

export function promptOwnerUnlock(onSuccess) {
  const overlay = el('div', 'auth-overlay');
  const dialog = el('div', 'auth-dialog');
  const title = el('h2', 'auth-dialog-title', 'Owner access');
  const copy = el('p', 'auth-dialog-status', 'Enter your private owner code to edit the resume.');
  const actions = el('div', 'auth-dialog-actions');
  const cancelBtn = el('button', 'resume-btn', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const form = createOwnerUnlockForm(async () => {
    overlay.remove();
    if (onSuccess) await onSuccess();
  });

  actions.append(cancelBtn);
  dialog.append(title, copy, form);

  if (isAuthConfigured()) {
    const githubBtn = el('button', 'resume-btn', 'Sign in with GitHub instead');
    githubBtn.type = 'button';
    githubBtn.addEventListener('click', () => {
      overlay.remove();
      promptGitHubSignIn(onSuccess);
    });
    actions.prepend(githubBtn);
  }

  dialog.append(actions);
  overlay.append(dialog);
  document.body.append(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });

  form.querySelector('.auth-unlock-input')?.focus();
}

export function promptGitHubSignIn(onSuccess) {
  const overlay = el('div', 'auth-overlay');
  const dialog = el('div', 'auth-dialog');
  const title = el('h2', 'auth-dialog-title', 'Sign in with GitHub');
  const status = el('p', 'auth-dialog-status', 'Starting sign-in…');
  const codeBox = el('p', 'auth-code', '');
  const actions = el('div', 'auth-dialog-actions');
  const openBtn = el('a', 'resume-btn resume-btn--primary', 'Open GitHub');
  openBtn.href = 'https://github.com/login/device';
  openBtn.target = '_blank';
  openBtn.rel = 'noopener noreferrer';
  openBtn.hidden = true;

  const cancelBtn = el('button', 'resume-btn', 'Cancel');
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', () => overlay.remove());

  actions.append(openBtn, cancelBtn);
  dialog.append(title, status, codeBox, actions);
  overlay.append(dialog);
  document.body.append(overlay);

  let cancelled = false;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      cancelled = true;
      overlay.remove();
    }
  });

  (async () => {
    try {
      const flow = await startDeviceFlow();
      if (cancelled) return;

      codeBox.textContent = flow.user_code;
      status.textContent = `Enter this code on GitHub, then approve access for @JacobsonGal.`;
      openBtn.href = flow.verification_uri;
      openBtn.hidden = false;

      await pollDeviceFlow(flow.device_code, flow.interval || 5);
      if (cancelled) return;

      overlay.remove();
      if (onSuccess) await onSuccess();
    } catch (error) {
      status.textContent = error.message || 'GitHub sign-in failed.';
      codeBox.textContent = '';
    }
  })();
}
