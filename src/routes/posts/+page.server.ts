import { publicDatabase, publicCollection, publishedCollection } from '$lib/server/public-site/read.ts';
export async function load({ locals, url }: import('./$types').PageServerLoadEvent) {
  const database = publicDatabase(locals);
  const collection = await publicCollection(database, 'posts');
  return { entries: collection ? await publishedCollection(database, collection, url.searchParams.get('locale') ?? undefined) : [] };
}
