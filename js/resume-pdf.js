import { asset } from './profile-store.js';

const DEFAULT_PDF_PATH = 'assets/documents/Gal-Jacobson-Resume.pdf';
const DEFAULT_DOWNLOAD_NAME = 'Gal-Jacobson-Resume.pdf';

export function getResumePdfPath(profile) {
  return profile?.urls?.cvPdf || DEFAULT_PDF_PATH;
}

export function bindResumePdfDownload(link, profile) {
  if (!link) return;

  const pdfPath = getResumePdfPath(profile);
  link.href = asset(pdfPath);
  link.download = DEFAULT_DOWNLOAD_NAME;
}
