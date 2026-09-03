const COMPANY_ICONS = {
  houzz: 'assets/images/companies/houzz.svg',
  colman: 'assets/images/companies/colman.svg',
  yavo: 'assets/images/companies/yavo.svg',
  idf: 'assets/images/companies/idf.svg',
};

export function companyIconPath(id) {
  return COMPANY_ICONS[id] || null;
}

export function companyIconMarkup(id, basePath = '') {
  const path = companyIconPath(id);
  if (!path) return '';
  const src = `${basePath}${path}`;
  return `<img class="exp-icon" src="${src}" alt="" width="40" height="40" loading="lazy" decoding="async" />`;
}
