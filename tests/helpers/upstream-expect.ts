import assert from 'node:assert/strict';
import { it as nodeIt } from 'node:test';

// Runner-only adapter. Retains pinned Vitest assertion expressions and complete
// it.each datasets while delegating assertions to Node's built-in assertion API.
function match(actual: unknown, negate = false): any {
  const check = (value: boolean, message: string) => assert.equal(value, !negate, message);
  return {
    get not() { return match(actual, !negate); },
    get resolves() { return promiseMatchers(Promise.resolve(actual), false); },
    get rejects() { return promiseMatchers(Promise.resolve(actual), true); },
    toBe(expected: unknown) { check(Object.is(actual, expected), `Expected ${String(actual)} to be ${String(expected)}`); },
    toEqual(expected: unknown) {
      if (negate) assert.notDeepEqual(actual, expected); else assert.deepEqual(actual, expected);
    },
    toBeDefined() { check(actual !== undefined, 'Expected a defined value'); },
    toBeUndefined() { check(actual === undefined, 'Expected undefined'); },
    toBeNull() { check(actual === null, 'Expected null'); },
    toBeGreaterThan(expected: number) { check(typeof actual === 'number' && actual > expected, `Expected greater than ${expected}`); },
    toHaveLength(expected: number) { check((actual as {length: number}).length === expected, `Expected length ${expected}`); },
    toContain(expected: any) { check((actual as {includes(value: any): boolean}).includes(expected), `Expected to contain ${String(expected)}`); },
    toThrow(expected?: any) {
      if (negate) assert.doesNotThrow(actual as () => unknown);
      else if (expected === undefined) assert.throws(actual as () => unknown);
      else assert.throws(actual as () => unknown, expected);
    },
    toMatchObject(expected: any) { subset(actual, expected); }
  };
}
function promiseMatchers(promise: Promise<unknown>, rejected: boolean): any {
  return new Proxy({}, { get(_target, key: string) { return async (...args: any[]) => {
    let value: unknown; let didReject = false;
    try { value = await promise; }
    catch (cause) { didReject = true; value = cause; }
    if (rejected) assert.equal(didReject, true, 'Expected promise rejection');
    else if (didReject) throw value;
    if(key === 'toThrow') match(() => { throw value; }).toThrow(...args);
    else match(value)[key](...args);
  }; } });
}
function subset(actual: any, expected: any): void {
  if (expected === null || typeof expected !== 'object') { assert.deepEqual(actual, expected); return; }
  assert.ok(actual !== null && typeof actual === 'object');
  for (const key of Object.keys(expected)) subset(actual[key], expected[key]);
}
export function expect(actual: unknown): any { return match(actual); }
export const it = Object.assign(nodeIt, {
  each(rows: readonly any[]) {
    return (title: string, callback: (...args: any[]) => any) => {
      for (const [index, row] of rows.entries()) {
        const args = Array.isArray(row) ? row : [row];
        nodeIt(`${title} [dataset ${index}]`, () => callback(...args));
      }
    };
  }
});
