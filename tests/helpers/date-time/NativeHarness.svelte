<script lang="ts">
  import Fields from '../../../src/lib/ui/PublishingDateTimeFields.svelte';
  let { state }: { state: Record<string, unknown> } = $props();
</script>
<Fields {...state} time={state.time as string} dateAriaLabel={state.dateAriaLabel as string} />
