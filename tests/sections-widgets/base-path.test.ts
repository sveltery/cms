// Original native transport/SSR requirements. No HTTP, browser or Source callback credit.
// The fixture supplies the framework /cms mount; fetch always fails, never returns fake success.
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { fetchSections, fetchWidgetAreas } from '../../src/lib/sections-widgets/api.ts';
import { navigateSection } from '../../src/lib/sections-widgets/navigation.ts';
import SectionEditorForm from '../../src/lib/ui/sections-widgets/SectionEditorForm.svelte';

afterEach(() => vi.unstubAllGlobals());
it('native section and widget API calls remain inside the configured /cms application', async () => {
  const failure = new TypeError('network unavailable');
  const fetch = vi.fn().mockRejectedValue(failure); vi.stubGlobal('fetch', fetch);
  await expect(fetchSections({ search: 'hero' })).rejects.toBe(failure);
  await expect(fetchWidgetAreas()).rejects.toBe(failure);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/cms/api/sections?search=hero', '/cms/api/widget-areas']);
  for (const [, init] of fetch.mock.calls) expect((init as RequestInit).headers).toBeInstanceOf(Headers);
});
it('the native section metadata form back link remains inside /cms', () => {
  const section = { id: 'section', slug: 'hero', title: 'Hero', description: '', keywords: [], content: [], source: 'user' as const, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  const { body } = render(SectionEditorForm, { props: { section, isSaving: false, pluginBlocks: [], onSave: () => {}, canManage: true } });
  expect(body).toContain('href="/cms/sections"');
});
it('default native edit navigation remains inside /cms and preserves slug encoding', () => {
  const location = { href: '' }; vi.stubGlobal('window', { location });
  navigateSection('hero banner');
  expect(location.href).toBe('/cms/sections/hero%20banner');
});
