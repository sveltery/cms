import { afterEach, expect, it, vi } from 'vitest';
import { createContentPickerClient } from '../../src/lib/content-picker/client.ts';
afterEach(() => { vi.unstubAllGlobals(); });
it('client retains mounted paths and safely encodes the Source query and cursor without adding a menu locale', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { items: [], nextCursor: 'next' } }), { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  const result = await createContentPickerClient('/admin').fetchContentList('people', { limit: 50, search: '50% & needle', cursor: 'a/b?cursor' });
  const url = new URL(fetch.mock.calls[0][0], 'https://cms.test');
  expect(url.pathname).toBe('/admin/api/content-picker/content/people'); expect(url.searchParams.get('q')).toBe('50% & needle');
  expect(url.searchParams.get('cursor')).toBe('a/b?cursor'); expect(url.searchParams.get('limit')).toBe('50'); expect(url.searchParams.has('locale')).toBe(false);
  expect(result.nextCursor).toBe('next');
});
it('client requests real collections and manifests and surfaces transport error messages', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [{ slug: 'people', label: 'People' }] } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { collections: { people: { titleField: 'full_name' } } } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Search unavailable' } }), { status: 503 }));
  vi.stubGlobal('fetch', fetch); const api = createContentPickerClient('/admin');
  expect(await api.fetchCollections()).toEqual([{ slug: 'people', label: 'People' }]);
  expect((await api.fetchManifest()).collections.people.titleField).toBe('full_name');
  await expect(api.fetchContentList('people')).rejects.toThrow('Search unavailable');
  expect(fetch.mock.calls.map(call => call[0])).toEqual(['/admin/api/content-picker/collections', '/admin/api/content-picker/manifest', '/admin/api/content-picker/content/people']);
});
