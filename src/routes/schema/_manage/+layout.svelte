<script lang="ts">
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import type { LayoutProps } from './$types';
  let { children }: LayoutProps = $props();
</script>

<WorkspaceShell homeHref={resolve('/')} schemaHref={resolve('/schema')} activePage="schema">
  {@render children()}
</WorkspaceShell>
