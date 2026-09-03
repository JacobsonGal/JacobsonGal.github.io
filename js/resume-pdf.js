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
  if (window.innerWidth <= 720) {
    return Math.min(1.75, Math.max(1, dpr));
  }
  return Math.max(2, dpr);
}

function savePdfDocument(pdf, filename) {
  const safeName = sanitizePdfFilename(filename);
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);

  if (isIOS()) {
    const opened = window.open(url, '_blank');
    if (!opened) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.append(link);
      link.click();
      link.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'ios-open';
  }

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
  document.body.classList.add('resume-printing');
  await waitForLayout();
  window.print();
  window.setTimeout(() => {
    document.body.classList.remove('resume-printing');
  }, 500);
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
  const imgData = canvas.toDataURL('image/png');

  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
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
      imageTimeout: 15_000,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    addFullBleedImage(pdf, canvas);
    addLinkAnnotations(pdf, links, A4_WIDTH_PX, sheetHeightPx);
    return savePdfDocument(pdf, filename);
  } finally {
    host.remove();
  }
}

export function bindResumePdfDownload({ button, getResumeElement, refreshResume }) {
  if (!button) return;

  const defaultLabel = button.textContent?.trim() || 'Download PDF';
  const generatingLabel = isMobileDevice() ? 'Preparing…' : 'Generating…';
  button.removeAttribute('href');
  button.removeAttribute('download');

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = generatingLabel;

    try {
      const profile = await refreshResume?.();
      const resumeElement = getResumeElement?.();
      const filename = getResumePdfFilename(profile);
      const result = await downloadResumePdf({ element: resumeElement, filename });

      if (result === 'ios-open') {
        window.setTimeout(() => {
          window.alert('Your CV opened in a new tab. Tap Share, then "Save to Files" to download the PDF.');
        }, 300);
      }
    } catch (error) {
      console.error(error);
      if (isMobileDevice()) {
        try {
          await printResumeFallback();
          return;
        } catch (printError) {
          console.error(printError);
        }
      }
      window.alert('Could not generate the CV PDF. Please try again in a moment.');
    } finally {
      button.disabled = false;
      button.textContent = defaultLabel;
    }
  });
}
