import { loadProfile } from './profile-store.js';
import { renderResumeHtml } from './resume-template.js';
import { mountResumeAuthToolbar } from './resume-auth-ui.js';
import { mountOwnerSecretEntry } from './owner-secret-entry.js';
import { bindResumePdfDownload } from './resume-pdf.js';
import { mountAppearanceToggle } from './appearance.js';
import './theme-init.js';

let resumeCleanup = null;

export async function mountResumePage() {
  if (resumeCleanup) {
    destroyResumePage();
  }

  const root = document.getElementById('resume-root');
  const toolbarActions = document.querySelector('.resume-toolbar-actions');
  if (!root) return;

  mountAppearanceToggle(document.getElementById('appearance-tools'));
  const profile = await loadProfile({ preferDraft: true });

  document.title = `${profile.name} — Resume`;
  root.innerHTML = renderResumeHtml(profile);

  async function refreshResumeForPdf() {
    const freshProfile = await loadProfile({ preferDraft: true });
    root.innerHTML = renderResumeHtml(freshProfile);
    await document.fonts.ready;
    return freshProfile;
  }

  bindResumePdfDownload({
    button: document.getElementById('download-resume-pdf'),
    getResumeElement: () => document.querySelector('.resume-sheet'),
    refreshResume: refreshResumeForPdf,
  });

  await mountResumeAuthToolbar(toolbarActions);

  mountOwnerSecretEntry({
    selectors: [
      '.resume-name-block .resume-name-line:first-child',
    ],
    onAuthed: () => mountResumeAuthToolbar(toolbarActions),
  });

  const onPageshow = async (event) => {
    if (!event.persisted) return;
    const freshProfile = await loadProfile({ preferDraft: true });
    root.innerHTML = renderResumeHtml(freshProfile);
    document.title = `${freshProfile.name} — Resume`;
  };
  window.addEventListener('pageshow', onPageshow);

  resumeCleanup = () => {
    window.removeEventListener('pageshow', onPageshow);
    resumeCleanup = null;
  };
}

export function destroyResumePage() {
  resumeCleanup?.();
}
