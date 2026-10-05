import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '..');
const ledger = JSON.parse(readFileSync(path.join(root, 'docs/scheduled-publishing-source.json'), 'utf8'));
if (ledger.pin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e' || ledger.families.length !== 16) throw new Error('Scheduling Source pin/family inventory changed');
for (const row of ledger.sourceFiles) {
  const data = readFileSync(path.join(root, row.copy));
  const sha = createHash('sha256').update(data).digest('hex');
  const blob = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if (data.length !== row.bytes || sha !== row.sha256 || blob !== row.gitBlob) throw new Error(`Whole immutable Source mismatch: ${row.source}`);
}

// Inspect callee structure, not getText(): formatting such as
// expect\n  .element(...) and expect\n  .poll(...) is the same property access.
const registrationMethods = new Set(['only', 'skip', 'todo', 'concurrent', 'fails', 'each', 'for']);
function registrationRoot(expression) {
  if (ts.isIdentifier(expression)) return ['it', 'test'].includes(expression.text) ? expression.text : undefined;
  if (ts.isPropertyAccessExpression(expression) && registrationMethods.has(expression.name.text))
    return registrationRoot(expression.expression);
  if (ts.isCallExpression(expression)) return registrationRoot(expression.expression);
}
function matcherRoot(expression) {
  if (ts.isIdentifier(expression) && expression.text === 'expect') return 'direct';
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'expect' && ['element', 'poll'].includes(expression.name.text))
    return expression.name.text;
}
function structuralCensus(family) {
  const authority = ledger.sourceFiles.find(row => row.source === family.path);
  if (!authority) throw new Error(`Missing whole test authority: ${family.path}`);
  const filename = path.join(root, authority.copy);
  const text = readFileSync(filename, 'utf8');
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) throw new Error(`Source syntax census failed: ${family.path}`);
  const row = {path: family.path, declarations: 0, direct: 0, element: 0, poll: 0,
    multilineElement: 0, multilinePoll: 0, staticMatcherRoots: 0};
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (registrationRoot(node.expression) && node.arguments.some(argument =>
        ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) row.declarations++;
      const kind = matcherRoot(node.expression);
      if (kind) {
        row[kind]++; row.staticMatcherRoots++;
        if (kind !== 'direct' && /[\r\n]/.test(node.expression.getText(source)))
          row[kind === 'element' ? 'multilineElement' : 'multilinePoll']++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return row;
}
const rows = ledger.families.map(structuralCensus);
const keys = ['declarations', 'direct', 'element', 'poll', 'multilineElement', 'multilinePoll', 'staticMatcherRoots'];
const totals = Object.fromEntries(keys.map(key => [key, rows.reduce((sum, row) => sum + row[key], 0)]));
const expected = ledger.currentStructuralCensus;
if (!expected || JSON.stringify(rows) !== JSON.stringify(expected.families) ||
  JSON.stringify(totals) !== JSON.stringify(expected.totals)) throw new Error('Current structural scheduling census differs');
console.log(`Scheduling provenance: ${ledger.families.length} whole test families / ${ledger.sourceFiles.length} whole pinned files; ` +
  `${totals.declarations} declarations / ${totals.staticMatcherRoots} static matcher roots ` +
  `(${totals.direct} direct, ${totals.element} element, ${totals.poll} poll); assertion execution credit is separate.`);
