# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The apex `michaellamb.dev` landing page — a static hub linking the blog (`blog.michaellamb.dev`), the Letterboxd viewer (`letterboxd.michaellamb.dev`), the newsletter (`subscribe.michaellamb.dev`), and the Kotlin tutorial (`kotlin-tutorial.michaellamb.dev`), plus footer socials. Replaced the carrd.co page.

## Stack

Plain HTML/CSS/JS. **No build step, no npm, no framework.** Deployed as a Cloudflare Worker with static assets (`wrangler.jsonc`, assets from the repo root) via the Workers Builds git integration — push to `main` and Cloudflare runs `wrangler deploy`. `.assetsignore` keeps repo-meta files (README, CLAUDE.md, scripts/, wrangler.jsonc) out of the served site. Live at `michaellamb.dev` (Worker Custom Domain, attached 2026-07-24).

## Hostname routing — partly outside this repo

Two mechanisms serve `/`-adjacent paths, and only one is in the tree:

- **`_redirects`** (repo root, parsed by Workers Static Assets, never served as an asset) — path-level redirects on the apex. Currently `/now` and `/now/` → `blog.michaellamb.dev/now`. Add path redirects here, not in the dashboard.
- **A zone Redirect Rule** in the `http_request_dynamic_redirect` ruleset — `www.michaellamb.dev/*` → 301 apex, preserving the query string. **This is dashboard/API config and is invisible from the repo.** It cannot live in `_redirects`: the Worker is bound to the apex only, so `www` never reaches this code at all — without the rule it follows its CNAME to the apex's `AAAA 100::` placeholder and 522s.

Do **not** bind `www` as a second Worker Custom Domain instead. It would serve duplicate content on two hostnames and 403 every Faro POST, since `grafana-faro-proxy`'s `ALLOWED_ORIGINS` is apex-only by design.

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
