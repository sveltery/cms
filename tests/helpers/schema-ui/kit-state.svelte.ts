// Pure Native UI navigation fixture. It supplies no session or backend result.
export const page = $state({ params: { collection: 'posts' } });
export function setCollection(slug: string) { page.params.collection = slug; }
