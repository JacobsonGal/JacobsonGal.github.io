const MODAL_ID = 'link-modal';

function parseHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function shouldHandleLink(anchor) {
  if (!anchor || anchor.tagName !== 'A') return false;
  if (anchor.dataset.linkModal === 'skip') return false;
  if (anchor.closest('[data-link-modal-skip]')) return false;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;

  let url;
  try {
    url = new URL(anchor.href);
  } catch {
    return false;
  }

  if (url.protocol === 'mailto:') return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  return url.origin !== window.location.origin;
}

function createModal() {
  const root = document.createElement('div');
  root.id = MODAL_ID;
  root.className = 'link-modal';
  root.hidden = true;
  root.innerHTML = `
    <button type="button" class="link-modal__backdrop" aria-label="Close preview"></button>
    <div class="link-modal__panel" role="dialog" aria-modal="true" aria-labelledby="link-modal-title">
      <header class="link-modal__header">
        <p class="link-modal__title mono-label" id="link-modal-title"></p>
        <div class="link-modal__actions">
          <a class="link-modal__action link-modal__open" href="#" target="_blank" rel="noopener noreferrer">Open tab</a>
          <button type="button" class="link-modal__action link-modal__close" aria-label="Close preview">&times;</button>
        </div>
      </header>
      <div class="link-modal__body">
        <p class="link-modal__loading mono-label" aria-live="polite">Loading preview…</p>
        <iframe class="link-modal__frame" title="Link preview" hidden></iframe>
        <div class="link-modal__fallback" hidden>
          <p class="link-modal__fallback-copy">This site can't be embedded here.</p>
          <a class="link-modal__fallback-open" href="#" target="_blank" rel="noopener noreferrer">Open in new tab</a>
        </div>
      </div>
    </div>
    <div class="link-modal__panel link-modal__panel--compact" role="dialog" aria-modal="true" aria-labelledby="link-modal-mail-title" hidden>
      <header class="link-modal__header">
        <p class="link-modal__title mono-label" id="link-modal-mail-title">Email</p>
        <button type="button" class="link-modal__action link-modal__close" aria-label="Close">&times;</button>
      </header>
      <div class="link-modal__mail-body">
        <a class="link-modal__mail-link" href="#"></a>
      </div>
    </div>
  `;
  document.body.append(root);
  return root;
}

export function mountLinkModal({ root = document } = {}) {
  const modal = document.getElementById(MODAL_ID) || createModal();
  const backdrop = modal.querySelector('.link-modal__backdrop');
  const panel = modal.querySelector('.link-modal__panel:not(.link-modal__panel--compact)');
  const mailPanel = modal.querySelector('.link-modal__panel--compact');
  const titleEl = panel.querySelector('.link-modal__title');
  const openTab = panel.querySelector('.link-modal__open');
  const closeButtons = modal.querySelectorAll('.link-modal__close');
  const frame = panel.querySelector('.link-modal__frame');
  const loading = panel.querySelector('.link-modal__loading');
  const fallback = panel.querySelector('.link-modal__fallback');
  const fallbackOpen = panel.querySelector('.link-modal__fallback-open');
  const mailLink = mailPanel.querySelector('.link-modal__mail-link');

  let lastFocus = null;
  let blockTimer = null;

  const resetFrame = () => {
    window.clearTimeout(blockTimer);
    frame.hidden = true;
    frame.removeAttribute('src');
    loading.hidden = false;
    fallback.hidden = true;
  };

  const close = () => {
    modal.hidden = true;
    panel.hidden = false;
    mailPanel.hidden = true;
    resetFrame();
    document.body.classList.remove('link-modal-open');
    lastFocus?.focus?.();
    lastFocus = null;
  };

  const showBlocked = (href) => {
    loading.hidden = true;
    frame.hidden = true;
    fallback.hidden = false;
    fallbackOpen.href = href;
  };

  const openExternal = (href, label) => {
    lastFocus = document.activeElement;
    modal.hidden = false;
    panel.hidden = false;
    mailPanel.hidden = true;
    document.body.classList.add('link-modal-open');

    const displayTitle = label?.trim() || parseHostname(href);
    titleEl.textContent = displayTitle;
    openTab.href = href;
    fallbackOpen.href = href;
    resetFrame();
    frame.title = displayTitle;
    frame.src = href;

    blockTimer = window.setTimeout(() => {
      try {
        const doc = frame.contentDocument;
        if (doc && !doc.body?.childElementCount) showBlocked(href);
      } catch {
        // Cross-origin load — treat as success.
        loading.hidden = true;
        frame.hidden = false;
      }
    }, 2500);

    frame.onload = () => {
      window.clearTimeout(blockTimer);
      try {
        const doc = frame.contentDocument;
        if (doc && doc.body && doc.body.childElementCount === 0) {
          showBlocked(href);
          return;
        }
      } catch {
        // Framed page loaded from another origin.
      }
      loading.hidden = true;
      frame.hidden = false;
    };

    closeButtons[0]?.focus();
  };

  const openMailto = (href) => {
    lastFocus = document.activeElement;
    modal.hidden = false;
    panel.hidden = true;
    mailPanel.hidden = false;
    document.body.classList.add('link-modal-open');
    mailLink.textContent = href.replace(/^mailto:/i, '');
    mailLink.href = href;
    closeButtons[1]?.focus();
  };

  const onClick = (event) => {
    const anchor = event.target.closest('a');
    if (!shouldHandleLink(anchor)) return;
    if (!root.contains(anchor)) return;

    event.preventDefault();
    event.stopPropagation();

    const href = anchor.href;
    if (href.startsWith('mailto:')) {
      openMailto(href);
      return;
    }
    openExternal(href, anchor.textContent);
  };

  root.addEventListener('click', onClick, true);

  backdrop.addEventListener('click', close);
  closeButtons.forEach((btn) => btn.addEventListener('click', close));

  window.addEventListener('keydown', (event) => {
    if (modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });
}
