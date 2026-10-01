#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) { console.error("Use Node.js 24"); process.exit(1); }'
if [ "$(pnpm --version)" != "12.6.0" ]; then
  echo 'Use pnpm 12.6.0 (packageManager is pinned in package.json)' >&2
  exit 1
fi
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
