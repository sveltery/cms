import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { qualifyDashboardSource, ASSERTION_CONTEXT } from '../../scripts/qualify-dashboard-welcome-source.mjs';

// Parser fixtures start with the full committed actual Source33 baseline report.
// Diagnostic metadata is supplied as a parser input only; this does not run or
// claim a native/Source callback, a doctor command, or a product response.
const original = JSON.parse(readFileSync(new URL('../../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r8-provider-corrected-source33-report.json', import.meta.url), 'utf8'));
const sources = JSON.parse(readFileSync(new URL('../../parity/emdash/dashboard-welcome-source/sources.json', import.meta.url), 'utf8'));
function fixture() {
  const report = structuredClone(original);
  const result = report.testResults.flatMap(suite => suite.assertionResults).find(row => row.status === 'failed');
  const context = { operation: 'toBeInTheDocument', negate: false, expectedPresent: true, actualPresent: false,
    selector: { kind: 'text', pattern: { kind: 'regexp', source: 'npx emdash doctor', flags: 'i' } },
    actualText: 'One scheduled item is overdue, but no scheduler run has completed. Run pnpm doctor in your project, or sveltery-doctor in a standalone installation.' };
  result.failureMessages[0] += `\n${ASSERTION_CONTEXT}${JSON.stringify(context)}`;
  return { report, sources: structuredClone(sources), rawLog: '', runnerExit: 1 };
}
test('qualifies all33 actual report rows while retaining32 passes, one failed value, exit1 and zero callback credit', () => {
  const result = qualifyDashboardSource(fixture());
  assert.equal(result.executed, 33); assert.equal(result.sourcePassed, 32); assert.equal(result.sourceFailed, 1);
  assert.equal(result.runnerExit, 1); assert.equal(result.sourceAllGreen, false); assert.equal(result.sourceCreditForAcceptedCallback, 0);
});
test('rejects another failed callback even when aggregate counts claim32/1', () => {
  const input = fixture(); const rows = input.report.testResults.flatMap(suite => suite.assertionResults);
  rows.find(row => row.status === 'passed').status = 'failed';
  assert.throws(() => qualifyDashboardSource(input));
});
test('rejects failure of the scheduler availability assertion in the same approved callback', () => {
  const input = fixture(); const failed = input.report.testResults.flatMap(suite => suite.assertionResults).find(row => row.status === 'failed');
  failed.failureMessages[0] = failed.failureMessages[0].replace('npx emdash doctor', 'no scheduler run has completed');
  assert.throws(() => qualifyDashboardSource(input));
});
test('rejects a callback that failed without the actual failing locator diagnostic', () => {
  const input = fixture(); const failed = input.report.testResults.flatMap(suite => suite.assertionResults).find(row => row.status === 'failed');
  failed.failureMessages = original.testResults.flatMap(suite => suite.assertionResults).find(row => row.status === 'failed').failureMessages;
  assert.throws(() => qualifyDashboardSource(input));
});
test('rejects unhandled errors, filtered execution, skipped callbacks and duplicate result rows', () => {
  for (const mutate of [
    input => { input.rawLog = 'Vitest caught 1 unhandled errors'; },
    input => { input.report.numTotalTests = 32; },
    input => { input.report.numPendingTests = 1; },
    input => { input.report.testResults[0].assertionResults[1] = input.report.testResults[0].assertionResults[0]; }
  ]) { const input = fixture(); mutate(input); assert.throws(() => qualifyDashboardSource(input)); }
});
test('rejects a modified pinned declaration or an invented all-green underlying runner', () => {
  const changed = fixture(); changed.sources.declarations.find(row => row.title.startsWith('warns when scheduled content is overdue and the scheduler has never')).sha256 = 'changed';
  assert.throws(() => qualifyDashboardSource(changed));
  const green = fixture(); green.runnerExit = 0; green.report.numFailedTests = 0; green.report.numPassedTests = 33; green.report.success = true;
  assert.throws(() => qualifyDashboardSource(green));
});
