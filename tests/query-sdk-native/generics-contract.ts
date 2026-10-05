// Compile-only Native consumer contract for the complete preserved Source API.
// No query is executed and no missing producer is supplied by this fixture.
import {
  createQuerySdk, getEmDashCollection, getEmDashEntry, getEmDashReferences,
  resolveEmDashPath, type ReferencePage
} from '../../src/lib/server/query.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

type Post = {title: string; rank: number};
type Author = {name: string};
declare module '../../src/lib/server/query.ts' {
  interface EmDashCollections {sdk_type_posts: Post;}
  interface EmDashCollectionReferences {
    sdk_type_posts: {author: ReferencePage<Author>; related: ReferencePage<Post>};
  }
}

export async function nativeConsumerTypeContract(database: CmsDatabase): Promise<void> {
  const sdk = createQuerySdk(database);
  // Bound methods must accept every original generic instantiation.
  const collectionSignature: typeof getEmDashCollection = sdk.getEmDashCollection;
  const entrySignature: typeof getEmDashEntry = sdk.getEmDashEntry;
  const referencesSignature: typeof getEmDashReferences = sdk.getEmDashReferences;
  const pathSignature: typeof resolveEmDashPath = sdk.resolveEmDashPath;
  void [collectionSignature, entrySignature, referencesSignature, pathSignature];

  const inferred = await sdk.getEmDashCollection('sdk_type_posts');
  const inferredTitle: string = inferred.entries[0].data.title;
  const inferredRank: number = inferred.entries[0].data.rank;
  const selected = await sdk.getEmDashEntry('sdk_type_posts', 'post-id', {references: {author: true}});
  if (selected.entry?.references) {
    const name: string = selected.entry.references.author.entries[0].data.name;
    // @ts-expect-error An unselected reference is absent from the result type.
    selected.entry.references.related;
    void name;
  }
  // @ts-expect-error Generated references reject unknown field selections.
  sdk.getEmDashEntry('sdk_type_posts', 'post-id', {references: {unknown_field: true}});

  const explicitCollection = await sdk.getEmDashCollection<'sdk_type_posts', Post>('sdk_type_posts');
  const explicitEntry = await sdk.getEmDashEntry<'sdk_type_posts', Post, {author: true}>(
    'sdk_type_posts', 'post-id', {references: {author: true}}
  );
  const explicitReferences = await sdk.getEmDashReferences<Author>('sdk_type_posts', 'post-id', 'author');
  const explicitPath = await sdk.resolveEmDashPath<Post>('/posts/example');
  const explicitTitle: string = explicitCollection.entries[0].data.title;
  const explicitName: string = explicitReferences.entries[0].data.name;
  const pathTitle: string | undefined = explicitPath?.entry.data.title;
  void [inferredTitle, inferredRank, explicitTitle, explicitName, pathTitle, explicitEntry];
}
