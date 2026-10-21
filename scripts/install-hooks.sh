#!/bin/sh
# Point git at the tracked hooks in git-hooks/ (no copying, so edits apply at once).
set -e
cd "$(git rev-parse --show-toplevel)"
chmod +x git-hooks/*
git config core.hooksPath git-hooks
echo "Git hooks installed (core.hooksPath=git-hooks)"
