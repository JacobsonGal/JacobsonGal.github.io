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
  return `${name} | CV.pdf`;
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
    const scale = Math.max(2, window.devicePixelRatio || 1);

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
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    addFullBleedImage(pdf, canvas);
    addLinkAnnotations(pdf, links, A4_WIDTH_PX, sheetHeightPx);
    pdf.save(filename);
  } finally {
    host.remove();
  }
}

export function bindResumePdfDownload({ button, getResumeElement, refreshResume }) {
  if (!button) return;

  const defaultLabel = button.textContent?.trim() || 'Download PDF';
  button.removeAttribute('href');
  button.removeAttribute('download');

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = 'Generating…';

    try {
      const profile = await refreshResume?.();
      const resumeElement = getResumeElement?.();
      const filename = getResumePdfFilename(profile);
      await downloadResumePdf({ element: resumeElement, filename });
    } catch (error) {
      console.error(error);
      window.alert('Could not generate the CV PDF. Please try again in a moment.');
    } finally {
      button.disabled = false;
      button.textContent = defaultLabel;
    }
  });
}
