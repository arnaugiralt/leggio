#!/usr/bin/env bash
# Compiles packages/core/types/usage.ts against the package's own index.d.ts, the way a consumer would.
# markdown-it 15 ships its own types, so only typescript is needed, and it is fetched at a pinned version
# instead of being added to a package.json.
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes -p typescript@5.9.3 tsc --noEmit --strict --module nodenext --moduleResolution nodenext \
  --lib es2022,dom packages/core/types/usage.ts
