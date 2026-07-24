#!/usr/bin/env bash
# deploy-branch: main
set -euo pipefail

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
