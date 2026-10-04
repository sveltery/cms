import type { ContentItem, ContentPickerClient, FindManyResult, PickerListOptions, PickerManifest } from './types.ts';
export type { ContentItem, FindManyResult } from './types.ts';

// Source api/content.ts getDraftStatus, unchanged.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
export function getDraftStatus(item: ContentItem): 'unpublished' | 'published' | 'published_with_changes' {
  if (!item.liveRevisionId) return 'unpublished';
  if (item.draftRevisionId && item.draftRevisionId !== item.liveRevisionId) return 'published_with_changes';
  return 'published';
}
export function createContentPickerClient(basePath = ''): ContentPickerClient {
  async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${basePath}/api/content-picker/${path}`, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message ?? "Couldn't load content.");
    }
    const body: { data: T } = await response.json(); return body.data;
  }
  return {
    async fetchCollections() { return (await get<{ items: { slug: string; label: string }[] }>('collections')).items; },
    fetchManifest() { return get<PickerManifest>('manifest'); },
    fetchContentList(collection, options = {}) {
      const params = new URLSearchParams();
      if (options.cursor) params.set('cursor', options.cursor);
      if (options.limit) params.set('limit', String(options.limit));
      if (options.search) params.set('q', options.search);
      if (options.locale) params.set('locale', options.locale);
      return get<FindManyResult<ContentItem>>(`content/${encodeURIComponent(collection)}${params.size ? `?${params}` : ''}`);
    }
  };
}
const defaultClient = createContentPickerClient();
export const fetchCollections = () => defaultClient.fetchCollections();
export const fetchManifest = () => defaultClient.fetchManifest();
export const fetchContentList = (collection: string, options?: PickerListOptions) => defaultClient.fetchContentList(collection, options);
export const contentPickerClient: ContentPickerClient = { fetchCollections, fetchManifest, fetchContentList };
