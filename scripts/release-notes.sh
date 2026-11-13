#!/usr/bin/env bash
# Prints the GitHub release notes for a PREFIXX.Y.Z tag: the feat: and fix: subjects of the commits that touched
# PATH since the previous tag with that prefix, plus the compare link.
# Usage: release-notes.sh TAG PREFIX PATH   (for example: release-notes.sh core-v0.2.0 core-v packages/core)
set -eo pipefail
tag=$1 prefix=$2 path=$3
[[ $prefix =~ ^[a-z-]+v$ ]] || { echo "bad prefix: $prefix" >&2; exit 1; }
[[ $tag =~ ^${prefix}[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "$tag is not a release tag (${prefix}X.Y.Z)" >&2; exit 1; }
# The release before this one by version, among the tags with this prefix that this commit contains.
prev=$(git tag --merged "$tag^{commit}" --list "${prefix}*" | grep -E "^${prefix}[0-9]+\.[0-9]+\.[0-9]+$" | sort -V | grep -B1 -x "$tag" | grep -vx "$tag" || true)
range=${prev:+$prev..}$tag
# One type's subjects, scoped (feat(ui):) and breaking (feat!:) ones too. @names go in code spans, so
# publishing notifies nobody. The path limit keeps other parts of the repo out of these notes.
list() { git log --reverse --format=%s "$range" -- "$path" | sed -nE "s/^$1(\([^)]*\))?!?: /- /p" | sed -E 's/@([A-Za-z0-9-]+)/`@\1`/g'; }
feats=$(list feat)
fixes=$(list fix)
if [ -n "$feats" ]; then printf '## Features\n%s\n\n' "$feats"; fi
if [ -n "$fixes" ]; then printf '## Fixes\n%s\n\n' "$fixes"; fi
if [ -n "$prev" ]; then echo "**Full Changelog**: https://github.com/$GITHUB_REPOSITORY/compare/$prev...$tag"; fi
