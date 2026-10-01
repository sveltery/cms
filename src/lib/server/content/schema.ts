import * as v from 'valibot';

export const contentId = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
export const draft = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  body: v.pipe(v.string(), v.maxLength(100_000))
});
export const revision = v.object({ id: contentId, ...draft.entries });
