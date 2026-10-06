import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'parity/emdash/media-usage-maintenance-source/manifest.json'), 'utf8'));
if (manifest.pin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw new Error('Unexpected immutable pin');
let testDeclarations = 0, assertionExpressions = 0, wholeFamilies = 0;
for (const record of manifest.records) {
  const bytes = readFileSync(resolve(root, record.copiedPath));
  if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) {
    throw new Error(`Immutable whole Source bytes changed: ${record.sourcePath}`);
  }
  if (!record.ownedWholeFamily) continue;
  wholeFamilies++;
  const syntax = ts.createSourceFile(record.sourcePath, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(syntax);
      if (/^(?:it|test)(?:\.(?:only|skip|each|todo|fails|concurrent|sequential))*$/.test(callee)
          || /^(?:it|test)(?:\.\w+)*\([\s\S]*\)$/.test(callee)) testDeclarations++;
      if (ts.isIdentifier(node.expression) && node.expression.text === 'expect') assertionExpressions++;
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
}
const reference = JSON.parse(readFileSync(resolve(root, 'parity/emdash/media-usage-maintenance-source/reference-manifest.json'), 'utf8'));
if (reference.pin !== manifest.pin || reference.referenceOnly !== true || reference.nativeParityCredit !== 0) {
  throw new Error('Unexpected reference authority');
}
for (const record of reference.records) {
  const bytes = readFileSync(resolve(root, record.copiedPath));
  if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) {
    throw new Error(`Immutable reference closure changed: ${record.sourcePath}`);
  }
}
const native = JSON.parse(readFileSync(resolve(root, 'parity/emdash/media-usage-maintenance-source/native-body-manifest.json'), 'utf8'));
if (native.pin !== manifest.pin || native.sourceCausalCredit !== 0) throw new Error('Unexpected Native provenance');
for (const record of native.records) {
  const bytes = readFileSync(resolve(root, record.nativePath));
  if (createHash('sha256').update(bytes).digest('hex') !== record.nativeSha256) {
    throw new Error(`Native provenance requires an explicit delta record: ${record.nativePath}`);
  }
}
console.log(JSON.stringify({ immutableFiles: manifest.records.length, immutableReferenceFiles:reference.records.length,
  nativeWholeModuleTransports:native.records.filter(record=>!record.completeOwnedFunctions).length,
  nativeNamespaceImportOnlyTransports:native.records.filter(record=>!record.completeOwnedFunctions && !record.substitutions.some(delta=>delta.includes('parameter property')||delta.includes('D1 branch'))).length,
  nativeConstructorTransports:native.records.filter(record=>record.substitutions.some(delta=>delta.includes('parameter property'))).length,
  nativePhaseBranchTransports:native.records.filter(record=>record.substitutions.some(delta=>delta.includes('D1 branch'))).length,
  nativeCompleteOwnedFunctionGroups:native.records.filter(record=>record.completeOwnedFunctions).length, wholeFamilies,
  testDeclarations, assertionExpressions, productTestsRun: 0, causalCredit: 0 }));
