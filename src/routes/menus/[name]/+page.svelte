<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { PageData } from './$types';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import MenuEditor from '$lib/menus/MenuEditor.svelte';
  import { createMenuClient } from '$lib/menus/client.ts';
  import { createContentPickerClient } from '$lib/content-picker/client.ts';
  let { data }: { data: PageData } = $props();
  const client = $derived(createMenuClient(data.basePath));
  const contentClient = $derived(createContentPickerClient(data.basePath));
</script>
<WorkspaceShell homeHref={resolve('/')}>
  <MenuEditor name={page.params.name ?? ''} locale={page.url.searchParams.get('locale') ?? undefined} {client} {contentClient} basePath={data.basePath}
    locales={data.i18n?.locales ?? []} mutationsEnabled={data.canMutateMenus} navigate={url => { void goto(url); }} />
</WorkspaceShell>
