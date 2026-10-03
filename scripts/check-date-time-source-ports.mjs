import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import ts from 'typescript';
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'parity/emdash/date-time-widgets/source-manifest.json'), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
let declarations = 0, assertions = 0;
for (const authority of [...manifest.authorities, manifest.external_calendar_authority, ...manifest.external_day_picker_authorities]) {
  const bytes = readFileSync(resolve(root, authority.local));
  if (bytes.length !== authority.bytes || hash(bytes) !== authority.sha256) throw new Error(`Immutable date/time authority changed: ${authority.local}`);
  if (!authority.source?.includes('/tests/') || !/\.test\.tsx?$/.test(authority.source)) continue;
  const source = ts.createSourceFile(authority.source, bytes.toString(), ts.ScriptTarget.Latest, true);
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && expression.text === 'it' || ts.isCallExpression(expression) && expression.expression.getText(source) === 'it.each') declarations++;
    }
    if (ts.isExpressionStatement(node) && /^await\s+expect\b|^expect\b/.test(node.expression.getText(source))) assertions++;
    ts.forEachChild(node, visit);
  };
  visit(source);
}
for (const name of ['datetime-local', 'publishing-datetime']) {
  const source = readFileSync(resolve(root, `parity/emdash/date-time-widgets/source/packages/admin/src/lib/${name}.ts`), 'utf8');
  const native = readFileSync(resolve(root, `src/lib/ui/${name}.ts`), 'utf8').split('\n').slice(2).join('\n').replace('"./datetime-parsing"', '"./utils.js"');
  if (native !== source) throw new Error(`Pinned runtime helper changed: ${name}`);
}
console.log(JSON.stringify({ pin: manifest.pin, immutableAuthorities: manifest.authorities.length + 1 + manifest.external_day_picker_authorities.length, declarations, assertionExpressions: assertions, productTestsRun: 0 }));
