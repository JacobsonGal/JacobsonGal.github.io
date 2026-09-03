const COMPANY_ICONS = {
  houzz: 'assets/images/companies/houzz.png',
  colman: 'assets/images/companies/colman.png',
  yavo: 'assets/images/companies/yavo.png',
  idf: 'assets/images/companies/idf.svg',
};

export function companyIconPath(id) {
  return COMPANY_ICONS[id] || null;
}

export function companyIconMarkup(id, basePath = '', options = {}) {
  const {
    className = 'exp-icon',
    width = 40,
    height = 40,
  } = options;
  const path = companyIconPath(id);
  if (!path) return '';
  const src = `${basePath}${path}`;
  return `<img class="${className}" src="${src}" alt="" width="${width}" height="${height}" loading="lazy" decoding="async" />`;
}
