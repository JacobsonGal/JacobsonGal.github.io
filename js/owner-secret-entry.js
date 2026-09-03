import { openResumeEditorFlow } from './resume-auth-ui.js';

const TRIPLE_CLICK = 3;

function bindTripleClick(target, handler) {
  if (!target) return;
  target.addEventListener('click', (event) => {
    if (event.detail !== TRIPLE_CLICK) return;
    event.preventDefault();
    handler();
  });
}

function addCornerHit({ corner, onActivate }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `owner-secret-hit owner-secret-hit--${corner}`;
  button.setAttribute('aria-hidden', 'true');
  button.tabIndex = -1;
  button.addEventListener('click', onActivate);
  document.body.append(button);
  return button;
}

export function mountOwnerSecretEntry({ selectors = [], corners = [], onAuthed } = {}) {
  let opening = false;

  const activate = async () => {
    if (opening) return;
    opening = true;
    try {
      await openResumeEditorFlow({
        onAuthed,
      });
    } finally {
      opening = false;
    }
  };

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => bindTripleClick(node, activate));
  });

  corners.forEach((corner) => addCornerHit({ corner, onActivate: activate }));
}
