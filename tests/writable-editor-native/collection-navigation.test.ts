import { expect, it } from 'vitest';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Original actual built-HTTP regressions. Preserve the established default-locale
// route while retaining the selected non-default locale. No Source callback credit.
for (const target of ['Node', 'D1'] as const) {
  it(`${target} collection links preserve default entry routes and explicit French identity`, async () => {
    // A real Node process preserves server-only package export conditions. The
    // enclosing DOM host sets browser conditions and cannot execute actual SSR.
    const result = await promisify(execFile)(process.execPath, [
      resolve(process.cwd(), 'tests/helpers/writable-editor-dom/collection-navigation-worker.ts'), target
    ]);
    expect(JSON.parse(result.stdout)).toEqual({ target, checks: 4 });
  });
}
