# michaellamb.dev

The landing page for [michaellamb.dev](https://michaellamb.dev) — a hub for the blog, the Letterboxd viewer, the newsletter, and the Kotlin tutorial, plus social links. Replaces the old carrd.co page.

Plain HTML/CSS/JS, no build step. The design system (`--sk-*` tokens, self-hosted Inter, pill CTAs, glass nav) is copied from the [blog repo](https://github.com/michaellambgelo/michaellambgelo.github.io) — `css/theme.css` is a verbatim copy of the blog's token file; `css/landing.css` is a trimmed extraction of the blog's component styles.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Serve from the repo root — the font and asset paths are absolute (`/font/...`, `/assets/...`).

## Deploy

Cloudflare Workers (static assets) via the Workers Builds git integration: push to `main` and Cloudflare runs `wrangler deploy`, publishing the repo per `wrangler.jsonc` (assets from the repo root; `.assetsignore` keeps repo-meta files out of the served site). `scripts/deploy.sh` follows the workspace `/deploy` contract.

## Telemetry

`js/faro.js` sends Grafana Faro telemetry through `grafana.michaellamb.dev/faro-proxy?app=landing` (provisioned in the `grafana-faro-proxy` repo). On localhost it targets `localhost:8787` and fails gracefully if the proxy dev server isn't running.
