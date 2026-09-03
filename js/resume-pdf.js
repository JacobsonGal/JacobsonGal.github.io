const PDF_LIBRARY_URLS = {
  html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm',
};

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

function addCanvasToPdf(pdf, canvas, pageWidth, pageHeight) {
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
}

export async function downloadResumePdf({ element, filename }) {
  if (!element) {
    throw new Error('Resume content is not ready yet.');
  }

  const { html2canvas, jsPDF } = await loadPdfLibraries();
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  addCanvasToPdf(pdf, canvas, pageWidth, pageHeight);
  pdf.save(filename);
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
