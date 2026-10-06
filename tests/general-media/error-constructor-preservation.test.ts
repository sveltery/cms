// Supplemental Native preservation checks run copied guards against isolated files.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const media = JSON.parse(read('parity/emdash/general-media-source/authority.json'));
const runtime = JSON.parse(read('parity/emdash/general-media-source/runtime-transformations.json'));
const byline = JSON.parse(read('docs/byline-backend-ports.json'));
const mediaFiles = [
  'scripts/check-general-media-source.mjs', 'scripts/node-error-constructor-transport.mjs',
  'parity/emdash/general-media-source/authority.json',
  'parity/emdash/general-media-source/runtime-transformations.json',
  ...media.authorities.map((row: {retained: string}) => row.retained),
  ...runtime.runtimeModules.map((row: {runtime: string}) => row.runtime),
  ...['r2-class', 'usage-read-functions', 'cleanup-blocks'].flatMap(name => {
    const path = `parity/emdash/general-media-source/${name}.json`;
    const row = JSON.parse(read(path));
    return [path, row.runtime, 'parity/emdash/general-media-source/upstream/' + row.source];
  }),
];
const bylineFiles = ['scripts/check-byline-source.mjs', 'scripts/node-error-constructor-transport.mjs', 'docs/byline-backend-ports.json',
  'src/lib/server/bylines/repository-types.ts', ...byline.authorities.map((row: {copy: string}) => row.copy)];

function runGuard(kind: 'media' | 'byline', replace?: [string, string]) {
  const fixture = mkdtempSync(join(tmpdir(), 'sveltery-error-guard-'));
  const target = kind === 'media' ? 'src/lib/server/general-media/upstream/storage/types.ts' : 'src/lib/server/bylines/repository-types.ts';
  try {
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'));
    for (const path of new Set(kind === 'media' ? mediaFiles : bylineFiles)) {
      mkdirSync(dirname(join(fixture, path)), {recursive: true});
      if (path.startsWith('scripts/') || path === target) {
        const bytes = read(path);
        if (path === target && replace) {
          if (!bytes.includes(replace[0])) throw new Error('Negative control token absent');
          writeFileSync(join(fixture, path), bytes.replace(replace[0], replace[1]));
        } else writeFileSync(join(fixture, path), bytes);
      } else symlinkSync(join(root, path), join(fixture, path));
    }
    return spawnSync(process.execPath, [join(fixture, `scripts/check-${kind === 'media' ? 'general-media' : 'byline'}-source.mjs`)], {encoding: 'utf8'});
  } finally { rmSync(fixture, {recursive: true, force: true}); }
}

for (const kind of ['media', 'byline'] as const) {
  it(`accepts only the exact ${kind} error constructor transport`, () => {
    const result = runGuard(kind);
    expect(result.status, result.stderr).toBe(0);
  });
  it(`rejects altered ${kind} error field initialization`, () => {
    const result = runGuard(kind, kind === 'media' ? ['this.cause = cause;', 'this.cause = undefined;'] : ['this.details = details;', 'this.details = undefined;']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Finite error constructor transport changed');
  });
  it(`rejects altered ${kind} original error body`, () => {
    const name = kind === 'media' ? 'EmDashStorageError' : 'EmDashValidationError';
    const result = runGuard(kind, [`this.name = "${name}";`, 'this.name = "DifferentError";']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Finite error constructor transport changed');
  });
}
