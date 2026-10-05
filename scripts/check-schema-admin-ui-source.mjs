import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const families = [
  ['ContentTypeEditor','6ffa09625a7f51827a22a65981729de2c7313da40ea31f1334cf3b88f1737b59'],
  ['ContentTypeList','7c84fcf92d382f420e9dc9ed4c7b755c177da018526a53e7d00a1508bda123c7'],
  ['FieldEditor','1f5b416163acee67fbe39121a4e8fd1e0d791767d1392a9e53e4cc2b36f8c42f'],
  ['FieldEditor.blocks','8e2758c90cb3cd3dfe3096d4a5e29c37a199bf00e1fdfe4a45e43bfe30953a30']
];
for (const [name,known] of families) {
  const authority = readFileSync(`parity/emdash/schema-admin-completion-source/authority/packages/admin/tests/components/${name}.test.tsx.source`);
  const executable = readFileSync(`parity/emdash/schema-admin-ui-source/packages/admin/tests/components/${name}.test.tsx`);
  if (!authority.equals(executable)) throw new Error(`Whole immutable schema UI file changed: ${name}`);
  const hash = createHash('sha256').update(executable).digest('hex');
  if (known && hash !== known) throw new Error(`Pinned SHA mismatch: ${name}`);
}
console.log('Four whole immutable Source schema UI files are byte-exact; 138 declarations retained.');
