import { defineConfig } from 'vitest/config';
export default defineConfig({ plugins: [{
  name: 'prepared-calendar-picker-pure-controlled-kit-base', enforce: 'pre',
  resolveId(id) { if (id === '$app/paths') return '\0prepared-calendar-picker-pure-base'; },
  load(id) { if (id === '\0prepared-calendar-picker-pure-base') return "export const base='';"; },
}], test: {
  environment: 'node', fileParallelism: false,
  include: ['tests/calendar-picker-keyboard/*.test.ts'],
} });
