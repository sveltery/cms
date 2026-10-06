import { defineConfig } from 'vitest/config';
import { sourceSeedPlugin } from './scripts/source-seed-vite.ts';
export default defineConfig({ plugins: [sourceSeedPlugin()], test: {
  environment: 'node', fileParallelism: false,
  include: ['tests/default-seed-setup-error-caller.test.ts'],
} });
