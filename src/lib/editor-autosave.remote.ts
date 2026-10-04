import { form, requested } from '$app/server';
import { getContent, listContent } from './content.remote';
import { getLifecycleContent, listContentRevisions } from './lifecycle.remote';
import { updateInput, precondition, withRevision } from './server/content/schema';
import { requestContent, contentResponse } from './server/content/request';

/** Native autosave uses the same trusted input/owner/CAS gate as manual save. */
export const autosaveEditorDraft = form(updateInput, input => contentResponse(async () => {
  const { collection, _rev, ...value } = input;
  const item = withRevision(await requestContent('mutation').updateContent({ type: collection, ...value,
    ...(value.slug === '' ? { slug: null } : {}), expected: precondition(input), skipRevision: true }));
  for await (const { arg, query } of requested(getContent, 5)) {
    if (arg.collection === collection && arg.id === item.id && arg.locale === item.locale) void query.refresh();
  }
  for await (const { arg, query } of requested(listContent, 5)) {
    if (arg.collection === collection && arg.locale === item.locale) void query.refresh();
  }
  for await (const { arg, query } of requested(getLifecycleContent, 5)) {
    if (arg.collection === collection && arg.id === item.id && arg.locale === item.locale) void query.refresh();
  }
  for await (const { arg, query } of requested(listContentRevisions, 5)) {
    if (arg.collection === collection && arg.id === item.id && arg.locale === item.locale) void query.refresh();
  }
  return { id: item.id, type: item.type, locale: item.locale, _rev: item._rev };
}));
