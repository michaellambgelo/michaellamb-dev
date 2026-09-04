# michaellamb.dev

The landing page for [michaellamb.dev](https://michaellamb.dev) — a hub for the blog, the Letterboxd viewer, the newsletter, and the Kotlin tutorial, plus social links. Replaces the old carrd.co page.

Plain HTML/CSS/JS, no build step. The design system (`--sk-*` tokens, self-hosted Inter, pill CTAs, glass nav) is copied from the [blog repo](https://github.com/michaellambgelo/michaellambgelo.github.io) — `css/theme.css` is a verbatim copy of the blog's token file; `css/landing.css` is a trimmed extraction of the blog's component styles.

## Pages

- `index.html` — the landing page (`/`)
- `book.html` — the Cal.com scheduling page (`/book`)

There is no include system, so both files hand-duplicate `<head>`, the nav, the footer and
the nav hamburger script. A change to one must be applied to the other; nothing checks this.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Serve from the repo root — the font and asset paths are absolute (`/font/...`, `/assets/...`).

This is fine for CSS and asset work, but it maps URL paths to files literally, so it
serves the booking page only at `/book.html` — **`/book` 404s**. To exercise the real
extensionless route that production serves, use Wrangler instead:

```bash
npx wrangler dev --port 8788
# open http://localhost:8788/book
```

Port 8788 rather than Wrangler's default 8787, which is where `js/faro.js` posts on
localhost — sharing the port makes this Worker answer its own telemetry with 404s.

## Deploy

Cloudflare Workers (static assets) via the Workers Builds git integration: push to `main` and Cloudflare runs `wrangler deploy`, publishing the repo per `wrangler.jsonc` (assets from the repo root; `.assetsignore` keeps repo-meta files out of the served site). `scripts/deploy.sh` follows the workspace `/deploy` contract.

## Telemetry

`js/faro.js` sends Grafana Faro telemetry through `grafana.michaellamb.dev/faro-proxy?app=landing` (provisioned in the `grafana-faro-proxy` repo). On localhost it targets `localhost:8787` and fails gracefully if the proxy dev server isn't running.
