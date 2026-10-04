import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/taxonomy-d1/*.test.mjs'],environment:'node',fileParallelism:false}});
