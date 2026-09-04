# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The apex `michaellamb.dev` landing page — a static hub linking the blog (`blog.michaellamb.dev`), the Letterboxd viewer (`letterboxd.michaellamb.dev`), the newsletter (`subscribe.michaellamb.dev`), and the Kotlin tutorial (`kotlin-tutorial.michaellamb.dev`), plus footer socials. Replaced the carrd.co page.

## Stack

Plain HTML/CSS/JS. **No build step, no npm, no framework.** Deployed as a Cloudflare Worker with static assets (`wrangler.jsonc`, assets from the repo root) via the Workers Builds git integration — push to `main` and Cloudflare runs `wrangler deploy`. `.assetsignore` keeps repo-meta files (README, CLAUDE.md, scripts/, wrangler.jsonc) out of the served site. Live at `michaellamb.dev` (Worker Custom Domain, attached 2026-07-24).

## Pages — two files, hand-duplicated chrome

`index.html` (`/`) and `book.html` (`/book`) are the only pages. `html_handling` is unset in
`wrangler.jsonc`, so Workers Static Assets' `auto-trailing-slash` default serves root-level
`book.html` at `/book` and 307s both `/book/` and `/book.html` to it — **no `_redirects`
entry and no wrangler config is involved**.

There is no include system, so both files hand-copy the `<head>`, the nav, the footer, and
the 77-line nav hamburger IIFE. **A change to one must be applied to the other, and nothing
in the repo will catch a desync** — there are no tests. The cheapest guard is a diff of the
shared ranges. `book.html` deliberately differs in exactly three ways: page-specific
`<title>`/description/canonical/`og:*`, `aria-current="page"` on its own nav row, and it
omits `js/vhs.js` (that script early-returns on `document.querySelector('.sk-hero')`, which
`/book` has no instance of, so it would be a pure no-op fetch).

If a third page ever lands, that is the moment to reconsider a build step or a Worker with
`main` — not before.

## /book — Cal.com scheduling embed

Embeds `themichaellamb/virtual-chat` via `app.cal.com/embed/embed.js`. Notes that are easy to
get wrong:

- **The namespace is hyphenated**, so `Cal.ns.virtual-chat(...)` — the form Cal's own docs
  show — is a syntax error. Bracket notation is mandatory.
- **`cssVarsPerTheme` values are resolved at runtime** from the `--sk-*` tokens via
  `getComputedStyle`, so no palette colour is hardcoded on the page. Because
  `getComputedStyle` can only ever read the *active* colour scheme, the page resolves one
  palette, hands it to both the `light` and `dark` slots, and pins Cal's `theme` to the
  scheme `matchMedia` reports. `cal-bg` is the one token needing an explicit per-scheme
  choice: `--sk-surface` equals `.sk-strip`'s background in dark mode, so the booker would
  be an invisible seam; it reads `--sk-bg-dark` there instead.
- **`ui.autoscroll: "false"` is load-bearing.** Cal otherwise scrolls the page ~900px down to
  the booker on mount, jumping the visitor past the heading and intro line.
- The loading overlay is a *child* of the embed container (which owns the reserved
  `min-height`), so retiring it shifts nothing. It is torn down by four independent triggers
  — `linkReady`, `linkFailed`, a `MutationObserver`, and a 10s timeout — because Cal's embed
  events are known to be unreliable (`calcom/cal.com#22866`). The plain cal.com link below is
  a sibling and is never touched by that teardown.
- The `.sk-cal-embed` min-heights are **measured**, not guessed. Re-measure if the layout or
  event duration changes.
- Unlike `js/faro.js`, `embed.js` is unversioned and cannot carry SRI. Accepted deliberately;
  the reasoning is in a comment at the top of the script block.

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
