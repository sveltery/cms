<script lang="ts">
  import PortableTextEditor from '../../../src/lib/editor/rich-text/PortableTextEditor.svelte';
  import type { PortableTextEditorProps } from '../../../src/lib/editor/rich-text/types';
  let { state }: { state: PortableTextEditorProps } = $props();
  let component: ReturnType<typeof PortableTextEditor>;
  export function insertSection(section: { content: unknown[] }) { component?.insertSection(section); }
</script>
<PortableTextEditor bind:this={component} {...state} />
