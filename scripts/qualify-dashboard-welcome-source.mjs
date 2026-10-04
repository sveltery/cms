import assert from 'node:assert/strict';

export const ASSERTION_CONTEXT = 'DASHBOARD_SOURCE_ASSERTION_CONTEXT=';
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const title = 'warns when scheduled content is overdue and the scheduler has never completed';
const declarationHash = 'ccb63e7af54f541c31a5d33cc6ada61f0475779189c201ed5538b85f47bdb67a';
const expectedExpressionHash = 'a7988810a852430af77f280816a2d4e4963af98929b7a842ae3663b3d21e90e9';

// Qualify one explicit framework/command difference after the ENTIRE untouched
// Source family executes. This never edits, skips, re-runs or passes a callback.
/** @typedef {{title: string, status: string, failureMessages: string[]}} SourceResult */
/** @typedef {{name: string, assertionResults: SourceResult[]}} SourceSuite */
/** @typedef {{numTotalTests: number, numPassedTests: number, numFailedTests: number, numPendingTests: number, numTodoTests: number, success: boolean, testResults: SourceSuite[]}} SourceReport */
/** @typedef {{sourcePin: string, declarations: {source: string, title: string, sha256: string, expectations: {sha256: string}[]}[]}} SourceManifest */
/** @param {{report: SourceReport, rawLog: string, runnerExit: number | null, sources: SourceManifest}} input */
export function qualifyDashboardSource({ report, rawLog, runnerExit, sources }) {
  assert.equal(sources.sourcePin, pin);
  assert.equal(sources.declarations.length, 33);
  const allowed = sources.declarations.find(row => row.title === title);
  assert.equal(allowed?.sha256, declarationHash);
  assert.equal(allowed?.expectations[1]?.sha256, expectedExpressionHash);
  assert.equal(runnerExit, 1, 'Preserve the actual Source runner exit1');
  assert.equal(report.numTotalTests, 33);
  assert.equal(report.numPassedTests, 32);
  assert.equal(report.numFailedTests, 1);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests, 0);
  assert.equal(report.success, false);
  assert.doesNotMatch(rawLog, /Unhandled Errors|Vitest caught \d+ unhandled errors|Uncaught Exception/);
  const expected = new Set(sources.declarations.map(row => `${row.source.split('/').at(-1)}:${row.title}`));
  const seen = new Set();
  /** @type {SourceResult | undefined} */
  let failed;
  for (const suite of report.testResults) {
    const filename = suite.name.replaceAll('\\', '/').split('/').at(-1);
    assert.ok(filename === 'Dashboard.test.tsx' || filename === 'WelcomeModal.test.tsx');
    assert.equal(suite.assertionResults.length, filename === 'Dashboard.test.tsx' ? 24 : 9);
    for (const result of suite.assertionResults) {
      const key = `${filename}:${result.title}`;
      assert.ok(expected.has(key), `Unexpected Source callback ${key}`);
      assert.ok(!seen.has(key), `Duplicate Source callback ${key}`); seen.add(key);
      if (result.status === 'failed') {
        assert.equal(filename, 'Dashboard.test.tsx'); assert.equal(result.title, title);
        assert.equal(result.failureMessages.length, 1); failed = result;
      } else {
        assert.equal(result.status, 'passed'); assert.deepEqual(result.failureMessages, []);
      }
    }
  }
  assert.equal(seen.size, 33); assert.ok(failed);
  const message = failed.failureMessages[0];
  assert.match(message, /AssertionError: expected false to be true/);
  const traces = message.split('\n').filter(line => line.startsWith(ASSERTION_CONTEXT));
  assert.ok(traces.length >= 1 && traces.length <= 2, 'Actual failing value needs diagnostic context');
  const contexts = traces.map(line => JSON.parse(line.slice(ASSERTION_CONTEXT.length)));
  for (const context of contexts) {
    assert.equal(context.operation, 'toBeInTheDocument');
    assert.equal(context.negate, false); assert.equal(context.expectedPresent, true); assert.equal(context.actualPresent, false);
    assert.deepEqual(context.selector, { kind: 'text', pattern: { kind: 'regexp', source: 'npx emdash doctor', flags: 'i' } });
    assert.match(context.actualText, /no scheduler run has completed/i);
    assert.match(context.actualText, /pnpm doctor/);
    assert.match(context.actualText, /sveltery-doctor/);
  }
  if (contexts.length === 2) assert.deepEqual(contexts[0], contexts[1]);
  return { qualification: 'complete Source33 with accepted actual Native CLI command divergence',
    sourcePin: pin, executed: 33, sourcePassed: 32, sourceFailed: 1, runnerExit: 1,
    sourceAllGreen: false, acceptedCallback: title, declarationHash, expectedExpressionHash,
    sourceCreditForAcceptedCallback: 0, actualFailingValue: contexts[0] };
}
