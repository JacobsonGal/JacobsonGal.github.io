import { loadProfile } from './profile-store.js';
import { renderResumeHtml } from './resume-template.js';
import { mountResumeAuthToolbar } from './resume-auth-ui.js';
import './theme-init.js';

const root = document.getElementById('resume-root');
const toolbarActions = document.querySelector('.resume-toolbar-actions');
const profile = await loadProfile({ preferDraft: false });

document.title = `${profile.name} — Resume`;
root.innerHTML = renderResumeHtml(profile);

document.getElementById('print-resume').addEventListener('click', () => window.print());
await mountResumeAuthToolbar(toolbarActions);
