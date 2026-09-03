export function getResumePdfFilename(profile) {
  const name = profile?.name?.trim() || 'Gal Jacobson';
  return `${name} | CV.pdf`;
}

function waitForPrintDialogClose() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('afterprint', finish);
      resolve();
    };

    window.addEventListener('afterprint', finish, { once: true });
    window.setTimeout(finish, 1200);
  });
}

export async function printResumePdf({ filename }) {
  await document.fonts.ready;

  const previousTitle = document.title;
  document.title = filename.replace(/\.pdf$/i, '');
  document.body.classList.add('resume-printing');

  try {
    window.print();
    await waitForPrintDialogClose();
  } finally {
    document.body.classList.remove('resume-printing');
    document.title = previousTitle;
  }
}

export function bindResumePdfDownload({ button, refreshResume }) {
  if (!button) return;

  const defaultLabel = button.textContent?.trim() || 'Download PDF';
  button.removeAttribute('href');
  button.removeAttribute('download');

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = 'Preparing…';

    try {
      const profile = await refreshResume?.();
      const filename = getResumePdfFilename(profile);
      await printResumePdf({ filename });
    } catch (error) {
      console.error(error);
      window.alert('Could not open the PDF print dialog. Please try again in a moment.');
    } finally {
      button.disabled = false;
      button.textContent = defaultLabel;
    }
  });
}
