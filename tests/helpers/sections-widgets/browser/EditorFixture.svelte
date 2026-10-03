<script lang="ts">
  import * as React from 'react';
  import { createRoot } from 'react-dom/client';
  import SectionEditor from '../../../../src/lib/ui/sections-widgets/SectionEditor.svelte';
  import type { EditorProps } from '../../../../src/lib/sections-widgets/editor.ts';
  import type * as Api from '../../../../src/lib/sections-widgets/api.ts';
  let { slug, api, editorComponent, navigate }: { slug: string; api: typeof Api; editorComponent: React.ComponentType<EditorProps>; navigate: (slug: string) => void } = $props();
  function sourceEditor(node: HTMLElement, props: EditorProps) {
    const root = createRoot(node);
    root.render(React.createElement(editorComponent, props));
    return { update(next: EditorProps) { root.render(React.createElement(editorComponent, next)); }, destroy() { root.unmount(); } };
  }
</script>
<SectionEditor {slug} {api} {navigate}>
  {#snippet editor(props: EditorProps)}<div use:sourceEditor={props}></div>{/snippet}
</SectionEditor>
