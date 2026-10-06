import { defineConfig, mergeConfig } from 'vitest/config';
import source from './vitest.plugin-runtime-source.config.ts';
// Test-only whole Original collaborators resolve dormant outside-domain imports.
// Actual kernel state, options, storage and owner bindings execute on canonical SQLite.
export default mergeConfig(source, defineConfig({ test: {
  include: ['tests/plugin-runtime/kernel/*.test.ts'], environment: 'node', fileParallelism: false
} }));
