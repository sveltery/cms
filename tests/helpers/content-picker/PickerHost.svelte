<script lang="ts">
  import ContentPickerModal from '../../../src/lib/content-picker/ContentPickerModal.svelte';
  import type { ComponentProps } from 'svelte';
  import { pickerFixtureQueryClient } from './query-client.ts';
  import { contentPickerClient } from '../../../src/lib/content-picker/client.ts';
  let { state }: { state: ComponentProps<typeof ContentPickerModal> } = $props();
</script>
<ContentPickerModal {...state} queryClient={state.queryClient ?? pickerFixtureQueryClient(state.client ?? contentPickerClient)} />
