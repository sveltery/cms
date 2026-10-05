import { describe, expect, it } from 'vitest';
describe('Calendar administration production components', () => {
  it('provides the agenda component used by the actual route', async () => {
    await expect(import('../../src/lib/calendar/CalendarAgenda.svelte').then(m => typeof m.default).catch(() => 'missing')).resolves.toBe('function');
  });
  it('provides the filter component used by the actual route', async () => {
    await expect(import('../../src/lib/calendar/CalendarFilters.svelte').then(m => typeof m.default).catch(() => 'missing')).resolves.toBe('function');
  });
  it('provides the month component used by the actual route', async () => {
    await expect(import('../../src/lib/calendar/CalendarMonth.svelte').then(m => typeof m.default).catch(() => 'missing')).resolves.toBe('function');
  });
  it('provides the entry panel component used by the actual route', async () => {
    await expect(import('../../src/lib/calendar/CalendarEntryPanel.svelte').then(m => typeof m.default).catch(() => 'missing')).resolves.toBe('function');
  });
});
