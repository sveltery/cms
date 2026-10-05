import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',fileParallelism:false,include:['tests/calendar-presentation-private.test.ts']}});
