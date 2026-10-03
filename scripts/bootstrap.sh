#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) { console.error("Use Node.js 24"); process.exit(1); }'
if [ "$(pnpm --version)" != "12.6.0" ]; then
  echo 'Use pnpm 12.6.0 (packageManager is pinned in package.json)' >&2
  exit 1
fi
# Name each phase so an interrupted CI job identifies the unfinished command.
# Keep every command, its order, and its exit status intact.
run_stage() {
  stage=$1
  shift
  printf '\n[validate] start: %s\n' "$stage"
  "$@"
  printf '[validate] finished: %s\n' "$stage"
}

run_stage 'frozen dependency install' pnpm install --frozen-lockfile
run_stage 'type and Svelte checks' pnpm check
run_stage 'service tests' pnpm test
run_stage 'source-port assertions' pnpm test:source-ports
run_stage 'source-port strict typing' node node_modules/typescript/bin/tsc --project tsconfig.source-ports.json
run_stage 'search source authority and callback audit' node scripts/check-search-source-ports.mjs
run_stage 'Node search source tests' pnpm test:search
run_stage 'D1 search source tests' env SVELTERY_SEARCH_STORAGE=D1 pnpm test:search
run_stage 'default production build' pnpm build
run_stage 'production remote tests' pnpm test:production
run_stage 'Node package and build' pnpm package:node
run_stage 'Node hosting tests' pnpm test:node
run_stage 'Cloudflare build and dry deployment bundle' pnpm build:cloudflare
run_stage 'Cloudflare source and Worker tests' pnpm test:cloudflare
