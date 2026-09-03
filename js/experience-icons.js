const COMPANY_ICONS = {
  houzz: 'assets/images/companies/houzz.png',
  colman: 'assets/images/companies/colman.png',
  yavo: 'assets/images/companies/yavo-logo.png',
  idf: 'assets/images/companies/idf.svg',
};

const COMPANY_URLS = {
  houzz: 'https://pro.houzz.com',
};

const FEATURE_LINKS = {
  Contracts: 'https://pro.houzz.com/for-pros/feature-contracts',
};

const CONTAIN_LOGO_IDS = new Set(['colman', 'yavo', 'idf']);
const ICON_CACHE_VERSION = '20260903d';

export function companyIconPath(id) {
  return COMPANY_ICONS[id] || null;
}

export function companyUrl(id) {
  return COMPANY_URLS[id] || null;
}

export function companyLinkMarkup(company, id, className = '') {
  const url = companyUrl(id);
  const classAttr = className ? ` class="${className}"` : '';
  if (!url) return `<span${classAttr}>${company}</span>`;
  return `<a${classAttr} href="${url}" target="_blank" rel="noopener noreferrer" data-company-link>${company}</a>`;
}

export function featureLinkUrl(label) {
  return FEATURE_LINKS[label] || null;
}

export function highlightLinkMarkup(label, className = 'tag') {
  const url = featureLinkUrl(label);
  if (!url) return `<span class="${className}">${label}</span>`;
  return `<a class="${className}" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

export function companyIconMarkup(id, basePath = '', options = {}) {
  const {
    className = 'exp-icon',
    width = 40,
    height = 40,
  } = options;
  const path = companyIconPath(id);
  if (!path) return '';
  const src = `${basePath}${path}?v=${ICON_CACHE_VERSION}`;
  const containClass = CONTAIN_LOGO_IDS.has(id) ? ' exp-icon--contain' : '';
  const logoClass = id ? ` exp-icon--logo-${id}` : '';
  const classes = `${className}${containClass}${logoClass}`;
  return `<img class="${classes}" src="${src}" alt="" width="${width}" height="${height}" loading="lazy" decoding="async" />`;
}
