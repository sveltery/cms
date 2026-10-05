import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,include:['tests/general-media/*.test.ts']}});
