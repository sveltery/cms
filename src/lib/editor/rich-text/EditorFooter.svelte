<script lang="ts">
  import { onMount } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { calculateReadingTime } from './editor-values';
  import { footerMessages } from './footer-messages';
  import { sourceMessage, type Translate } from './types';
  let { editor, translate = sourceMessage }: { editor: Editor; translate?: Translate } = $props();
  let revision = $state(0);
  onMount(() => {
    const update = () => { revision += 1; };
    editor.on('transaction', update);
    return () => { editor.off('transaction', update); };
  });
  const messages = $derived.by(() => {
    void revision;
    const storage = editor.storage.characterCount as { words: () => number; characters: () => number };
    return footerMessages(storage.words(), storage.characters(), calculateReadingTime(editor.getText()));
  });
</script>

<div class="editor-footer border-t px-4 py-2 flex items-center gap-4 text-xs text-kumo-subtle">
  {#each messages as message}<span>{translate(message)}</span>{/each}
</div>
