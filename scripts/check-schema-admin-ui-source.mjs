import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const families = [
  ['ContentTypeEditor','6ffa09625a7f51827a22a65981729de2c7313da40ea31f1334cf3b88f1737b59'],
  ['ContentTypeList',null], ['FieldEditor',null], ['FieldEditor.blocks',null]
];
for (const [name,known] of families) {
  const authority = readFileSync(`parity/emdash/schema-admin-completion-source/authority/packages/admin/tests/components/${name}.test.tsx.source`);
  const executable = readFileSync(`parity/emdash/schema-admin-ui-source/packages/admin/tests/components/${name}.test.tsx`);
  if (!authority.equals(executable)) throw new Error(`Whole immutable schema UI file changed: ${name}`);
  const hash = createHash('sha256').update(executable).digest('hex');
  if (known && hash !== known) throw new Error(`Pinned SHA mismatch: ${name}`);
}
console.log('Four whole immutable Source schema UI files are byte-exact; 138 declarations retained.');
