# Gal Jacobson — Portfolio

Personal portfolio on GitHub Pages: **https://JacobsonGal.github.io/**

Static HTML/CSS/JS — no Base44, no build step. Profile data lives in `data/profile.json`.

## Resume

- **View / print (public):** [resume.html](resume.html) — styled with the same warm palette as the portfolio (`css/tokens.css`).
- **Edit (local only):** run the site locally, then open [local/edit-resume.html](http://localhost:8080/local/edit-resume.html). Export JSON and commit to `data/profile.json` to publish. The editor is not linked or available on the live GitHub Pages site.
- **Print to PDF:** open the resume page and use **Print / Save PDF**.

The floating action menu links to **Resume** (with your logo in accent colors, not blue).

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

## Canonical profile

See `content/profile.yaml` for cross-surface alignment (website, LinkedIn, resume).
