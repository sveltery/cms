<script lang="ts">
  import Fields from '../../../src/lib/ui/PublishingDateTimeFields.svelte';
  let { state }: { state: Record<string, unknown> } = $props();
</script>
<Fields {...state} />
