<script lang="ts">
  import {onMount} from 'svelte';
  import type {Editor} from '@tiptap/core';
  import {countWords,calculateReadingTime} from '../portable-text/metrics';
  let {editor}:{editor:Editor}=$props();
  let revision=$state(0);
  onMount(()=>{const update=()=>{revision++;};editor.on('transaction',update);return()=>editor.off('transaction',update);});
  const text=$derived.by(()=>{revision;return editor.getText();});
  const words=$derived(countWords(text));
  const characters=$derived(editor.storage.characterCount?.characters?.()??text.length);
  const readingTime=$derived(calculateReadingTime(text));
</script>
<div data-portable-text-footer>
  <span>{words} {words===1?'word':'words'}</span>
  <span>{characters} {characters===1?'character':'characters'}</span>
  <span>{readingTime} min read</span>
</div>
