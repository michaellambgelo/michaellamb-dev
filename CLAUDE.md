# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The apex `michaellamb.dev` landing page — a static hub linking the blog (`blog.michaellamb.dev`), the Letterboxd viewer (`letterboxd.michaellamb.dev`), the newsletter (`subscribe.michaellamb.dev`), and the Kotlin tutorial (`kotlin-tutorial.michaellamb.dev`), plus footer socials. Replaced the carrd.co page.

## Stack

Plain HTML/CSS/JS. **No build step, no npm, no framework.** Deployed as a Cloudflare Worker with static assets (`wrangler.jsonc`, assets from the repo root) via the Workers Builds git integration — push to `main` and Cloudflare runs `wrangler deploy`. `.assetsignore` keeps repo-meta files (README, CLAUDE.md, scripts/, wrangler.jsonc) out of the served site. Live at `michaellamb.dev` (Worker Custom Domain, attached 2026-07-24).

## Pages — five files, hand-duplicated chrome

`index.html` (`/`) and `book.html` (`/book`) were the first two pages; `privacy.html`,
`terms.html` and `404.html` (below) followed. `html_handling` is unset in
`wrangler.jsonc`, so Workers Static Assets' `auto-trailing-slash` default serves root-level
`book.html` at `/book` and 307s both `/book/` and `/book.html` to it — **no `_redirects`
entry and no wrangler config is involved**.

There is no include system, so all five files hand-copy the `<head>`, the nav, the footer, and
the 77-line nav hamburger IIFE. **A change to one must be applied to all of them.**
`scripts/check-site.sh` catches a desync: it compares each page's `<head>`, primary nav, footer
and nav IIFE against `privacy.html` after dropping only the per-page lines listed here, checks
the primary nav against the blog's `_includes/body/sections/navbar.html`, and checks every
`og:image`/`twitter:image` (an `https://michaellamb.dev/` URL for a 1200×630 PNG/JPEG in the repo
that is not a copy of a blog `seo/` card). `scripts/deploy.sh` runs it as a preflight (exit 2),
but Workers Builds deploys **any** push to `main` without going through `deploy.sh`, so run
`scripts/check-site.sh` before pushing. A new allowed difference must be added to the script's
`PER_PAGE`/`EXTRAS` tables as well as here. `book.html` deliberately differs in exactly three ways: page-specific
`<title>`/description/canonical/`og:*`, `aria-current="page"` on its own nav row, and it
omits `js/vhs.js` (that script early-returns on `document.querySelector('.sk-hero')`, which
`/book` has no instance of, so it would be a pure no-op fetch). Its `<head>` also carries a JS-off `<noscript>` style for the Cal placeholder, and the Cal script blocks follow the nav IIFE. `index.html` alone also
carries a Person + WebSite JSON-LD block in its `<head>`; its `sameAs` lists only the personal
profile links from the footer/nav (blog, GitHub, LinkedIn, Letterboxd, Twitch), not the
community/org links.

`privacy.html` (2026-10-15) is the site-wide Privacy Policy. It covers the websites, the newsletter
(subscribe.michaellamb.dev, sent through Hakanai) and Discord Embed Builder, which has the anchor
`#discord-embed-builder`. `terms.html` is the Terms of Service for Discord Embed Builder only. The Discord
developer portal links to both pages for app verification. Their
chrome was copied from `book.html` (no Cal blocks, no `aria-current`, prose in
`.sk-article.sk-legal`), so the same hand-sync rule applies to all five pages. Their claims about
data handling were checked against the discord-embed-builder, subscribe.michaellamb.dev and blog code on
that date. If any of them starts collecting something new, update `/privacy` and its effective date.

`404.html` (2026-10-20) is the fifth page. `wrangler.jsonc` sets
`assets.not_found_handling: "404-page"`, so any unmatched path gets it with a 404 status
(`_redirects` still runs first). Because it is also an ordinary root-level page, `/404` serves it
with a **200** and `/404.html` 307s there; `<meta name="robots" content="noindex">` covers that,
and it has no `canonical`/`og:url`. Its chrome is a copy of `privacy.html`'s (no `aria-current`,
no `vhs.js`) and every asset URL in it is root-absolute, which it must stay — it is served at
arbitrary nested paths. `python3 -m http.server` does not emulate `not_found_handling`.

That fifth page was the old trigger for revisiting a build step, and the step is still deferred:
the 404 and legal pages are static and rarely change, so the cost is five hand-synced copies of the
chrome. Every shared `<head>` change (e.g. the `apple-touch-icon` link, `og:image:*` and
`twitter:image` tags) must land in all five files. Revisit if a sixth page lands or the chrome
starts changing often. `sitemap.xml` lists the four indexable pages (not `/404`) and must be
updated by hand when a page is added; `robots.txt` points at it. Cloudflare's managed
content-signals robots.txt is served only on hosts that have **no** robots.txt of their own, so
this file replaced it (verified 2026-10-20). Nothing was lost: on this zone the managed file is
all comments, with no `Content-Signal:` or `Disallow` lines. If AI-crawler signals are ever
turned on in the dashboard, add the equivalent lines here, because this file wins.

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
- `assets/bio.jpg` / `assets/bio.webp` — the hero avatar, served through a `<picture>` (WebP first). Both are 440×440, a centre square crop (matching the `object-fit: cover` crop) at 2× the 220px `.sk-avatar--lg` size; the 1536×2048 original (1.59 MB) was replaced in place, keeping the `bio.jpg` URL for the JSON-LD `image` and any outside hotlinks. Regenerate from a full-size original with `magick SRC -resize 440x440^ -gravity center -extent 440x440 -strip -quality 82 -interlace JPEG bio.jpg` and `cwebp -q 80 -m 6 -metadata none bio.jpg -o bio.webp`. The `<picture>` has an inline `display: contents` so the `<img>` stays the hero's flex item.
- `apple-touch-icon.png` (root, 180×180) — `assets/favicon.png` trimmed, scaled to 144px and centred on opaque `#f5f5f7` (`--sk-bg-light`), since iOS fills transparency with black.
- `assets/og-card.png` — the `og:image` for all five pages, rendered with the blog's `scripts/generate_seo_image.rb` (`render_card`, dark tone, eyebrow `MICHAELLAMB.DEV`, no date) so it matches the blog's card design. It replaced `assets/og.png`, which was a copy of the blog's pre-2026-08-18 `seo/default.png` and showed a 2023 post's title. **Never copy a blog `seo/` file here**, because those cards carry a post's title and date. To change the card, render it again and **give it a new filename**: Discord, Slack and LinkedIn cache link previews by image URL, so overwriting the file in place keeps the old preview.
- Access tokens as CSS variables (`var(--sk-accent)` etc.) — never hardcode palette colors.
- The nav hamburger/scroll-lock/focus-trap script inlined in `index.html` is copied from the blog's `navbar.html`; keep in sync if the blog's changes.

## Telemetry

`js/faro.js` (adapted from `grafana-faro-proxy/client/faro-init.js`) reports as app `landing` via `grafana.michaellamb.dev/faro-proxy?app=landing`. The proxy side (token env, `ALLOWED_ORIGINS`) is already provisioned in `~/Workspace/grafana-faro-proxy`. Note: the `*.pages.dev` preview origin is NOT allowlisted — Faro CORS rejections on pages.dev are expected, not a bug.

## Deploy

`scripts/deploy.sh` follows the workspace `/deploy` contract (single `pages` target, `git push origin main`, no watch line — the deploy runs in Cloudflare, not GitHub Actions). It first runs `scripts/check-site.sh` and exits 2 if it fails (skipped with `DEPLOY_SKIP_CHECKS=1`; still runs under `DEPLOY_DRY_RUN=1`). `scripts/check-site.sh [DIR]` checks another directory (e.g. a scratch copy) and reads the blog from `$BLOG_DIR`, defaulting to the sibling `michaellambgelo.github.io` checkout; without it, the blog checks warn and are skipped. `scripts/` is already in `.assetsignore`, so neither script is served.

## Local preview

```bash
python3 -m http.server 8000
```
