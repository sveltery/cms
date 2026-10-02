// Runner adapter only; source assertion expressions remain unchanged.
import assert from 'node:assert/strict';
import { expect as existingExpect, it } from './upstream-expect.ts';
export { it };
export function expect(actual: unknown): any {
  const match = existingExpect(actual);
  match.toBeTruthy = () => assert.ok(actual);
  match.toBeGreaterThanOrEqual = (expected: number) => assert.ok(typeof actual === 'number' && actual >= expected);
  return match;
}
