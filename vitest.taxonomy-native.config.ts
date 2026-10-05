import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/taxonomy-native/*.test.mjs'],
    environment: 'node',
    fileParallelism: false
  }
});
