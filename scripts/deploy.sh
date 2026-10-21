#!/usr/bin/env bash
# deploy-branch: main
set -euo pipefail

# Preflight: the five pages hand-copy their chrome, so check for drift before pushing.
# Runs under DEPLOY_DRY_RUN too (it mutates nothing); DEPLOY_SKIP_CHECKS=1 skips it.
# Pushes that bypass /deploy (Workers Builds deploys any push to main) skip it as well,
# so run scripts/check-site.sh by hand before pushing.
if [[ "${DEPLOY_SKIP_CHECKS:-}" = 1 ]]; then
  echo "skipping scripts/check-site.sh (DEPLOY_SKIP_CHECKS=1)"
elif ! "$(dirname "${BASH_SOURCE[0]}")/check-site.sh"; then
  echo "preflight failed: scripts/check-site.sh found drift; not pushing" >&2
  exit 2
fi

echo "::deploy:target=pages:start"
if [[ "${DEPLOY_DRY_RUN:-}" = 1 ]]; then
  echo "would: git push origin main"
else
  git push origin main
fi
# Cloudflare Workers Builds deploys on push to main (wrangler.jsonc).
# No watch line — the build runs in Cloudflare, not GitHub Actions.
echo "::deploy:target=pages:url=https://michaellamb.dev"
echo "::deploy:target=pages:end:status=ok"
