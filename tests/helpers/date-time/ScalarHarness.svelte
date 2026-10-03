<script lang="ts">
  import Field from '../../../src/lib/ui/DatetimeField.svelte';
  let { state }: { state: Record<string, unknown> } = $props();
</script>
<Field {...state} fields={[{ id: 'starts_at', slug: 'starts_at', label: 'Starts', type: 'datetime', required: false, validation: null, defaultValue: null }]} values={{ starts_at: state.value }} />
