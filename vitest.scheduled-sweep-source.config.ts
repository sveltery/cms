import { defineConfig } from 'vitest/config';
import calendar from './vitest.calendar-source.config.ts';

// Whole original scheduler family; no callback selection or Source edits.
export default defineConfig({
  ...calendar,
  test: {
    ...calendar.test,
    include: [
      'parity/emdash/scheduled-publishing-source/upstream/packages/core/tests/unit/scheduled-publish.test.ts',
      'tests/scheduling-native/sweep.test.ts'
    ]
  }
});
