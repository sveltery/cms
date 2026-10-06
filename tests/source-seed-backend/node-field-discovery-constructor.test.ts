// Exact Native host transport controls; immutable Source bodies remain separate.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

const native = 'src/lib/server/seed/upstream/media/usage/content-fields.ts';
const source = 'parity/emdash/full-seed-engine/source/packages/core/src/media/usage/content-fields.ts';
const name = 'MediaUsageFieldDiscoveryError';
type Instance = Error & { code?: string };
type Constructor = new (...arguments_: unknown[]) => Instance;
function constructor(path: string): Constructor {
  const text = readFileSync(path, 'utf8'), file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const classes = file.statements.filter(node => ts.isClassDeclaration(node) && node.name?.text === name);
  if (classes.length !== 1) throw new Error('Expected the complete immutable error class');
  const output = ts.transpileModule(classes[0].getText(file).replace(/^export /, '') + `\n${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, useDefineForClassFields: true },
  }).outputText;
  return vm.runInNewContext(output) as Constructor;
}
function descriptors(instance: Instance) {
  const actual: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(instance);
  if ('stack' in actual) {
    expect(typeof Reflect.get(instance, 'stack')).toBe('string');
    const { get, set, value: _stack, ...flags } = actual.stack;
    return { ...actual, stack: { ...flags, ...('value' in actual.stack
      ? { value: '<actual stack string>' } : { get: typeof get, set: typeof set }) } };
  }
  return actual;
}

it('invokes the actual field-discovery error constructor in unchanged direct Node24', () => {
  const script = `const {${name}}=await import('./${native}');const actual=new ${name}('Actual field discovery','INVALID_BLOCK_VALIDATION');actual.code='UNSUPPORTED_BLOCK_DEFINITION';console.log(JSON.stringify({keys:Object.keys(actual),name:actual.name,code:actual.code}));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: process.cwd(), encoding: 'utf8' });
  expect(child.status, child.stderr).toBe(0);
  expect(JSON.parse(child.stdout.trim())).toEqual({ keys: ['code', 'name'], name, code: 'UNSUPPORTED_BLOCK_DEFINITION' });
});

it('preserves the complete Source error own-field order, mutable descriptors, undefined and subclass semantics', () => {
  const Original = constructor(source), Native = constructor(native);
  const reference = { reference: 'actual shared JavaScript constructor argument' };
  const cause = new Error('Unused third constructor argument');
  for (const arguments_ of [[], ['message', undefined], ['message', 'INVALID_REPEATER_VALIDATION'], ['message', reference, { cause }]]) {
    const expected = new Original(...arguments_), actual = new Native(...arguments_);
    expect(descriptors(actual)).toEqual(descriptors(expected));
    expect(Object.keys(actual)).toEqual(Object.keys(expected));
    expect(Object.hasOwn(actual, 'cause')).toBe(Object.hasOwn(expected, 'cause'));
    if (arguments_[1] === reference) {
      expect(Reflect.get(actual, 'code')).toBe(reference);
      expect(Reflect.get(expected, 'code')).toBe(reference);
      expect(Object.hasOwn(actual, 'cause')).toBe(false);
    }
    actual.code = expected.code = 'UNSUPPORTED_BLOCK_DEFINITION';
    expect(descriptors(actual)).toEqual(descriptors(expected));
    class OriginalChild extends Original { child = 1; }
    class NativeChild extends Native { child = 1; }
    expect(descriptors(new NativeChild(...arguments_))).toEqual(descriptors(new OriginalChild(...arguments_)));
  }
});
