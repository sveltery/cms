// Supplemental Native framework hosting controls; zero copied Source callback credit.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { EmDashValidationError } from '../../src/lib/server/bylines/repository-types.ts';
import { EmDashStorageError } from '../../src/lib/server/general-media/upstream/storage/types.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const classes = [
  {
    name: 'EmDashValidationError', native: EmDashValidationError,
    path: './src/lib/server/bylines/repository-types.ts',
    authority: 'parity/emdash/byline-source/upstream/packages/core/src/database/repositories/types.ts',
    fields: ['details'], args: [{ field: 'title', reason: 'required' }],
  },
  {
    name: 'EmDashStorageError', native: EmDashStorageError,
    path: './src/lib/server/general-media/upstream/storage/types.ts',
    authority: 'parity/emdash/general-media-source/upstream/packages/core/src/storage/types.ts',
    fields: ['code', 'cause'], args: ['STORAGE_FAILED', new Error('actual cause')],
  },
] as const;

function originalClass(row: typeof classes[number]): typeof Error {
  const file = ts.createSourceFile(row.authority, readFileSync(new URL(row.authority, new URL('../../', import.meta.url)), 'utf8'), ts.ScriptTarget.Latest, true);
  const node = file.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === row.name);
  if (!node) throw new Error('Missing immutable Source class: ' + row.name);
  const emitted = ts.transpileModule(node.getText(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, useDefineForClassFields: true },
  }).outputText;
  const module = { exports: {} as Record<string, typeof Error> };
  new Function('exports', emitted)(module.exports);
  return module.exports[row.name];
}

for (const row of classes) {
  it(`imports actual ${row.name} using unchanged Node strip mode`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      import { ${row.name} } from '${row.path}';
      const error = new ${row.name}('strip-mode', ${row.name === 'EmDashStorageError' ? "'CODE', 'cause'" : "'details'"});
      console.log(JSON.stringify({message:error.message,name:error.name,${row.fields.map(field => `${field}:error.${field}`).join(',')}}));
    `], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ message: 'strip-mode', name: row.name,
      ...(row.name === 'EmDashStorageError' ? { code: 'CODE', cause: 'cause' } : { details: 'details' }) });
  });

  it(`retains pinned ${row.name} values, own properties and subclass semantics`, () => {
    const Original = originalClass(row);
    for (const args of [row.args, row.name === 'EmDashStorageError' ? ['CODE', undefined] : [undefined]]) {
      const actual = Reflect.construct(row.native, ['message', ...args]) as Error & Record<string, unknown>;
      const original = Reflect.construct(Original, ['message', ...args]) as Error & Record<string, unknown>;
      expect(actual.message).toBe(original.message);
      expect(actual.name).toBe(original.name);
      expect(actual instanceof Error).toBe(true);
      expect(actual instanceof row.native).toBe(true);
      expect(Object.keys(actual)).toEqual(Object.keys(original));
      for (const field of row.fields) {
        expect(actual[field]).toBe(original[field]);
        expect(Object.getOwnPropertyDescriptor(actual, field)).toEqual(Object.getOwnPropertyDescriptor(original, field));
      }
      class Child extends row.native {}
      const child = Reflect.construct(Child, ['message', ...args]);
      expect(child instanceof Child).toBe(true);
      expect(child instanceof row.native).toBe(true);
      expect(child instanceof Error).toBe(true);
      expect(child.name).toBe(row.name);
    }
  });
}
