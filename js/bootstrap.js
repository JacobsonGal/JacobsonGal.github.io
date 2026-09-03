import { bootCurrentPage, initSiteRouter } from './site-router.js';

initSiteRouter();

bootCurrentPage().catch((error) => {
  console.error('Portfolio router failed to boot', error);
});
