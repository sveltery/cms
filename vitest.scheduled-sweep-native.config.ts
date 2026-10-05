import { defineConfig } from 'vitest/config';
import calendar from './vitest.calendar-source.config.ts';

// The Native storage contracts are supplemental and earn zero Source28 credit.
export default defineConfig({
  ...calendar,
  test: {...calendar.test, include: ['tests/scheduling-native/sweep.test.ts']}
});
