import { query, form, requested } from '$app/server';
import { collectionSlug, contentKey, contentList, trashedContentKey, trashedContentList, createInput, updateInput, trashInput, restoreInput, withRevision, precondition } from '$lib/server/content/schema';
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
export const listTrashedContent = query(trashedContentList, ({ collection, ...options }) => contentResponse(async () => {
  const page = await requestContent().listTrashedDrafts({ type: collection, ...options });
  return { ...page, items: page.items.map(withRevision) };
}));
export const getTrashedContent = query(trashedContentKey, ({ collection, ...key }) => contentResponse(async () =>
  withRevision(await requestContent().getTrashedDraft({ type: collection, ...key }))));
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
  await refreshTrash(collection, key.locale, key.id);
  return { id: key.id, trashed: true };
}));
export const restoreContent = form(restoreInput, (input) => contentResponse(async () => {
  const service = requestContent('mutation');
  const { collection, _rev, ...key } = input;
  const record = withRevision(await service.restoreDraft({ type: collection, ...key,
    // The service authorizes before its parser reads/decodes the precondition.
    get expected() { return precondition(input); }
  }));
  await refreshContent(collection, key.locale, key.id);
  await refreshTrash(collection, key.locale, key.id);
  return receipt(record);
}));

async function refreshContent(collection: string, locale: string, id?: string) {
  void listContent({ collection, locale }).refresh();
  if (locale === 'en') void listContent({ collection }).refresh();
  if (id) {
    void getContent({ collection, id, locale }).refresh();
    if (locale === 'en') void getContent({ collection, id }).refresh();
  }
  // Preserve original client cache keys, including defaults and paginated queries.
  for await (const { arg, query } of requested(listContent, 5)) {
    if (arg.collection === collection && arg.locale === locale) void query.refresh();
  }
  for await (const { arg, query } of requested(getContent, 5)) {
    if (arg.collection === collection && arg.locale === locale && arg.id === id) void query.refresh();
  }
}

async function refreshTrash(collection: string, locale: string, id: string) {
  void listTrashedContent({ collection }).refresh();
  void listTrashedContent({ collection, locale }).refresh();
  void getTrashedContent({ collection, id }).refresh();
  void getTrashedContent({ collection, id, locale }).refresh();
  for await (const { arg, query } of requested(listTrashedContent, 5)) {
    if (arg.collection === collection && (arg.locale === undefined || arg.locale === locale)) void query.refresh();
  }
  for await (const { arg, query } of requested(getTrashedContent, 5)) {
    if (arg.collection === collection && arg.id === id && (arg.locale === undefined || arg.locale === locale)) void query.refresh();
  }
}

function receipt(entry: { id: string; type: string; locale: string; _rev: string }) {
  return { id: entry.id, type: entry.type, locale: entry.locale, _rev: entry._rev };
}
