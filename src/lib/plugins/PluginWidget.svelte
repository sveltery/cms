<script lang="ts">
  import { usePluginWidget } from './provider.svelte.ts';
  let { pluginId, widgetId }: { pluginId: string; widgetId: string } = $props();
  const Widget = $derived(usePluginWidget(pluginId, widgetId));
</script>

{#if Widget}<Widget />{/if}
