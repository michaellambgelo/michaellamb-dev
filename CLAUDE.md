# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The apex `michaellamb.dev` landing page — a static hub linking the blog (`blog.michaellamb.dev`), the Letterboxd viewer (`letterboxd.michaellamb.dev`), the newsletter (`subscribe.michaellamb.dev`), and the Kotlin tutorial (`kotlin-tutorial.michaellamb.dev`), plus footer socials. Replaced the carrd.co page.

## Stack

Plain HTML/CSS/JS. **No build step, no npm, no framework.** Cloudflare Pages serves the repo root as-is via the GitHub git integration (push to `main` deploys; build command empty, output dir `/`).

## Design system provenance

- `css/theme.css` — **verbatim copy** of `michaellambgelo.github.io/css/theme.css` (the `--sk-*` token source of truth). To pick up blog token changes, re-diff against the blog copy. Do not edit tokens here.
- `css/landing.css` — trimmed extraction of the blog's `gh-pages-blog.css` components (nav, buttons, hero, strip/grid/card, footer, utilities). The only landing-original rules are the `.sk-grid--apps` 2×2 override and the `a.sk-card` full-card-anchor styles.
- `font/inter/` — woff2 copies from the blog (Light/Regular/SemiBold/Bold). theme.css references them by absolute path, so always serve from repo root.
- Access tokens as CSS variables (`var(--sk-accent)` etc.) — never hardcode palette colors.
- The nav hamburger/scroll-lock/focus-trap script inlined in `index.html` is copied from the blog's `navbar.html`; keep in sync if the blog's changes.

## Telemetry

`js/faro.js` (adapted from `grafana-faro-proxy/client/faro-init.js`) reports as app `landing` via `grafana.michaellamb.dev/faro-proxy?app=landing`. The proxy side (token env, `ALLOWED_ORIGINS`) is already provisioned in `~/Workspace/grafana-faro-proxy`. Note: the `*.pages.dev` preview origin is NOT allowlisted — Faro CORS rejections on pages.dev are expected, not a bug.

## Deploy

`scripts/deploy.sh` follows the workspace `/deploy` contract (single `pages` target, `git push origin main`, no watch line — the deploy runs in Cloudflare, not GitHub Actions).

## Local preview

```bash
python3 -m http.server 8000
```
