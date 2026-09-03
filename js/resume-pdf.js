const PDF_LIBRARY_URLS = {
  html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm',
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PX_PER_MM = 96 / 25.4;
const A4_WIDTH_PX = Math.round(A4_WIDTH_MM * PX_PER_MM);
const A4_HEIGHT_PX = Math.round(A4_HEIGHT_MM * PX_PER_MM);

let pdfLibrariesPromise;

function loadPdfLibraries() {
  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = Promise.all([
      import(PDF_LIBRARY_URLS.html2canvas),
      import(PDF_LIBRARY_URLS.jspdf),
    ]).then(([html2canvasModule, jspdfModule]) => ({
      html2canvas: html2canvasModule.default,
      jsPDF: jspdfModule.jsPDF,
    }));
  }
  return pdfLibrariesPromise;
}

export function getResumePdfFilename(profile) {
  const name = profile?.name?.trim() || 'Gal Jacobson';
  return `${name} - CV.pdf`;
}

function sanitizePdfFilename(filename) {
  return filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isMobileDevice() {
  return isIOS() || /Android/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 0 && window.innerWidth <= 720);
}

function getPdfRenderScale() {
  const dpr = window.devicePixelRatio || 1;
  if (isMobileDevice()) {
    return Math.min(1.25, Math.max(1, dpr * 0.85));
  }
  return Math.max(2, dpr);
}

function canSharePdfFile(file) {
  return typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });
}

async function sharePdfFile(blob, filename) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (!canSharePdfFile(file)) return false;

  try {
    await navigator.share({
      files: [file],
      title: filename,
    });
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return true;
    return false;
  }
}

function showPdfPreview(blob, filename) {
  const safeName = sanitizePdfFilename(filename);
  const url = URL.createObjectURL(blob);
  const overlay = document.createElement('div');
  overlay.className = 'resume-pdf-preview';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'CV PDF preview');

  overlay.innerHTML = `
    <div class="resume-pdf-preview-panel">
      <div class="resume-pdf-preview-bar">
        <p class="resume-pdf-preview-copy">Use the viewer menu to save or share this PDF.</p>
        <button type="button" class="resume-btn resume-pdf-preview-close">Close</button>
      </div>
      <iframe class="resume-pdf-preview-frame" title="${safeName}" src="${url}"></iframe>
    </div>
  `;

  const close = () => {
    overlay.remove();
    URL.revokeObjectURL(url);
  };

  overlay.querySelector('.resume-pdf-preview-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  document.body.append(overlay);
  return 'preview';
}

async function savePdfDocument(pdf, filename) {
  const safeName = sanitizePdfFilename(filename);
  const blob = pdf.output('blob');

  if (isMobileDevice() && await sharePdfFile(blob, safeName)) {
    return 'share';
  }

  if (!isMobileDevice()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'download';
  }

  if (isIOS()) {
    return showPdfPreview(blob, safeName);
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'download';
}

async function printResumeFallback() {
  window.scrollTo(0, 0);
  document.body.classList.add('resume-printing');
  await waitForLayout();
  await document.fonts.ready;
  window.print();
  window.setTimeout(() => {
    document.body.classList.remove('resume-printing');
  }, 500);
}

async function saveResumeOnMobile() {
  await printResumeFallback();
  return 'print';
}

function waitForLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function createRenderSheet(source) {
  const host = document.createElement('div');
  host.className = 'resume-pdf-render-host';
  host.setAttribute('aria-hidden', 'true');

  const clone = source.cloneNode(true);
  clone.classList.add('resume-sheet--pdf');
  host.append(clone);
  document.body.append(host);

  return { host, sheet: clone };
}

function collectLinkRects(root) {
  const rootRect = root.getBoundingClientRect();

  return [...root.querySelectorAll('a[href]')]
    .map((anchor) => {
      const rect = anchor.getBoundingClientRect();
      return {
        href: anchor.href,
        left: rect.left - rootRect.left,
        top: rect.top - rootRect.top,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((link) => link.href && link.width > 0 && link.height > 0);
}

function addFullBleedImage(pdf, canvas) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const useJpeg = isMobileDevice();
  const format = useJpeg ? 'JPEG' : 'PNG';
  const imgData = useJpeg
    ? canvas.toDataURL('image/jpeg', 0.92)
    : canvas.toDataURL('image/png');

  pdf.addImage(imgData, format, 0, 0, pageWidth, pageHeight);
}

function addLinkAnnotations(pdf, links, sheetWidthPx, sheetHeightPx) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  links.forEach(({ href, left, top, width, height }) => {
    const x = (left / sheetWidthPx) * pageWidth;
    const y = (top / sheetHeightPx) * pageHeight;
    const w = (width / sheetWidthPx) * pageWidth;
    const h = (height / sheetHeightPx) * pageHeight;

    pdf.link(x, y, w, h, { url: href });
  });
}

export async function downloadResumePdf({ element, filename }) {
  if (!element) {
    throw new Error('Resume content is not ready yet.');
  }

  await document.fonts.ready;

  const { html2canvas, jsPDF } = await loadPdfLibraries();
  const { host, sheet } = createRenderSheet(element);

  try {
    await waitForLayout();

    const sheetHeightPx = Math.max(sheet.scrollHeight, A4_HEIGHT_PX);
    const links = collectLinkRects(sheet);
    const scale = getPdfRenderScale();

    const canvas = await html2canvas(sheet, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: A4_WIDTH_PX,
      height: sheetHeightPx,
      windowWidth: A4_WIDTH_PX,
      windowHeight: sheetHeightPx,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: isMobileDevice() ? 30_000 : 15_000,
      foreignObjectRendering: false,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    addFullBleedImage(pdf, canvas);
    addLinkAnnotations(pdf, links, A4_WIDTH_PX, sheetHeightPx);
    return await savePdfDocument(pdf, filename);
  } finally {
    host.remove();
  }
}

export function bindResumePdfDownload({ button, getResumeElement, refreshResume }) {
  if (!button) return;

  const mobile = isMobileDevice();
  const defaultLabel = mobile ? 'Save PDF' : (button.textContent?.trim() || 'Download PDF');
  const generatingLabel = mobile ? 'Opening…' : 'Generating…';
  button.textContent = defaultLabel;
  button.removeAttribute('href');
  button.removeAttribute('download');

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = generatingLabel;

    try {
      const profile = await refreshResume?.();

      if (mobile) {
        await saveResumeOnMobile();
        window.setTimeout(() => {
          window.alert('In the print preview, tap Share (top right), then choose Save to Files to save your CV as a PDF.');
        }, 500);
        return;
      }

      const resumeElement = getResumeElement?.();
      const filename = getResumePdfFilename(profile);
      const result = await downloadResumePdf({ element: resumeElement, filename });

      if (result === 'share') {
        return;
      }

      if (result === 'preview') {
        window.setTimeout(() => {
          window.alert('Your CV opened below. Tap the share icon in the PDF viewer, then choose "Save to Files".');
        }, 300);
      }
    } catch (error) {
      console.error(error);
      try {
        await printResumeFallback();
        window.setTimeout(() => {
          window.alert('Use the print preview Share button, then Save to Files.');
        }, 500);
      } catch (printError) {
        console.error(printError);
        window.alert('Could not save the CV PDF. Please try again in a moment.');
      }
    } finally {
      button.disabled = false;
      button.textContent = defaultLabel;
    }
  });
}
