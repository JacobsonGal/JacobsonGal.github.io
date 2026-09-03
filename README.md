# Gal Jacobson — Portfolio

Personal portfolio hosted on [GitHub Pages](https://JacobsonGal.github.io).

Design is built in [Base44](https://jacobsongal.base44.app/) (free tier). This repo mirrors the production static build for hosting without Base44 subscription.

## Update after Base44 edits

1. Edit the site in Base44.
2. Run `./scripts/mirror-from-base44.sh`
3. Re-apply `site/index.html` patches if the mirror overwrote them (or keep patched `index.html` as source of truth).
4. Commit and push to `main`.

## Canonical profile

`content/profile.yaml` — single source of truth for website, LinkedIn, and CV alignment.

## Local preview

```bash
cd . && python3 -m http.server 8080
```

Open http://localhost:8080
