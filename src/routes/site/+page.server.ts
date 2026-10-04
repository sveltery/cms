import { publicDatabase, publicCollection, publishedCollection } from '$lib/server/public-site/read.ts';
export async function load({ locals, url }: import('./$types').PageServerLoadEvent) {
  const database = publicDatabase(locals);
  const locale = url.searchParams.get('locale') ?? undefined;
  const posts = await publicCollection(database, 'posts');
  const pages = await publicCollection(database, 'pages');
  return { posts: posts ? await publishedCollection(database, posts, locale, 6) : [],
    pages: pages ? await publishedCollection(database, pages, locale, 20) : [] };
}
