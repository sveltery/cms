<script lang="ts">
  let { failing }: { failing: boolean } = $props();
  const content = $derived.by(() => { if (failing) throw new Error('Plugin rendering failure'); return 'Recovered plugin'; });
</script>
<span>{content}</span>
