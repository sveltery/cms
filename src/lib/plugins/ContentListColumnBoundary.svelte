<script lang="ts">
  import type { Snippet } from 'svelte';
  import ContentListColumnFailure from './ContentListColumnFailure.svelte';
  let { pluginId, columnId, children, fallback, resetKey }: {
    pluginId: string; columnId: string; children: Snippet; fallback?: Snippet; resetKey?: string
  } = $props();
  function report(error: unknown) {
    console.error(`Plugin "${pluginId}" failed while rendering content-list column "${columnId}".`, error);
  }
</script>

<svelte:boundary onerror={report}>
  {@render children()}
  {#snippet failed(_error, reset)}
    <ContentListColumnFailure {resetKey} {reset} {fallback} />
  {/snippet}
</svelte:boundary>
