import { query, form } from '$app/server';
import * as v from 'valibot';
import { contentId, draft, revision } from '$lib/server/content/schema';
import { requestContent, contentResponse } from '$lib/server/content/request';

export const listContent = query(() => contentResponse(() => requestContent('content:read').list()));
export const getContent = query(contentId, (id) => contentResponse(() => requestContent('content:read').get(id)));
export const createContent = form(draft, (input) => contentResponse(async () => {
  const value = await requestContent('content:write').create(input);
  await listContent().refresh();
  return { id: value.id };
}));
export const updateContent = form(revision, (input) => contentResponse(async () => {
  const value = await requestContent('content:write').update(input);
  await Promise.all([listContent().refresh(), getContent(value.id).refresh()]);
  return { id: value.id };
}));
export const deleteContent = form(v.object({ id: contentId }), ({ id }) => contentResponse(async () => {
  await requestContent('content:write').delete(id);
  await listContent().refresh();
}));
