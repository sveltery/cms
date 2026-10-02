<script lang="ts">
  import DraftPreview from '../../../src/lib/ui/DraftPreview.svelte';
  import type { PreviewField } from '../../../src/lib/ui/preview-fields';
  let values = $state<Record<string, string | null>>({ value: 'Saved value' });
  let fields = $state<PreviewField[]>([
    { id: 'value', slug: 'value', label: 'Value', type: 'string', required: false, validation: null, defaultValue: 'Initial default' }
  ]);
</script>

<button onclick={() => values.value = 'Edited value'}>Edit value</button>
<button onclick={() => values.value = null}>Clear value</button>
<button onclick={() => delete values.value}>Remove value</button>
<button onclick={() => fields[0].defaultValue = 'Changed default'}>Change default</button>
<button onclick={() => fields[0].type = 'text'}>Use textarea</button>
<button onclick={() => {
  fields = [{ id: 'next', slug: 'next', label: 'Next', type: 'string', required: true, validation: { minLength: 2, maxLength: 80 }, defaultValue: 'Next default' }];
  values = { next: 'Next value' };
}}>Replace fields and values</button>
<DraftPreview {fields} {values} />
