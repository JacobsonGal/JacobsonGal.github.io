# Gal Jacobson — Portfolio

Personal portfolio on GitHub Pages: **https://JacobsonGal.github.io/**

Static HTML/CSS/JS — no Base44, no build step. Profile data lives in `data/profile.json`.

## Resume

- **View / print (public):** [resume.html](resume.html) — uses the site palette (`css/themes.css`, default **Arctic** to match the logo).
- **Edit (owner only):** triple-click a hidden spot on the site (see below) or open [edit-resume.html](edit-resume.html), then unlock with your **owner code**. After unlocking, **Edit resume** appears in the header and resume toolbar.
- **Color palette:** default **Arctic** (icy blues from the hex logo). When signed in, use the **Palette** swatches on the portfolio header, resume toolbar, or editor to switch to **Editorial** (warm cream/rust). Choice is saved in your browser.
- **Print to PDF:** open the resume page and use **Print / Save PDF**.

The floating action menu links to **Resume** with your full logo mark.

### Hidden owner unlock

Triple-click any of these to open the unlock dialog:

- Homepage: the `.` in the header brand, the green HUD dot, the portrait logo, the footer sync line, or the top-right screen corner
- Resume page: **GAL** in the sidebar, or the bottom-left screen corner

### Owner code setup

GitHub device-flow sign-in cannot run directly in the browser (CORS). Use an owner code instead:

```bash
node scripts/generate-owner-hash.mjs "your-private-code"
```

Paste the hash into `js/auth-config.js` as `OWNER_UNLOCK_HASH`.

Default code shipped in this repo (change it after first deploy):

- Code: `gal-portfolio-editor`
- Hash: `be7ef71fa57ec3c00461a0bccd6411a6ec1379cec2513fdc1ea2380a43ac307b`

## Update content

1. Edit `data/profile.json` directly, or use the local resume editor and export.
2. Commit and push to `main`.

## LinkedIn sync

- **On page load:** the site fetches `data/profile.json` and best-effort refreshes headline/about from your public LinkedIn profile.
- **Daily GitHub Action:** `.github/workflows/sync-linkedin.yml` commits LinkedIn metadata into `data/profile.json`.

Trigger manually:

```bash
gh workflow run sync-linkedin.yml --repo JacobsonGal/JacobsonGal.github.io
```

## Local preview

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/ after `python3 -m http.server 8080` from the repo root.

## GitHub OAuth (optional)

Browser-based GitHub sign-in needs a tiny CORS proxy because GitHub blocks direct device-flow calls from static sites.

1. Deploy `workers/github-auth-proxy` to Cloudflare Workers (`wrangler deploy` from that folder).
2. Create a GitHub OAuth App: [github.com/settings/applications/new](https://github.com/settings/applications/new)
3. **Homepage URL:** `https://jacobsongal.github.io`
4. **Authorization callback URL:** `https://jacobsongal.github.io/resume.html`
5. Enable **Device Flow**
6. Set `GITHUB_CLIENT_ID` and `GITHUB_AUTH_PROXY_URL` in `js/auth-config.js`

Owner-code unlock works without any of the above.

## Canonical profile

See `content/profile.yaml` for cross-surface alignment (website, LinkedIn, resume).
