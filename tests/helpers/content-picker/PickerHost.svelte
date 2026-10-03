<script lang="ts">
  import ContentPickerModal from '../../../src/lib/content-picker/ContentPickerModal.svelte';
  let { state }: { state: Record<string, any> } = $props();
</script>
<ContentPickerModal {...state} />
