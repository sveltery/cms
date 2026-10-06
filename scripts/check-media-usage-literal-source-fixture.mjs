// Strict reverse whole-byte guard for the Root-qualified test-only date option.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const before=readFileSync('parity/emdash/media-usage-maintenance-source/test-fixture/async-d1-storage-before-literal-source-date.ts.txt','utf8');
const actual=readFileSync('tests/helpers/async-d1-storage.ts','utf8');
let reversed=actual.replace("async function newRuntime(d1Databases: Record<string, string>, directory?: string, script?: string|readonly FixtureWorkerModule[], literalSourceCompatibilityDate?: '2026-05-14') {\n  if (literalSourceCompatibilityDate !== undefined && literalSourceCompatibilityDate !== '2026-05-14') {\n    throw new Error('Only the pinned literal Source fixture compatibility date is supported');\n  }",'async function newRuntime(d1Databases: Record<string, string>, directory?: string, script?: string|readonly FixtureWorkerModule[]) {')
.replace("compatibilityDate: literalSourceCompatibilityDate ?? '2026-05-07', host:","compatibilityDate: '2026-05-07', host:")
.replace("export async function asyncD1StorageFor(databaseName: string, directory?: string, script?: string|readonly FixtureWorkerModule[], literalSourceCompatibilityDate?: '2026-05-14') {\n  const runtime = await newRuntime({ DB: databaseName }, directory, script, literalSourceCompatibilityDate);",'export async function asyncD1StorageFor(databaseName: string, directory?: string, script?: string|readonly FixtureWorkerModule[]) {\n  const runtime = await newRuntime({ DB: databaseName }, directory, script);');
assert.equal(reversed,before,'The complete old helper bytes must survive exactly when the finite new date input is erased');
const source=readFileSync('/tmp/cms-emdash-full/packages/core/vitest.workerd.config.ts','utf8');
const native=readFileSync('vitest.media-usage-maintenance-reference-d1-v2.config.ts','utf8');
for(const text of ['export const waitUntil = undefined;','export const createScheduler = null;','export default {};','export const env = undefined;','export const createObjectCache = undefined; export const objectCacheConfig = {};']){
 assert.ok(source.includes(text));assert.ok(native.includes(text));
}
assert.ok(source.includes('testTimeout: 30_000'));assert.ok(source.includes('hookTimeout: 30_000'));
assert.ok(native.includes('testTimeout:30_000,hookTimeout:30_000'));
assert.ok(readFileSync('tests/helpers/media-usage-maintenance/reference-workerd-v2-env.ts','utf8').includes("undefined,undefined,'2026-05-14'"));
console.log(JSON.stringify({completeOldHelperBytes:Buffer.byteLength(before),oldHelperSha256:createHash('sha256').update(before).digest('hex'),strictReverseWholeByteGuard:true,exactFiveSourceVirtualStrings:true,sourceTestAndHookTimeout:30000,oldDefaultAndAllFlagsPreserved:true,queriesExecuted:0,parityCredit:0}));
