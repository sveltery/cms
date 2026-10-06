<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  let { resetKey, reset, fallback }: { resetKey?: string; reset: () => void; fallback?: Snippet } = $props();
  const initialResetKey = untrack(() => resetKey);
  $effect(() => { if (resetKey !== initialResetKey) reset(); });
</script>

{#if fallback}
  {@render fallback()}
{:else}
  <span class="text-muted-foreground"><span aria-hidden="true">-</span><span class="sr-only">Plugin column unavailable</span></span>
{/if}
