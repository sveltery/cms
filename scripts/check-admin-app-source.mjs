import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const manifest = JSON.parse(readFileSync(new URL('../parity/emdash/admin-app-source/sources.json', import.meta.url), 'utf8'));
if (manifest.sourcePin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw Error('Source pin changed');
let totalBytes = 0, callbacks = 0, expects = 0;
for (const authority of manifest.authorities) {
 const bytes = readFileSync(new URL(`../${authority.nativeAuthority}`, import.meta.url));
 const hash = createHash('sha256').update(bytes).digest('hex');
 const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 if (bytes.length !== authority.bytes || hash !== authority.sha256 || blob !== authority.gitBlob) throw Error(`Whole Source authority changed: ${authority.sourcePath}`);
 totalBytes += bytes.length;
 if (!authority.sourcePath.includes('/tests/') || !authority.sourcePath.includes('.test.')) continue;
 const parsed = ts.createSourceFile(authority.sourcePath, bytes.toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 function visit(node) {
  if (ts.isCallExpression(node)) {
   if (ts.isIdentifier(node.expression) && node.expression.text === 'it') callbacks++;
   if (ts.isPropertyAccessExpression(node.expression) && node.expression.getText(parsed).startsWith('expect') && node.expression.name.text.startsWith('to')) expects++;
  }
  ts.forEachChild(node, visit);
 }
 visit(parsed);
}
if (callbacks !== 12 || expects !== 13) throw Error(`Source declaration/matcher count changed: ${callbacks}/${expects}`);
console.log(JSON.stringify({ wholeAuthorities: manifest.authorities.length, totalBytes, callbacks, staticExpects: expects, productTestsRun: 0 }));
