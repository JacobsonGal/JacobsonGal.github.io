import { fetchServerProfile, loadProfile } from './profile-store.js';
import { renderResumeHtml } from './resume-template.js';
import { mountResumeAuthToolbar } from './resume-auth-ui.js';
import { mountOwnerSecretEntry } from './owner-secret-entry.js';
import { bindResumePdfDownload } from './resume-pdf.js';
import './theme-init.js';

const root = document.getElementById('resume-root');
const toolbarActions = document.querySelector('.resume-toolbar-actions');
const profile = await loadProfile({ preferDraft: false });

document.title = `${profile.name} — Resume`;
root.innerHTML = renderResumeHtml(profile);

async function refreshResumeFromGithub() {
  const freshProfile = await fetchServerProfile();
  root.innerHTML = renderResumeHtml(freshProfile);
  await document.fonts.ready;
  return freshProfile;
}

bindResumePdfDownload({
  button: document.getElementById('download-resume-pdf'),
  getResumeElement: () => document.querySelector('#resume-root .resume-sheet'),
  refreshResume: refreshResumeFromGithub,
});

await mountResumeAuthToolbar(toolbarActions);

mountOwnerSecretEntry({
  selectors: [
    '.resume-name-block .resume-name-line:first-child',
  ],
  corners: ['bl'],
  onAuthed: () => mountResumeAuthToolbar(toolbarActions),
});
