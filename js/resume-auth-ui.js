import {
  getAuthorizedUser,
  isAuthConfigured,
  pollDeviceFlow,
  signOut,
  startDeviceFlow,
} from './github-auth.js';
import { mountThemePicker } from './theme-picker.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export async function mountResumeAuthToolbar(toolbarActions) {
  const user = await getAuthorizedUser();

  toolbarActions.querySelectorAll('[data-auth-ui]').forEach((node) => node.remove());

  if (user) {
    const editLink = el('a', 'resume-btn');
    editLink.dataset.authUi = 'true';
    editLink.href = 'edit-resume.html';
    editLink.textContent = 'Edit resume';

    const signOutBtn = el('button', 'resume-btn resume-btn--ghost', 'Sign out');
    signOutBtn.dataset.authUi = 'true';
    signOutBtn.type = 'button';
    signOutBtn.addEventListener('click', async () => {
      signOut();
      await mountResumeAuthToolbar(toolbarActions);
    });

    toolbarActions.append(editLink, signOutBtn);
    mountThemePicker(toolbarActions);
    return user;
  }

  return null;
}

export async function requireResumeEditorAuth(root) {
  const user = await getAuthorizedUser();
  if (user) return user;

  root.replaceChildren();
  const gate = el('section', 'auth-gate');
  const title = el('h1', 'auth-gate-title', 'Edit resume');
  const copy = el('p', 'auth-gate-copy', 'Sign in with GitHub to edit your resume. Only the site owner can access the editor.');

  gate.append(title, copy);

  if (!isAuthConfigured()) {
    const setup = el('p', 'auth-gate-error', 'GitHub OAuth is not configured. Add your OAuth App Client ID to js/auth-config.js.');
    gate.append(setup);
    root.append(gate);
    return null;
  }

  const signInBtn = el('button', 'resume-btn resume-btn--primary', 'Sign in with GitHub');
  signInBtn.type = 'button';
  signInBtn.addEventListener('click', () => {
    showDeviceFlowDialog(async () => {
      const authed = await getAuthorizedUser({ forceRefresh: true });
      if (authed) window.location.reload();
    });
  });

  const back = el('a', 'resume-btn', '← Back to resume');
  back.href = 'resume.html';

  gate.append(signInBtn, back);
  root.append(gate);
  return null;
}

function showDeviceFlowDialog(onSuccess) {
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
