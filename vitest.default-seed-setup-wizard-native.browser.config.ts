// Owned Native presentation controls; complete Original18 configuration stays exact.
import { defineConfig, type UserConfig } from 'vitest/config';
import { resolve } from 'node:path';
import original from './vitest.default-seed-setup-wizard.browser.config.ts';
const actual = original as UserConfig;
export default defineConfig({ ...actual,
  resolve: { ...actual.resolve, alias: { ...actual.resolve?.alias,
    '$lib/auth.remote': resolve(import.meta.dirname, 'tests/helpers/default-seed-setup/wizard-native-auth-remotes.ts'),
    '$lib/auth/passkey-browser': resolve(import.meta.dirname, 'tests/helpers/default-seed-setup/wizard-native-passkey-stop.ts') } },
  test: { ...actual.test, include: ['tests/default-seed-setup/wizard-native-presentation.test.tsx'] }
});
