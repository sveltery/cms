import { query, form, requested } from '$app/server';
import { collectionSlug, contentKey, contentList, createInput, updateInput, trashInput, withRevision, precondition } from '$lib/server/content/schema';
import { requestContent, contentResponse } from '$lib/server/content/request';

export const getEditorManifest = query(() => contentResponse(() => requestContent().getEditorManifest()));
export const listCollections = query(() => contentResponse(() => requestContent().listCollections()));
export const getCollection = query(collectionSlug, collection => contentResponse(() => requestContent().getCollection(collection)));
export const listContent = query(contentList, ({ collection, ...options }) => contentResponse(async () => {
  const page = await requestContent().listDrafts({ type: collection, ...options });
  return { ...page, items: page.items.map(withRevision) };
}));
export const getContent = query(contentKey, ({ collection, ...key }) => contentResponse(async () =>
  withRevision(await requestContent().getDraft({ type: collection, ...key }))));
export const createContent = form(createInput, ({ collection, ...input }) => contentResponse(async () => {
  const value = withRevision(await requestContent('mutation').createDraft({ type: collection, ...input }));
  await refreshContent(collection, input.locale);
  return receipt(value);
}));
export const updateContent = form(updateInput, (input) => contentResponse(async () => {
  const service = requestContent('mutation');
  const { collection, _rev, ...value } = input;
  const record = withRevision(await service.updateDraft({ type: collection, ...value, expected: precondition(input) }));
  await refreshContent(collection, value.locale, value.id);
  return receipt(record);
}));
/** Recoverable trash; retained rows remain in storage. */
export const deleteContent = form(trashInput, (input) => contentResponse(async () => {
  const service = requestContent('mutation');
  const { collection, _rev, ...key } = input;
  await service.deleteDraft({ type: collection, ...key, expected: precondition(input) });
  await refreshContent(collection, key.locale, key.id);
  return { id: key.id, trashed: true };
}));

async function refreshContent(collection: string, locale: string, id?: string) {
  const refreshes = [listContent({ collection, locale }).refresh()];
  if (locale === 'en') refreshes.push(listContent({ collection }).refresh());
  if (id) {
    refreshes.push(getContent({ collection, id, locale }).refresh());
    if (locale === 'en') refreshes.push(getContent({ collection, id }).refresh());
  }
  // Preserve original client cache keys, including defaults and paginated queries.
  for await (const { arg, query } of requested(listContent, 5)) {
    if (arg.collection === collection && arg.locale === locale) refreshes.push(query.refresh());
  }
  for await (const { arg, query } of requested(getContent, 5)) {
    if (arg.collection === collection && arg.locale === locale && arg.id === id) refreshes.push(query.refresh());
  }
  await Promise.all(refreshes);
}

function receipt(entry: { id: string; type: string; locale: string; _rev: string }) {
  return { id: entry.id, type: entry.type, locale: entry.locale, _rev: entry._rev };
}
