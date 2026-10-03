<script lang="ts">
  import DraftPreview from '../ui/DraftPreview.svelte';
  import type { PreviewField } from '../ui/preview-fields';
  let { fields = [], values = {}, canWrite = false, pending = false, issues = [] }: {
    fields?: PreviewField[]; values?: Record<string, unknown>; canWrite?: boolean;
    pending?: boolean; issues?: string[];
  } = $props();
</script>

<DraftPreview {fields} {values} />
