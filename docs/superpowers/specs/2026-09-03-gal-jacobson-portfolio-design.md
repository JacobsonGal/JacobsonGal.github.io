# Gal Jacobson Portfolio — Design Spec

**Date:** 2026-09-03  
**Status:** Approved (2026-09-03)  
**Owner:** Gal Jacobson  

## Summary

Replace the expired Wix portfolio with a **self-hosted GitHub Pages site** that ships the existing Base44 app at [jacobsongal.base44.app](https://jacobsongal.base44.app/). The site, [LinkedIn profile](https://www.linkedin.com/in/jacobsongal), and CV PDF (`Gal Jacobson _ CV.pdf`) form **one unified professional presence**: same title, dates, and story everywhere, with clear cross-links.

No Wix. No `/projects` gallery page. No monthly hosting fee on GitHub Pages.

---

## Goals

1. **Live portfolio** at `https://JacobsonGal.github.io` (no custom domain in v1).
2. **Preserve the Base44 design** already built — editorial single-page index with career timeline (About → Experience → Education).
3. **Unified profile** across website, LinkedIn, and downloadable CV.
4. **Zero recurring cost** for hosting (GitHub Pages free tier).
5. **No vendor lock-in on the public URL** — visitors hit GitHub Pages, not `*.base44.app`.

## Non-goals

- Rebuilding the site from scratch in plain HTML/CSS (superseded by Base44 app).
- Migrating off Base44’s editor entirely in v1 (Base44 remains the design/build tool until export is decoupled).
- Blog, contact form backend, or analytics beyond lightweight client-side options.
- Wix `/projects` page (Houzz / ReBuy case-study gallery) — **explicitly out of scope**.

---

## Current assets

| Asset | URL / path | Role |
|-------|------------|------|
| Base44 site (source of truth for **design + web copy**) | https://jacobsongal.base44.app/ | Vite/React SPA, portfolio v1.0 |
| LinkedIn | https://www.linkedin.com/in/jacobsongal | Professional network, recruiter traffic |
| CV PDF | `~/Downloads/Gal Jacobson _ CV.pdf` | Downloadable résumé for applications |
| GitHub profile | https://github.com/JacobsonGal | Code presence |
| Wix (deprecated) | jacobsongal7.wixsite.com | Retire after cutover |

### Base44 site structure (observed)

Single scrolling page with sections:

- **Index / hero** — “Senior Software Engineer”, Gal Jacobson, Houzz, scroll cue
- **About** — three narrative paragraphs + education callouts + current role
- **Experience** — expandable timeline: Houzz, Colman Practitioner, Yavo (IDF may appear below fold)
- **Education** — MBA, B.Sc.

Typography: Space Grotesk, Inter Tight, JetBrains Mono. Warm off-white background. No separate Projects route.

---

## Architecture

### Deployment model (free Base44 tier)

Gal is on **Base44 free** — no GitHub export, no ZIP download. v1 uses a **static mirror** of the production build already served at `jacobsongal.base44.app`, not a source rebuild.

```
┌─────────────────┐   edit in Base44    ┌─────────────────────────┐
│  Base44 editor  │ ──────────────────► │  jacobsongal.base44.app │
│  (free tier)    │                     │  (hosted preview/build) │
└─────────────────┘                     └───────────┬─────────────┘
                                                    │ mirror script
                                                    ▼
                                        ┌─────────────────────────┐
                                        │  JacobsonGal.github.io  │
                                        │  (static files in repo) │
                                        └───────────┬─────────────┘
                                                    │ push to main
                                                    ▼
                                        ┌─────────────────────────┐
                                        │  GitHub Pages           │
                                        └─────────────────────────┘
```

**Repository:** `JacobsonGal/JacobsonGal.github.io`.

**Deploy:** commit mirrored static files to repo root (or `docs/`). GitHub Pages serves them directly — **no npm build step** in v1.

**When Base44 content changes:** re-run mirror script, commit, push.

### Static mirror workflow (v1)

1. Download production assets from `jacobsongal.base44.app` (`index.html`, `/assets/*`, `manifest.json`, etc.).
2. **Remove** `static/js/badge.js` reference from `index.html` (no “Edit with Base44” on GitHub Pages).
3. Add **`cv/gal-jacobson-cv.pdf`** and patch footer/header in mirrored HTML (or a thin `site-patch.js`) for Download CV + LinkedIn links if missing.
4. Verify site works offline / without Base44 API (portfolio content is in the JS bundle).
5. Push to `JacobsonGal/JacobsonGal.github.io`, enable Pages from `main` branch.
6. Confirm `https://JacobsonGal.github.io` matches Base44 (minus badge).

**Upgrade path (later):** Base44 Builder export → proper Vite repo + GitHub Actions build. Not required for launch.

**Risk:** images hosted on `media.base44.com` may remain external URLs until downloaded into the repo. Mitigate by mirroring critical assets locally in a follow-up commit.

---

## Unified profile system

### Principle

One **canonical profile document** drives all three surfaces. Humans read the website and LinkedIn; recruiters download the PDF. They must not contradict each other.

### Canonical source (implementation)

Add to the repo:

```
content/
  profile.yaml          # single source of truth
  cv/
    gal-jacobson-cv.pdf # committed copy of current PDF
```

`profile.yaml` holds: name, headline, email, phone (**PDF only** — not on website), location, social URLs, overview bullets, experience entries (title, company, location, dates, bullets, stack), education, languages, skills groupings.

**v1 pragmatic path:** Base44 site already contains the richest web copy. For the first release:

1. Copy CV PDF into `content/cv/gal-jacobson-cv.pdf` and expose at **`/cv/gal-jacobson-cv.pdf`** on GitHub Pages.
2. Add prominent **Download CV** link in site header/footer (Base44 edit, then re-mirror; or patch mirrored HTML).
3. Align LinkedIn headline, About, and Experience with `profile.yaml` (manual LinkedIn edits).
4. Regenerate or hand-edit CV PDF when `profile.yaml` changes.

**v2 (optional):** script to generate PDF from `profile.yaml` (e.g. Typst or markdown-pdf).

### Cross-links (required on website)

| Element | Target |
|---------|--------|
| LinkedIn icon / text | https://www.linkedin.com/in/jacobsongal |
| GitHub | https://github.com/JacobsonGal |
| Email | mailto:jacobsongal@gmail.com |
| Download CV | `/cv/gal-jacobson-cv.pdf` (same file as local CV) |

### Cross-links (required on LinkedIn)

| LinkedIn field | Value |
|----------------|-------|
| Custom button / Featured link | `https://JacobsonGal.github.io` (after go-live) |
| Contact email | jacobsongal@gmail.com (match CV) |
| Headline | **Senior Software Engineer** |

### SEO / metadata

- `<title>`: `Gal Jacobson — Senior Software Engineer`
- `og:url` should point to GitHub Pages URL after cutover
- `link rel="canonical"` → production URL

---

## Content reconciliation (locked)

| Field | Website (Base44) | CV PDF | LinkedIn |
|-------|------------------|--------|----------|
| **Headline** | Senior Software Engineer | Software Engineer → update to **Senior Software Engineer** on next CV revision | Update to **Senior Software Engineer** |
| Houzz role title | Full-Stack Engineer | Full-Stack Engineer | Full Stack Engineer |
| Houzz dates | 2021 — Present | 2021 – Present | Align |
| Houzz team | Houzz Pro documents | Houzz Pro – Documents Team | Align |
| **Colman Practitioner** | 2021 — Present | **Not listed (web only)** | Optional mention; not required on CV |
| Yavo | 2020 — 2021 | 2020 – 2021 | Align |
| IDF | Include on web timeline | 2013 – 2017, Captain | Align |
| MBA | 2021 – 2022 | 2021 – 2022 | Align |
| B.Sc. | 2018 – 2021 | 2018 – 2021 | Align |
| **Phone** | **Not shown** | 052-3565689 | Not on profile |
| **Portfolio URL** | JacobsonGal.github.io | Add on next CV revision | Featured link → GitHub Pages |
| Overview | Base44 About (3 paragraphs) | Shorter skills-heavy version | Align tone with web where practical |

After launch: update LinkedIn headline, add featured link, refresh CV PDF with new URL + headline.

---

## Page requirements

### In scope (from Base44)

- Single-page index with anchor navigation (About, Experience, Education)
- Expandable experience entries (career timeline)
- Portrait / hero imagery
- Footer with email and social links
- Mobile-responsive layout (already in Base44 build)

### Out of scope

- `/projects` route and project gallery (Wix Houzz / ReBuy pages)
- Wix social links (Facebook, Instagram, Twitter) unless explicitly re-added
- Base44 “Edit with Base44” badge in production
- Contact form with server backend

### Accessibility

- Preserve semantic headings and keyboard-expandable experience sections from Base44 export
- Sufficient color contrast on warm background (verify after badge removal)
- `alt` text on portrait image

---

## Hosting & domains

### Phase 1 — GitHub Pages (now)

- URL: `https://JacobsonGal.github.io`
- HTTPS: automatic via GitHub
- Cost: $0

### Custom domain

**Out of scope for v1.** Public URL is `https://JacobsonGal.github.io` only.

### Wix / Base44 cutover

| Service | Action after GitHub Pages live |
|---------|-------------------------------|
| Wix | Stop renewing; let `wixsite.com` URL die or redirect if possible |
| Base44 | Keep as editor only; set canonical URL to GitHub Pages in metadata; optional redirect from `jacobsongal.base44.app` if Base44 supports it |
| LinkedIn | Update portfolio URL to GitHub Pages |
| CV PDF | Regenerate with site URL in header/footer |

---

## Repository layout (target)

```
JacobsonGal.github.io/
├── index.html                 # mirrored from Base44 (badge removed)
├── assets/                    # mirrored JS/CSS bundles
├── manifest.json
├── cv/
│   └── gal-jacobson-cv.pdf
├── content/
│   └── profile.yaml           # canonical copy for future edits
├── scripts/
│   └── mirror-from-base44.sh  # re-sync when Base44 changes
├── .gitignore
└── README.md                  # how to update the site
```

---

## CI/CD

**v1:** none required. GitHub Pages serves static files from `main` branch root.

**v2 (if Base44 export unlocked later):** add `deploy.yml` with `npm run build`.

---

## Testing & verification

Before calling launch complete:

- [ ] `https://JacobsonGal.github.io` loads without Base44 badge
- [ ] All nav anchors scroll correctly
- [ ] Experience accordions work without Base44 API errors (check browser console)
- [ ] `/cv/gal-jacobson-cv.pdf` downloads
- [ ] LinkedIn link opens correct profile
- [ ] Mobile layout checked (375px and 768px widths)
- [ ] Lighthouse: Performance > 85, Accessibility > 90 (targets, not blockers)
- [ ] Compare headline + Houzz dates against CV PDF line by line

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Base44 export requires paid plan | **Resolved:** use static mirror on free tier; upgrade path documented |
| Exported code calls Base44 API | Test offline build; remove unused SDK calls if portfolio is static |
| GitHub username case (`JacobsonGal` vs `jacobsonGal`) | Use exact username for repo name: `JacobsonGal.github.io` |
| Content drift between CV / LinkedIn / site | `profile.yaml` + checklist on every update |
| Base44 badge in production | Remove `badge.js` / hide via build step |
| IDF / Practitioner missing on one surface | Reconciliation table above |

---

## Implementation phases

### Phase A — Mirror & repo (agent)

1. Create `JacobsonGal/JacobsonGal.github.io` on GitHub.
2. Mirror static build from `jacobsongal.base44.app`.
3. Remove Base44 badge; add `cv/gal-jacobson-cv.pdf`.
4. Push to `main`; enable GitHub Pages.

### Phase B — Unified profile (you + agent)

1. Add `content/profile.yaml` from reconciled copy.
2. Ensure Download CV + LinkedIn links on mirrored site.
3. **You:** update LinkedIn headline to “Senior Software Engineer” + featured link to GitHub Pages.

### Phase C — Cutover

1. **You:** refresh CV PDF with `JacobsonGal.github.io` URL and Senior Software Engineer headline.
2. Retire Wix link from LinkedIn / email signature.
3. Keep Base44 as editor; re-mirror after future design edits.

---

## Decisions (2026-09-03)

| # | Question | Decision |
|---|----------|----------|
| 1 | Headline | **Senior Software Engineer** everywhere (web now; CV + LinkedIn on next update) |
| 2 | Colman Practitioner | **Web only** — not on CV |
| 3 | Base44 plan | **Free** — static mirror, no export |
| 4 | Domain | **`JacobsonGal.github.io` only** |
| 5 | Phone | **PDF only** — not on website |

---

## Next step

Implementation plan: `docs/superpowers/plans/2026-09-03-gal-jacobson-portfolio.md`
