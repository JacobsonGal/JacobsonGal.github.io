# Gal Jacobson — Portfolio

Personal portfolio on GitHub Pages: **https://JacobsonGal.github.io/**

Static HTML/CSS/JS — no Base44, no build step. Profile data lives in `data/profile.json`.

## Resume

- **View / print (public):** [resume.html](resume.html) — uses the site palette (`css/themes.css`, default **Arctic** to match the logo).
- **Edit (owner only):** open [edit-resume.html](edit-resume.html) and sign in with GitHub as `@JacobsonGal`. After signing in, **Edit resume** appears on the resume toolbar. Requires a one-time [GitHub OAuth App](#github-oauth-for-resume-editing) (`read:user` scope, Device Flow enabled).
- **Color palette:** default **Arctic** (icy blues from the hex logo). When signed in, use the **Palette** swatches on the portfolio header, resume toolbar, or editor to switch to **Editorial** (warm cream/rust). Choice is saved in your browser.
- **Print to PDF:** open the resume page and use **Print / Save PDF**.

The floating action menu links to **Resume** with your full logo mark.

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

## GitHub OAuth for resume editing

1. Create an OAuth App: [github.com/settings/applications/new](https://github.com/settings/applications/new)
2. **Homepage URL:** `https://jacobsongal.github.io`
3. **Authorization callback URL:** `https://jacobsongal.github.io/resume.html`
4. Enable **Device Flow**
5. Copy the **Client ID** into `js/auth-config.js` as `GITHUB_CLIENT_ID`
6. Commit and push

Only the GitHub user `JacobsonGal` can open the editor after signing in.

## Canonical profile

See `content/profile.yaml` for cross-surface alignment (website, LinkedIn, resume).
