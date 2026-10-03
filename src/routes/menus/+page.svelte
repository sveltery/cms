<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import MenuList from '$lib/menus/MenuList.svelte';
  import { createMenuClient } from '$lib/menus/client.ts';
  let { data }: { data: PageData } = $props();
  const client = $derived(createMenuClient(data.basePath));
</script>
<WorkspaceShell homeHref={resolve('/')}>
  <MenuList {client} basePath={data.basePath} locale={data.i18n?.defaultLocale} locales={data.i18n?.locales ?? []} mutationsEnabled={data.canMutateMenus} navigate={url => { void goto(url); }} />
</WorkspaceShell>
