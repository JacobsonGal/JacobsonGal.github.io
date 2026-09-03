(function addCvDownloadLink() {
  const CV_HREF = '/cv/gal-jacobson-cv.pdf';
  const CV_LABEL = 'CV';

  function tryInject() {
    const links = [...document.querySelectorAll('a[href]')];
    const linkedIn = links.find((a) => a.href.includes('linkedin.com/in/jacobsongal'));
    if (!linkedIn) return false;

    const existing = links.find((a) => a.href.includes('gal-jacobson-cv.pdf'));
    if (existing) return true;

    const cvLink = linkedIn.cloneNode(true);
    cvLink.href = CV_HREF;
    cvLink.setAttribute('download', 'gal-jacobson-cv.pdf');
    cvLink.target = '_blank';
    cvLink.rel = 'noopener noreferrer';

    const labelNodes = [...cvLink.querySelectorAll('*'), cvLink];
    labelNodes.forEach((node) => {
      if (node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE) {
        node.textContent = CV_LABEL;
      }
    });
    if (cvLink.textContent.trim().toUpperCase().includes('LINKEDIN')) {
      cvLink.textContent = CV_LABEL;
    }

    linkedIn.parentElement.insertBefore(cvLink, linkedIn.nextSibling);
    return true;
  }

  if (tryInject()) return;

  const observer = new MutationObserver(() => {
    if (tryInject()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
})();
