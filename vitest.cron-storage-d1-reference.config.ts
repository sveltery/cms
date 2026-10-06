// Supplemental real-D1 comparison. Original Source105-row insert exceeds100 binds.
// Retain the whole family and failure; this is not a mandatory fake-green gate.
import { defineConfig, mergeConfig } from 'vitest/config';
import source from './vitest.cron-storage-source.config.ts';
export default mergeConfig(source, defineConfig({ test: { provide: { cronStorageDialects: ['d1'] } } }));
