<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { PageData } from './$types';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import MenuEditor from '$lib/menus/MenuEditor.svelte';
  import { createMenuClient } from '$lib/menus/client.ts';
  import type { ContentClient } from '$lib/menus/types.ts';
  import { getEditorManifest, listContent } from '$lib/content.remote';
  let { data }: { data: PageData } = $props();
  const client = $derived(createMenuClient(data.basePath));
  const contentClient: ContentClient = {
    async collections() { const manifest = await getEditorManifest(); return Object.entries(manifest.collections).filter(([, value]) => value.routable)
      .map(([slug, value]) => ({ slug, label: value.label })); },
    async entries(collection, locale) { const result = await listContent({ collection, locale });
      return result.items.map(item => ({ collection, id: item.id, title: item.title ?? item.slug ?? item.id })); }
  };
</script>
<WorkspaceShell homeHref={resolve('/')}>
  <MenuEditor name={page.params.name ?? ''} locale={page.url.searchParams.get('locale') ?? undefined} {client} {contentClient} basePath={data.basePath}
    locales={data.i18n?.locales ?? []} mutationsEnabled={data.canMutateMenus} navigate={url => { void goto(url); }} />
</WorkspaceShell>
