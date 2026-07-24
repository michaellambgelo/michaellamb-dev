# michaellamb.dev DNS migration — carrd.co → Cloudflare Pages

Runbook for pointing the apex at this repo's landing page. Written 2026-07-24.
Delete this file once the migration is complete and stable.

## Verified current state (2026-07-24)

- `michaellamb.dev` — Cloudflare zone, **proxied** (orange-cloud) records fronting
  the carrd.co page (serving carrd content, last-modified 2026-04-18).
- `www.michaellamb.dev` — proxied, **301 → apex**. Preserve this.
- `michaellamb-dev.pages.dev` — does not resolve: **Pages project not created yet**.
- Repo `michaellambgelo/michaellamb-dev` on GitHub, `main` current.
- Faro proxy fully provisioned for this page (`landing` app key, apex origin
  allowlisted, `LANDING_INGEST_TOKEN` secret confirmed set).
- kotlin-tutorial widgets CORS already allows `https://michaellamb.dev`.
- wrangler OAuth is logged in as michael@michaellamb.dev on the right account.

## Phase 0 — safety net (dashboard, 2 min)

Before touching anything, record the current DNS so rollback is trivial:

1. Cloudflare dashboard → michaellamb.dev zone → DNS → Records.
2. **Export zone file** (button at the bottom of the records list) and/or
   screenshot the apex + www records. The carrd origin values are only visible
   here — they cannot be recovered from outside once replaced.
3. Note whether carrd uses A records or a CNAME for the apex.

## Phase 1 — create the Pages project (dashboard, 3 min)

Git integration must be chosen at project creation (a direct-upload project
cannot be converted later), so this is a dashboard step:

1. Workers & Pages → Create → **Pages** → Connect to Git → repo
   `michaellambgelo/michaellamb-dev`. Grant the Cloudflare GitHub App access to
   the repo if it isn't listed.
2. Project name **`michaellamb-dev`**, production branch **`main`**,
   framework preset **None**, build command **(empty)**, build output
   directory **`/`**.
3. Save and Deploy. No build runs; deploy is seconds.

**Verify before continuing** (CLI, safe any time):

```sh
curl -sI https://michaellamb-dev.pages.dev/           # 200, cloudflare headers
curl -s  https://michaellamb-dev.pages.dev/about.html | grep -c sk-post-hero  # ≥1
```

Then eyeball `https://michaellamb-dev.pages.dev` in a browser: both color
schemes, mobile hamburger, cards. Expected and fine on pages.dev:
- Faro POSTs are CORS-rejected (only the apex origin is allowlisted).
- The About "Projects" widget shows "Widget unavailable." (same CORS reason).
Both resolve themselves at cutover; do not widen any allowlists for pages.dev.

## Phase 2 — cutover (dashboard, 2 min, zero-downtime)

Carrd keeps serving until the DNS record actually changes; each step is
independently reversible.

1. Pages project → **Custom domains** → Add → `michaellamb.dev`. The zone is in
   this account, so Cloudflare offers to replace the conflicting apex record
   with a CNAME to the Pages project. **Accepting that dialog is the cutover.**
2. Add `www.michaellamb.dev` as a second custom domain the same way. Pages
   serves the same site on www; if the old www record was a carrd-side
   redirect, this keeps www resolving. (Optional hardening: a Redirect Rule
   `www → apex` 301 in the zone to preserve the exact old behavior.)
3. Propagation is near-instant — the change is inside Cloudflare's own zone.

## Phase 3 — post-cutover verification (CLI + browser, 5 min)

```sh
curl -sI https://michaellamb.dev/        | head -5    # 200, no carrd headers
curl -sI https://www.michaellamb.dev/    | head -5    # 200 or 301 → apex
curl -s  https://michaellamb.dev/ | grep -c sk-hero   # ≥1 → new page live
```

Browser checks on https://michaellamb.dev:
- Network tab: POST `grafana.michaellamb.dev/faro-proxy?app=landing` → 2xx.
- About page: Projects widget populates from kotlin-tutorial.
- Both color schemes; mobile nav.
- Share-card check (og.png) in a social-card validator if you care about it.

Within a day: `landing` figures appear in the grafana-daily-report email as
before (same app identity the carrd page used — continuity, not a new series).

## Phase 4 — rollback (only if needed)

In the zone's DNS records, delete the Pages CNAME(s) and re-create the apex/www
records from the Phase 0 export. Carrd is back within seconds. Removing the
custom domain from the Pages project (Custom domains → … → Remove) does the
same from the other side.

## Phase 5 — cleanup (after a few stable days)

- carrd.co dashboard: remove the custom domain; downgrade/cancel the Pro plan
  if the landing page was its only use.
- Remove the temporary "site not live yet" caveats: none in-repo (README and
  CLAUDE.md are already written present-tense).
- Add `michaellamb-dev` to the `~/Workspace/CLAUDE.md` and `~/CLAUDE.md`
  project tables.
- Optional: add an uptime-kuma monitor for https://michaellamb.dev on node3.
- Delete this file.

## Deploys after migration

`git push origin main` (or `/deploy` from the repo) — the Pages Git
integration builds nothing and publishes the pushed tree. `scripts/deploy.sh`
already emits `url=https://michaellamb.dev`.
