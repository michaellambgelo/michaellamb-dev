# michaellamb.dev DNS migration — carrd.co → Cloudflare Workers

Runbook for pointing the apex at this repo's landing page. Written 2026-07-24,
amended same day: the project deployed as a **Worker with static assets**
(Workers Builds Git integration), not Cloudflare Pages.
Delete this file once the migration is complete and stable.

## Verified current state (2026-07-24)

- `michaellamb.dev` — Cloudflare zone, **proxied** (orange-cloud) records fronting
  the carrd.co page. Carrd still serves the apex.
- `www.michaellamb.dev` — proxied, **301 → apex**. Preserve this.
- **Worker `michaellamb-dev` is live** at
  `https://michaellamb-dev.michaellamb.workers.dev` — Workers Builds watches
  `main` and runs `wrangler deploy` on push; `wrangler.jsonc` serves static
  assets from the repo root; observability enabled.
- Deployment verified current (latest commit's files serve; site is
  single-page — About/Now link to the blog).
- Faro proxy fully provisioned for this page (`landing` app key, apex origin
  allowlisted, `LANDING_INGEST_TOKEN` secret confirmed set).
- wrangler OAuth is logged in as michael@michaellamb.dev on the right account.

## Phase 0 — safety net (dashboard, 2 min) — DO THIS FIRST

Record the current DNS so rollback is trivial:

1. Cloudflare dashboard → michaellamb.dev zone → DNS → Records.
2. **Export zone file** (button at the bottom of the records list) and/or
   screenshot the apex + www records. The carrd origin values are only visible
   here — they cannot be recovered from outside once replaced.

## Phase 1 — project creation — ✅ DONE

The Worker exists and serves the site. Pre-cutover spot checks any time:

```sh
curl -sI https://michaellamb-dev.michaellamb.workers.dev/   # 200
```

Expected and fine on the workers.dev origin (allowlists are apex-only; do not
widen them): Faro POSTs are CORS-rejected. This resolves itself at cutover.

## Phase 2 — cutover (dashboard) — ⚠️ PARTIALLY DONE

Carrd keeps serving until the DNS record actually changes; each step is
independently reversible.

1. Worker `michaellamb-dev` → **Settings → Domains & Routes → + Add →
   Custom Domain** → `michaellamb.dev`. The dashboard warns about the existing
   (carrd) record on that hostname and offers to replace it — **accepting is
   the cutover.** Cloudflare creates the Worker DNS record and certificate.
2. **❌ NOT DONE — `www.michaellamb.dev` has returned 522 on every path since
   this cutover.** Step 1 was completed; this step was skipped. Verified
   2026-08-31 against the live zone (`eeec3cc6d2141eae2f74c4fff96bcd5d`):

   | Piece | State |
   |---|---|
   | apex DNS | `AAAA 100::` proxied — Cloudflare's black-hole placeholder |
   | apex Worker Custom Domain | ✅ `michaellamb.dev` → `michaellamb-dev` |
   | `www` DNS | `CNAME michaellamb.dev`, proxied |
   | `www` Worker Custom Domain | ❌ absent |
   | `www` Redirect Rule | ❌ absent (zone's only rule is `boxd-card.michaellamb.dev`) |
   | Worker routes on zone | none |

   The apex works only because its Custom Domain intercepts before origin.
   `www` has no binding, so it follows the CNAME to the apex record `100::`,
   tries to open a connection to the discard prefix, and times out → **522**.

   **Fix — a zone Redirect Rule, not a second custom domain.** Binding `www`
   as a second Custom Domain would serve duplicate content on two hostnames
   *and* silently break telemetry: `grafana-faro-proxy/wrangler.toml`
   `ALLOWED_ORIGINS` lists `https://michaellamb.dev` but not the `www` form,
   so every Faro POST from a www visitor would 403. Widening it is explicitly
   ruled out in Phase 1 above.

   Dashboard → michaellamb.dev → **Rules → Redirect Rules → Create rule**:

   - Name: `www -> apex`
   - When: Custom filter expression → `Hostname` `equals` `www.michaellamb.dev`
   - Then: **Dynamic** redirect, **301** (Permanent)
   - Expression: `concat("https://michaellamb.dev", http.request.uri.path)`
   - ✅ Preserve query string

   Equivalent API call (needs a token with **Zone → Dynamic Redirect → Edit**;
   wrangler's OAuth scopes and the read-only MCP token both lack it):

   ```sh
   curl -X POST -H "Authorization: Bearer $CF_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones/eeec3cc6d2141eae2f74c4fff96bcd5d/rulesets/00a1a33d89374912b95c8073dfe995ac/rules" \
     -d '{"description":"www -> apex","expression":"(http.host eq \"www.michaellamb.dev\")","action":"redirect","enabled":true,"action_parameters":{"from_value":{"status_code":301,"target_url":{"expression":"concat(\"https://michaellamb.dev\", http.request.uri.path)"},"preserve_query_string":true}}}'
   ```

   POST appends to the existing ruleset; it will not disturb the boxd-card rule.

3. Propagation is near-instant — the change is inside Cloudflare's own zone.

**Do not delete this file until step 2 is done and verified:**

```sh
curl -sSI https://www.michaellamb.dev/    | head -3   # expect 301 -> https://michaellamb.dev/
curl -sSI https://www.michaellamb.dev/now | head -3   # expect 301 -> https://michaellamb.dev/now
curl -sSL -o /dev/null -w '%{http_code} @ %{url_effective}\n' https://www.michaellamb.dev/now
                                                      # expect 200 @ https://blog.michaellamb.dev/now
```

## Phase 3 — post-cutover verification (CLI + browser, 5 min)

```sh
curl -sI https://michaellamb.dev/        | head -5    # 200, no carrd headers
curl -sI https://www.michaellamb.dev/    | head -5    # 200 or 301 → apex
curl -s  https://michaellamb.dev/ | grep -c sk-hero   # ≥1 → new page live
curl -s -o /dev/null -w '%{http_code}\n' https://michaellamb.dev/MIGRATION.md  # 404 (.assetsignore working)
```

Browser checks on https://michaellamb.dev:
- Network tab: POST `grafana.michaellamb.dev/faro-proxy?app=landing` → 2xx.
- Both color schemes; mobile nav.
- Share-card check (og.png) in a social-card validator if you care about it.

Within a day: `landing` figures appear in the grafana-daily-report email as
before (same app identity the carrd page used — continuity, not a new series).

## Phase 4 — rollback (only if needed)

Worker → Settings → Domains & Routes → remove the custom domain(s), then
re-create the apex/www records from the Phase 0 export in the zone's DNS page.
Carrd is back within seconds.

## Phase 5 — cleanup (after a few stable days)

- carrd.co dashboard: remove the custom domain; downgrade/cancel the plan if
  the landing page was its only use.
- Optional: disable the `workers.dev` route on the Worker (Settings → Domains
  & Routes) so the apex is the single canonical origin.
- Add `michaellamb-dev` to the `~/Workspace/CLAUDE.md` and `~/CLAUDE.md`
  project tables.
- Optional: add an uptime-kuma monitor for https://michaellamb.dev on node3.
- Delete this file.

## Deploys after migration

`git push origin main` (or `/deploy` from the repo) — Workers Builds runs
`wrangler deploy` on push and publishes the tree per `wrangler.jsonc`.
`scripts/deploy.sh` already emits `url=https://michaellamb.dev`.
