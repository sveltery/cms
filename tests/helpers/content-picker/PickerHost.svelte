<script lang="ts">
  import ContentPickerModal from '../../../src/lib/content-picker/ContentPickerModal.svelte';
  import type { ComponentProps } from 'svelte';
  let { state }: { state: ComponentProps<typeof ContentPickerModal> } = $props();
</script>
<ContentPickerModal {...state} />
