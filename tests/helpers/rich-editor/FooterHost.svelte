<script lang="ts">
  import Footer from '../../../src/lib/editor/rich-text/EditorFooter.svelte';
  import type { Editor } from '@tiptap/core';
  import type { Translate } from '../../../src/lib/editor/rich-text/types';
  let { state }: { state: { editor: Editor; translate: Translate } } = $props();
</script>
<Footer editor={state.editor} translate={state.translate} />
