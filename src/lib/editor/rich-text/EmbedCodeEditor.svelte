<script module lang="ts">
  import type { Component } from 'svelte';
  import type { CodeEditorProps } from './code-editor-config.source';
  // React.lazy retains a fulfilled module across the Source's keyed remounts.
  // Keep the same lifetime here while leaving the first browser load lazy.
  let loadedEditor: Component<CodeEditorProps> | null = null;
  let loading: Promise<Component<CodeEditorProps>> | undefined;
  function loadEditor() {
    return loading ??= import('./CodeEditor.svelte').then(module => loadedEditor = module.default);
  }
</script>
<script lang="ts">
  import { onMount } from 'svelte';
  let props: CodeEditorProps = $props();
  let Editor = $state(loadedEditor), failed = $state(false);
  onMount(() => {
    let live = true;
    void loadEditor().then(component => { if (live) Editor = component; })
      .catch(() => { if (live) failed = true; });
    return () => { live = false; };
  });
</script>
{#if failed}
  <div class="code-load-error">The code editor couldn't load. Save your work, then reload the page.
    <button type="button" onclick={() => window.location.reload()}>Reload page</button>
  </div>
{:else if Editor}<Editor {...props} />
{:else}<div class="code-loading"></div>{/if}
<style>.code-loading { min-height: 10rem; } .code-load-error { padding: .75rem; }</style>
