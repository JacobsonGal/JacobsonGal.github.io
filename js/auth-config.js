export const ALLOWED_GITHUB_USERNAME = 'JacobsonGal';

/**
 * SHA-256 hash of your private owner unlock code.
 * Generate with: node scripts/generate-owner-hash.mjs "your-code"
 */
export const OWNER_UNLOCK_HASH = 'be7ef71fa57ec3c00461a0bccd6411a6ec1379cec2513fdc1ea2380a43ac307b';

/**
 * GitHub OAuth App (Device Flow enabled) — browser sign-in also needs the proxy below.
 * https://github.com/settings/applications/new
 */
export const GITHUB_CLIENT_ID = 'Ov23liYKlYpky0kfvxr6';

/**
 * Cloudflare Worker URL from workers/github-auth-proxy (optional).
 * Leave empty to use owner-code unlock only.
 */
export const GITHUB_AUTH_PROXY_URL = '';
