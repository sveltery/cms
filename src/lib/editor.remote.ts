import { form, query, requested } from '$app/server';
import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { createEditorInput, saveEditorInput } from './server/content/editor-schema';
import { contentList, precondition, withRevision } from './server/content/schema';
import { contentEntry } from './server/lifecycle/schema';
import { requestLifecycle, lifecycleResponse } from './server/lifecycle/request';
import { SchemaRegistry } from './server/database/registry';
import { getLifecycleContent, listContentRevisions } from './lifecycle.remote';
import { changedNativeScalars } from './ui/native-scalar-data';
import type { InferOutput } from 'valibot';

export const listEditorContent = query(contentList, ({ collection, ...input }) => lifecycleResponse(async () => {
  const page = await requestLifecycle().listContent({ type: collection, ...input });
  return { ...page, items: page.items.map(item => withRevision(contentEntry(item))) };
}));

export const createEditorContent = form(createEditorInput, async ({ collection, editorMode, ...input }) => {
  const item = await lifecycleResponse(async () => {
    const result = await requestLifecycle('mutation').createContent({ type: collection, ...input,
      // Ordinary native creation selects server title generation when blank.
      slug: input.slug === '' ? undefined : input.slug });
    await refresh(collection, result.id, result.locale!);
    return result;
  });
  const path = resolve('/content/[collection]/[id]', { collection, id: item.id });
  // Kit redirects must not pass through the domain/JSON error boundary.
  redirect(303, `${path}?locale=${encodeURIComponent(item.locale!)}`);
});

export const saveEditorContent = form(saveEditorInput, input => save(input, false));
export const autosaveEditorContent = form(saveEditorInput, input => save(input, true));

async function save(input: InferOutput<typeof saveEditorInput>, autosave: boolean) {
  return lifecycleResponse(async () => {
    const service = requestLifecycle('mutation');
    const { collection, _rev, editorMode, ...value } = input;
    if (editorMode === 'native') {
      const current = await service.getContent({ type: collection, id: value.id, locale: value.locale });
      const definition = await new SchemaRegistry(getRequestEvent().locals.cms!.database).getCollectionWithFields(collection);
      value.data = changedNativeScalars(value.data, current.data, definition?.fields ?? []);
      if (value.slug === (current.slug ?? '')) value.slug = undefined;
    }
    const { item } = await service.updateContent({ type: collection, ...value,
      expected: precondition(input), ...(autosave ? { skipRevision: true } : {}) });
    await refresh(collection, item.id, item.locale!);
    const receipt = withRevision(contentEntry(item));
    return { id: receipt.id, type: receipt.type, locale: receipt.locale, _rev: receipt._rev };
  });
}

async function refresh(collection: string, id: string, locale: string) {
  void listEditorContent({ collection, locale }).refresh();
  void getLifecycleContent({ collection, id, locale }).refresh();
  void listContentRevisions({ collection, id, locale }).refresh();
  if (locale === 'en') {
    void listEditorContent({ collection }).refresh();
    void getLifecycleContent({ collection, id }).refresh();
    void listContentRevisions({ collection, id }).refresh();
  }
  for await (const { arg, query } of requested(listEditorContent, 5)) if (arg.collection === collection && arg.locale === locale) void query.refresh();
  for await (const { arg, query } of requested(getLifecycleContent, 5)) if (arg.collection === collection && arg.id === id && arg.locale === locale) void query.refresh();
  for await (const { arg, query } of requested(listContentRevisions, 5)) if (arg.collection === collection && arg.id === id && arg.locale === locale) void query.refresh();
}
