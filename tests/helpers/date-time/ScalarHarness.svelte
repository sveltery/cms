<script lang="ts">
  import Field from '../../../src/lib/ui/DatetimeField.svelte';
  let { state }: { state: Record<string, unknown> } = $props();
  const legacyFields = [{ id: 'starts_at', slug: 'starts_at', label: 'Starts', type: 'datetime', required: false, validation: null, defaultValue: null }];
  const options = $derived({ fields: legacyFields, values: { starts_at: state.value }, ...state });
</script>
<Field {...options} id={state.id as string} label={state.label as string} />
