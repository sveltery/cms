import { defineConfig } from 'vitest/config';
import completeSourceConfig from './vitest.full-auth-reference-v2.config.ts';
import { qualifiedReferencePackages } from './tests/helpers/full-auth/qualified-reference-packages.ts';
export default defineConfig({ ...completeSourceConfig, plugins: [qualifiedReferencePackages(), ...(completeSourceConfig.plugins ?? [])] });
