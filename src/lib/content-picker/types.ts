export interface ContentItem {
  id: string; type: string; slug: string | null; data: Record<string, unknown>;
  locale: string; translationGroup: string | null;
  liveRevisionId: string | null; draftRevisionId: string | null;
}
export interface PickedContentEntry {
  collection: string; id: string; slug: string | null; title: string;
  locale?: string; translationGroup?: string | null;
}
export interface FindManyResult<T> { items: T[]; nextCursor?: string; total?: number }
export interface PickerManifest { collections: Record<string, { titleField?: string }> }
export interface PickerListOptions { limit?: number; cursor?: string; search?: string; locale?: string }
export interface ContentPickerClient {
  fetchCollections(): Promise<{ slug: string; label: string }[]>;
  fetchManifest(): Promise<PickerManifest>;
  fetchContentList(collection: string, options?: PickerListOptions): Promise<FindManyResult<ContentItem>>;
}
