import { defineConfig } from 'vitest/config';
import welcome from './vitest.setup-api-welcome.config.ts';
export default defineConfig({
  ...welcome,
  test: {
    ...welcome.test,
    include: ['tests/setup-api-native/login-continuation.test.ts']
  }
});
