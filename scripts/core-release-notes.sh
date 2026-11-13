#!/usr/bin/env bash
# Prints the GitHub release notes for a core-vX.Y.Z tag: the feat: and fix: subjects of the commits that touched
# packages/core since the previous core tag, plus the compare link. Usage: core-release-notes.sh TAG
set -eo pipefail
tag=$1
[[ $tag =~ ^core-v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "$tag is not a core release tag (core-vX.Y.Z)" >&2; exit 1; }
# The core release before this one by version, among the core tags this commit contains.
prev=$(git tag --merged "$tag^{commit}" --list 'core-v*' | grep -E '^core-v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | grep -B1 -x "$tag" | grep -vx "$tag" || true)
range=${prev:+$prev..}$tag
# One type's subjects, scoped (feat(ui):) and breaking (feat!:) ones too. @names go in code spans, so
# publishing notifies nobody. The path limit keeps app-only commits out of the package's notes.
list() { git log --reverse --format=%s "$range" -- packages/core | sed -nE "s/^$1(\([^)]*\))?!?: /- /p" | sed -E 's/@([A-Za-z0-9-]+)/`@\1`/g'; }
feats=$(list feat)
fixes=$(list fix)
if [ -n "$feats" ]; then printf '## Features\n%s\n\n' "$feats"; fi
if [ -n "$fixes" ]; then printf '## Fixes\n%s\n\n' "$fixes"; fi
if [ -n "$prev" ]; then echo "**Full Changelog**: https://github.com/$GITHUB_REPOSITORY/compare/$prev...$tag"; fi
