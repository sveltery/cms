// Exact approved existing Native fixture transports; zero execution credit.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ledger = JSON.parse(await read('docs/default-seed-setup-fixture-seed-producers.json'));
for (const [path, authority] of Object.entries(ledger.files)) {
  const before = await read(authority.beforeAuthority);
  const current = await read(path);
  if (sha(before) !== authority.beforeSha256 || sha(current) !== authority.currentSha256) {
    throw new Error('Isolated seed producer transport exceeds approved file: ' + path);
  }
  const reverse = current.toString()
    .replace('cp, mkdir, mkdtemp', 'cp, mkdtemp')
    .replace("import { sourceSeedPlugin } from './scripts/source-seed-vite.ts';\n", '')
    .replace('plugins: [sourceSeedPlugin(), sveltekit(', 'plugins: [sveltekit(')
    .split('\n').filter(line => ![
      "await mkdir(join(directory, 'scripts'));",
      "cp(join(checkout, 'scripts/source-seed-vite.ts')",
      "cp(join(checkout, 'scripts/source-seed-virtual-module.ts')"
    ].some(span => line.includes(span))).join('\n');
  if (!Buffer.from(reverse).equals(before)) throw new Error('Whole six-span reversal failed: ' + path);
}
for (const [path, hash] of Object.entries(ledger.producerClosure)) {
  if (sha(await read(path)) !== hash) throw new Error('Genuine complete seed producer changed: ' + path);
}
const d1 = ledger.d1;
const before = await read(d1.beforeAuthority);
const current = await read(d1.path);
const helper = await read(d1.helperPath);
if (sha(before) !== d1.beforeSha256 || sha(current) !== d1.currentSha256 || sha(helper) !== d1.helperSha256) {
  throw new Error('Existing D1 genuine seed/observer transport exceeds exact approval');
}
const reverse = current.toString()
  .replace("import './helpers/source-seed-node-transport.ts';\n", '')
  .replace('    // Complete the real initial Seed lifetime before observing the old renewal workload.\n' +
    '    await Promise.all(lifetimeTasks);\n    lifetimeTasks.length = 0;\n', '');
if (!Buffer.from(reverse).equals(before)) throw new Error('Whole D1 two-insertion reversal failed');
console.log('Six complete isolated builds and existing D1 callback reverse exactly; real producer/helper closure exact;0execution credit.');
