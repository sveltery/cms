import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,include:['tests/source-seed-backend/node-budget-constructor.test.ts','tests/source-seed-backend/node-seed-constructor-semantics.test.ts','tests/source-seed-backend/node-field-discovery-constructor.test.ts']}});
