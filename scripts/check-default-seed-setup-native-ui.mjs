// Supplemental Native presentation fixtures; no execution or Source causal credit.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const ledger = JSON.parse(await readFile(resolve(root, 'docs/default-seed-setup-native-ui.json'), 'utf8'));
const read = file => readFile(resolve(root, file), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
for (const [file, expected] of Object.entries(ledger.nativeFixtures)) {
  if (sha(await read(file)) !== expected) throw new Error('Authorized Native fixture changed: ' + file);
}
if (sha(await read(ledger.originalSourceBrowserConfig.path)) !== ledger.originalSourceBrowserConfig.sha256) {
  throw new Error('Complete Original18 browser configuration changed');
}
let workflow = await read('.github/workflows/default-seed-setup-source.yml');
const addition = '      - name: Run Native presentation lifecycle controls in sandboxed Chromium\n'
  + '        run: timeout --kill-after=30s 360s pnpm exec vitest run --config vitest.default-seed-setup-wizard-native.browser.config.ts --reporter=verbose --reporter=json --outputFile.json=setup-native-results.json\n'
  + '        env:\n          DEBUG: pw:browser\n';
if (workflow.split(addition).length !== 2) throw new Error('Authorized Native workflow addition absent or repeated');
workflow = workflow.replace(addition, '');
const reporter = '            setup-native-results.json\n';
if (workflow.split(reporter).length !== 2) throw new Error('Authorized Native artifact path absent or repeated');
workflow = workflow.replace(reporter, '');
if (sha(workflow) !== ledger.ownedWorkflowBeforeSha256) throw new Error('Original18 workflow exceeds finite addition');
if (sha(await read('src/lib/ui/SetupWizard.svelte')) !== (ledger.productionCurrentSha256 ?? ledger.productionAuthorizedSha256 ?? ledger.productionBeforeSha256)) {
  throw new Error('Production UI exceeds the current authorized test-first phase');
}
console.log('Native3 controlled fixtures qualified; Original18 command/config and current production phase exact;0execution/Source causal credit.');
