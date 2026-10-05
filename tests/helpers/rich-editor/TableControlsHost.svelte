<script lang="ts">
  import Picker from '../../../src/lib/editor/rich-text/TableSizePicker.svelte';
  import Announcer from '../../../src/lib/editor/rich-text/TableSelectionAnnouncer.svelte';
  let { state }: { state: { kind: 'picker'; onInsert: (rows: number, columns: number, withHeaderRow: boolean) => void; onCancel: () => void; translate: import('../../../src/lib/editor/rich-text/types').Translate } | { kind: 'announcer'; editor: import('@tiptap/core').Editor; onChange: (label: string) => void; translate: import('../../../src/lib/editor/rich-text/types').Translate } } = $props();
</script>
{#if state.kind === 'picker'}
  <Picker onInsert={state.onInsert} onCancel={state.onCancel} translate={state.translate} />
{:else}
  <Announcer editor={state.editor} onChange={state.onChange} translate={state.translate} />
{/if}
