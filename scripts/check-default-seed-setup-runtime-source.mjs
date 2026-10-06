import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ledger = JSON.parse(await readFile(resolve(root, 'docs/default-seed-setup-runtime-source.json'), 'utf8'));
for (const authority of ledger.sourceAuthorities) {
  const bytes = await readFile(resolve(root, ledger.sourceRoot, authority.path));
  if (bytes.length !== authority.bytes || createHash('sha256').update(bytes).digest('hex') !== authority.sha256) {
    throw new Error(`Immutable Source authority changed: ${authority.path}`);
  }
}
const facade = ledger.blocksTypeFacade;
const index = await readFile(resolve(root, ledger.sourceRoot, facade.publicIndexAuthority), 'utf8');
const block = index.match(/export type\s*\{([^}]*?)\}\s*from\s*["']\.\/types\.js["']/);
if (!block) throw new Error('Actual Source public types.js export block absent');
const exports = block[1].replace(/\/\/[^\n]*/g, '').split(',').map(name => name.trim()).filter(Boolean);
if (JSON.stringify(exports) !== JSON.stringify(facade.exports)) {
  throw new Error('Actual Source public type export names/order changed');
}
const aliases = await readFile(resolve(root, facade.path), 'utf8');
if (createHash('sha256').update(aliases).digest('hex') !== facade.sha256) {
  throw new Error('Finite complete Source type-only facade changed');
}
const target = '../../../' + ledger.sourceRoot + '/' + facade.typesAuthority;
const expected = '// TEST ONLY: actual complete pinned Source types.js public export block.\n'
  + '// No runtime package/provider functions or fabricated type shapes.\n'
  + 'declare module "@emdash-cms/blocks" {\n'
  + exports.map(name => `  export type ${name} = import("${target}").${name};\n`).join('')
  + '}\n';
if (aliases !== expected) throw new Error('Type-only facade exceeds exact pinned public export aliases');
console.log(`Preserved ${ledger.sourceAuthorities.length} complete EmDash 1.1.0 authorities; execution credit is separate.`);
