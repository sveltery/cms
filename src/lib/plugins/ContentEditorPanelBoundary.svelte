<script lang="ts">
  import type { Snippet } from 'svelte';
  let { pluginId, panelId, children }: { pluginId: string; panelId: string; children: Snippet } = $props();
  function report(error: unknown) {
    console.error(`Plugin "${pluginId}" failed while rendering content editor panel "${panelId}".`, error);
  }
</script>

<svelte:boundary onerror={report}>
  {@render children()}
  {#snippet failed(_error, reset)}
    <div role="alert" class="text-xs leading-4 text-muted-foreground">
      <p>Plugin panel unavailable.</p>
      <button type="button" class="mt-1" onclick={reset}>Retry</button>
    </div>
  {/snippet}
</svelte:boundary>
