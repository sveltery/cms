import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/source-port/**/*.test.ts'], environment: 'node', globalSetup:['tests/helpers/source-port-native-build.ts'] } });
