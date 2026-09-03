# Gal Jacobson — Portfolio

Personal portfolio on GitHub Pages: **https://JacobsonGal.github.io/**

Static HTML/CSS/JS — no Base44, no build step. Profile data lives in `data/profile.json`.

## Resume

- **View / print:** [resume.html](resume.html) — styled with the same warm palette as the portfolio (`css/tokens.css`).
- **Edit in browser:** [edit-resume.html](edit-resume.html) — saves a draft in `localStorage`. Use **Export JSON** and commit to `data/profile.json` to publish changes.
- **Print to PDF:** open the resume page and use **Print / Save PDF**.

The floating action menu links to **Resume** (with your logo in accent colors, not blue).

## Update content

1. Edit `data/profile.json` (or use the resume editor + export).
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
