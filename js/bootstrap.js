import { ASSET_VERSION } from './asset-version.js';

const { bootCurrentPage, initSiteRouter } = await import(`./site-router.js?v=${ASSET_VERSION}`);

initSiteRouter();

bootCurrentPage().catch((error) => {
  console.error('Portfolio router failed to boot', error);
});
