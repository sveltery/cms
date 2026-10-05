import { query, form, requested } from '$app/server';
import {getLifecycleContent,listContentRevisions} from './lifecycle.remote';
import { collectionSlug, contentKey, contentList, trashedContentCount, trashedContentKey, trashedContentList, createInput, updateInput, trashInput, restoreInput, withRevision, precondition } from '$lib/server/content/schema';
import { requestContent, contentResponse } from '$lib/server/content/request';

export const getEditorManifest = query(() => contentResponse(() => requestContent().getEditorManifest()));
export const listCollections = query(() => contentResponse(() => requestContent().listCollections()));
export const getCollection = query(collectionSlug, collection => contentResponse(() => requestContent().getCollection(collection)));
export const listContent = query(contentList, ({ collection, ...options }) => contentResponse(async () => {
  const page = await requestContent().listContent({ type: collection, ...options });
  return { ...page, items: page.items.map(withRevision) };
}));
export const getContent = query(contentKey, ({ collection, ...key }) => contentResponse(async () =>
  withRevision(await requestContent().getContent({ type: collection, ...key }))));
export const listTrashedContent = query(trashedContentList, ({ collection, ...options }) => contentResponse(async () => {
  const page = await requestContent().listTrashedContent({ type: collection, ...options });
  return { ...page, items: page.items.map(withRevision) };
}));
export const countTrashedContent = query(trashedContentCount, ({ collection, ...options }) =>
  contentResponse(() => requestContent().countTrashedContent({ type: collection, ...options })));
export const getTrashedContent = query(trashedContentKey, ({ collection, ...key }) => contentResponse(async () =>
  withRevision(await requestContent().getTrashedContent({ type: collection, ...key }))));
export const createContent = form(createInput, ({ collection, ...input }) => contentResponse(async () => {
  const value = withRevision(await requestContent('mutation').createContent({ type: collection, ...input, ...(input.slug === '' ? {slug:null} : {}) }));
  await refreshContent(collection, input.locale);
  return receipt(value);
}));
export const duplicateContent = form(contentKey, ({collection,...key})=>contentResponse(async()=>{
  const record=withRevision(await requestContent('mutation').duplicateContent({type:collection,...key}));
  await refreshContent(collection,record.locale);
  return receipt(record);
}));
export const updateContent = form(updateInput, (input) => contentResponse(async () => {
  const service = requestContent('mutation');
  const { collection, _rev, ...value } = input;
  const record = withRevision(await service.updateContent({ type: collection, ...value,
    ...(value.slug === '' ? {slug:null} : {}), expected: precondition(input) }));
  await refreshContent(collection, value.locale, value.id);
  await refreshWorkflow(collection, value.locale, value.id);
  return receipt(record);
}));
/** Recoverable trash; retained rows remain in storage. */
export const deleteContent = form(trashInput, (input) => contentResponse(async () => {
  const service = requestContent('mutation');
  const { collection, _rev, ...key } = input;
  await service.deleteContent({ type: collection, ...key, expected: precondition(input) });
  await refreshContent(collection, key.locale, key.id);
  await refreshTrash(collection, key.locale, key.id);
  await refreshWorkflow(collection, key.locale, key.id);
  return { id: key.id, trashed: true };
}));
export const restoreContent = form(restoreInput, (input) => contentResponse(async () => {
  const service = requestContent('mutation');
  const { collection, _rev, ...key } = input;
  const record = withRevision(await service.restoreContent({ type: collection, ...key,
    // The service authorizes before its parser reads/decodes the precondition.
    get expected() { return precondition(input); }
  }));
  await refreshContent(collection, key.locale, key.id);
  await refreshTrash(collection, key.locale, key.id);
  await refreshWorkflow(collection, key.locale, key.id);
  return receipt(record);
}));
export const permanentDeleteContent = form(trashInput,input=>contentResponse(async()=>{
  const {collection,_rev,...key}=input;
  await requestContent('mutation').permanentDeleteContent({type:collection,...key,
    get expected(){return precondition(input);}
  });
  await refreshContent(collection,key.locale,key.id);
  await refreshTrash(collection,key.locale,key.id);
  await refreshWorkflow(collection,key.locale,key.id);
  return{id:key.id,deleted:true};
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
  void countTrashedContent({ collection }).refresh();
  void countTrashedContent({ collection, locale }).refresh();
  void listTrashedContent({ collection }).refresh();
  void listTrashedContent({ collection, locale }).refresh();
  void getTrashedContent({ collection, id }).refresh();
  void getTrashedContent({ collection, id, locale }).refresh();
  for await (const { arg, query } of requested(countTrashedContent, 5)) {
    if (arg.collection === collection && (arg.locale === undefined || arg.locale === locale)) void query.refresh();
  }
  for await (const { arg, query } of requested(listTrashedContent, 5)) {
    if (arg.collection === collection && (arg.locale === undefined || arg.locale === locale)) void query.refresh();
  }
  for await (const { arg, query } of requested(getTrashedContent, 5)) {
    if (arg.collection === collection && arg.id === id && (arg.locale === undefined || arg.locale === locale)) void query.refresh();
  }
}

async function refreshWorkflow(collection:string,locale:string,id:string) {
  for await (const {arg,query} of requested(getLifecycleContent,5)) {
    if(arg.collection===collection&&arg.locale===locale&&arg.id===id)void query.refresh();
  }
  for await (const {arg,query} of requested(listContentRevisions,5)) {
    if(arg.collection===collection&&arg.locale===locale&&arg.id===id)void query.refresh();
  }
}

function receipt(entry: { id: string; type: string; locale: string; _rev: string }) {
  return { id: entry.id, type: entry.type, locale: entry.locale, _rev: entry._rev };
}
