// Native constructor compatibility controls; no Original callback/parity credit.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

const prefix = 'parity/emdash/source-seed-backend/source/';
const datetimeSource = prefix + 'packages/core/src/database/content-datetime.ts';
const datetimeNative = 'src/lib/server/seed/upstream/database/content-datetime.ts';
const cases = [
  { name: 'RelationRepository', native: 'src/lib/server/seed/upstream/database/repositories/relation.ts', source: prefix + 'packages/core/src/database/repositories/relation.ts' },
  { name: 'RevisionRepository', native: 'src/lib/server/seed/upstream/database/repositories/revision.ts', source: prefix + 'packages/core/src/database/repositories/revision.ts', datetime: true },
  { name: 'ContentDatetimeNormalizer', native: datetimeNative, source: datetimeSource },
  { name: 'ContentRepository', native: 'src/lib/server/seed/upstream/database/repositories/content.ts', source: prefix + 'packages/core/src/database/repositories/content.ts', datetime: true },
  { name: 'SchemaError', native: 'src/lib/server/seed/schema-error.ts', source: prefix + 'packages/core/src/schema/registry.ts', error: true },
  { name: 'OptionsRepository', native: 'src/lib/server/comments/upstream/database/repositories/options.ts', source: 'parity/emdash/comments-source/authority/packages/core/src/database/repositories/options.ts.txt' },
  { name: 'OptionsRepository', native: 'src/lib/server/options/repository.ts', source: 'parity/emdash/canonical-installation/source/packages/core/src/database/repositories/options.ts' },
] as const;

type Constructed = Record<string, unknown>;
type Constructor = new (...arguments_: unknown[]) => Constructed;
function completeClass(path: string, name: string): string {
  const text = readFileSync(path, 'utf8');
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const matches = file.statements.filter(node => ts.isClassDeclaration(node) && node.name?.text === name);
  if (matches.length !== 1) throw new Error(`Expected one complete real ${name} in ${path}`);
  return matches[0].getText(file).replace(/^export /, '');
}
function constructor(path: string, name: string, datetimePath?: string): Constructor {
  const dependencies = datetimePath ? completeClass(datetimePath, 'ContentDatetimeNormalizer') + '\n' : '';
  const code = ts.transpileModule(dependencies + completeClass(path, name) + `\n${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, useDefineForClassFields: true },
  }).outputText;
  return vm.runInNewContext(code) as Constructor;
}
function descriptors(value: Constructed) {
  const found = Object.getOwnPropertyDescriptors(value);
  // Error.stack contains the real constructor's source line. Compare its actual
  // presence and flags separately; all other own values/descriptors stay exact.
  if ('stack' in found) {
    expect(typeof Reflect.get(value, 'stack')).toBe('string');
    const { get, set, value: _stack, ...flags } = found.stack;
    return { ...found, stack: { ...flags, ...('value' in found.stack
      ? { value: '<actual stack string>' }
      : { get: typeof get, set: typeof set }) } };
  }
  return found;
}
for (const item of cases) {
  it(`${item.native}: imports the actual module in unchanged Node24 strip mode`, () => {
    const script = `const module = await import(${JSON.stringify('./' + item.native)}); console.log(typeof module[${JSON.stringify(item.name)}]);`;
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: process.cwd(), encoding: 'utf8' });
    expect(child.status, child.stderr).toBe(0);
    expect(child.stdout.trim()).toBe('function');
  });
  it(`${item.native}: preserves the complete real Source constructor's own-field semantics`, () => {
    const hasDatetime = 'datetime' in item && item.datetime;
    const Source = constructor(item.source, item.name, hasDatetime ? datetimeSource : undefined);
    const Native = constructor(item.native, item.name, hasDatetime ? datetimeNative : undefined);
    const database = { reference: 'same real constructor argument' };
    const contexts = new Map();
    const isError = 'error' in item && item.error;
    const arguments_ = isError ? ['message', 'code', database] : [database, contexts];
    const original = new Source(...arguments_), actual = new Native(...arguments_);
    expect(descriptors(actual)).toEqual(descriptors(original));
    expect(Object.keys(actual)).toEqual(Object.keys(original));
    expect(Reflect.get(actual, isError ? 'details' : 'db')).toBe(database);
    if ('contexts' in actual) expect(actual.contexts).toBe(contexts);
    if ('datetimeContexts' in actual) expect(actual.datetimeContexts).toBe(contexts);
    if ('datetimes' in actual) {
      expect(Reflect.get(actual.datetimes as object, 'db')).toBe(database);
      expect(Reflect.get(actual.datetimes as object, 'contexts')).toBe(contexts);
    }
    const originalUndefined = new Source(), actualUndefined = new Native();
    expect(descriptors(actualUndefined)).toEqual(descriptors(originalUndefined));
    class SourceChild extends Source { child = 1; }
    class NativeChild extends Native { child = 1; }
    expect(Object.keys(new NativeChild(...arguments_))).toEqual(Object.keys(new SourceChild(...arguments_)));
    if (isError) {
      actual.code = 'changed'; original.code = 'changed';
      actual.details = contexts; original.details = contexts;
      expect(descriptors(actual)).toEqual(descriptors(original));
    }
  });
}
