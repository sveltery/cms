import { error } from '@sveltejs/kit';
import { publicDatabase, publicCollection, publishedEntry, pageContext } from '$lib/server/public-site/read.ts';
export async function load({ locals, params, url }: import('./$types').PageServerLoadEvent) {
  const database = publicDatabase(locals);
  const collection = await publicCollection(database, 'posts');
  if (!collection) error(404, { message: 'not-found', code: 'NOT_FOUND' });
  const entry = await publishedEntry(database, collection, params.slug, url.searchParams.get('locale') ?? undefined);
  if (!entry) error(404, { message: 'not-found', code: 'NOT_FOUND' });
  return { entry, fields: collection.fields.map(({ slug, label, type }) => ({ slug, label, type })),
    page: pageContext(entry, 'posts', url, locals.cmsRuntime?.publicOrigin ?? url.origin) };
}
