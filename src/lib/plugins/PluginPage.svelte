<script lang="ts">
  import { usePluginPage } from './provider.svelte.ts';
  let { pluginId, path }: { pluginId: string; path: string } = $props();
  const Page = $derived(usePluginPage(pluginId, path));
</script>

{#if Page}<Page />{/if}
