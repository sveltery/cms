import { defineConfig } from 'vitest/config';
// Controlled pure geometry/timer fixtures; zero actual browser geometry credit.
export default defineConfig({test:{environment:'node',fileParallelism:false,include:['tests/calendar-tooltip-geometry/*.test.ts']}});
