# Gal Jacobson — Portfolio

Personal portfolio on GitHub Pages: **https://JacobsonGal.github.io/Portfolio/**

Static HTML/CSS/JS — no Base44, no build step. Profile data lives in `data/profile.json`.

## Update content

1. Edit `data/profile.json` (or let LinkedIn sync update headline/about).
2. Commit and push to `main`.

## LinkedIn sync

- **On page load:** the site fetches `data/profile.json` and best-effort refreshes headline/about from your public LinkedIn profile.
- **Daily GitHub Action:** `.github/workflows/sync-linkedin.yml` commits LinkedIn metadata into `data/profile.json`.

Trigger manually:

```bash
gh workflow run sync-linkedin.yml --repo JacobsonGal/Portfolio
```

## Local preview

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/Portfolio/ (use a subpath proxy) or temporarily set `<meta name="base-path" content="/" />` for root preview.

## Canonical profile

See `content/profile.yaml` for cross-surface alignment (website, LinkedIn, CV PDF).
