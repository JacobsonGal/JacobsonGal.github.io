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

function addCanvasToSinglePage(pdf, canvas) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/png');

  const widthAtFullBleed = pageWidth;
  const heightAtFullBleed = (canvas.height * widthAtFullBleed) / canvas.width;
  const scale = Math.min(1, pageHeight / heightAtFullBleed);
  const width = widthAtFullBleed * scale;
  const height = heightAtFullBleed * scale;

  pdf.addImage(imgData, 'PNG', 0, 0, width, height);
}

export async function downloadResumePdf({ element, filename }) {
  if (!element) {
    throw new Error('Resume content is not ready yet.');
  }

  await document.fonts.ready;

  const { html2canvas, jsPDF } = await loadPdfLibraries();
  document.body.classList.add('resume-pdf-capture');

  try {
    const canvas = await html2canvas(element, {
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true,
      backgroundColor: null,
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (doc) => {
        const sheet = doc.querySelector('.resume-sheet');
        if (sheet) {
          sheet.style.boxShadow = 'none';
          sheet.style.margin = '0';
        }
      },
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    addCanvasToSinglePage(pdf, canvas);
    pdf.save(filename);
  } finally {
    document.body.classList.remove('resume-pdf-capture');
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
