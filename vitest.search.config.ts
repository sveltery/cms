import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/source-search/*.test.ts'], fileParallelism: false, maxWorkers: 1 } });
