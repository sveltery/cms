import { defineConfig } from 'vitest/config';
import relationConfig from './vitest.relations-handlers-source.config.ts';
// Whole future lifecycle families. Their unresolved current public producer
// boundaries are recorded separately; this readiness command is not a passing
// Source gate or a completed parity claim.
export default defineConfig({...relationConfig,test:{environment:'node',fileParallelism:false,
  include:['parity/emdash/relations-source/executable/packages/core/tests/integration/content/content-references-write.test.ts',
    'parity/emdash/relations-source/executable/packages/core/tests/integration/content/reference-constraints.test.ts',
    'parity/emdash/relations-source/executable/packages/core/tests/integration/content/reference-draft-lifecycle.test.ts']}});
