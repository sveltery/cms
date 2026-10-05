<script module lang="ts">
  import type { Component } from 'svelte';
  import type { CodeEditorProps } from './code-editor-config.source';
  import { sourceMessage, type Translate } from './types';
  import { embedMessage } from './embed-messages.source';
  type NativeCodeEditorProps = CodeEditorProps & { translate?: Translate };
  // React.lazy retains a fulfilled module across the Source's keyed remounts.
  // Keep the same lifetime here while leaving the first browser load lazy.
  let loadedEditor: Component<NativeCodeEditorProps> | null = null;
  let loading: Promise<Component<NativeCodeEditorProps>> | undefined;
  function loadEditor() {
    return loading ??= import('./CodeEditor.svelte').then(module => loadedEditor = module.default);
  }
</script>
<script lang="ts">
  import { onMount } from 'svelte';
  let props: NativeCodeEditorProps = $props();
  let Editor = $state(loadedEditor), loadFailed = $state(false);
  onMount(() => {
    let live = true;
    void loadEditor().then(component => { if (live) Editor = component; })
      .catch(() => { if (live) loadFailed = true; });
    return () => { live = false; };
  });
</script>
{#snippet loadError()}
  <div class="code-load-error">{embedMessage(props.translate ?? sourceMessage, "The code editor couldn't load. Save your work, then reload the page.")}
    <button type="button" onclick={() => window.location.reload()}>{embedMessage(props.translate ?? sourceMessage, 'Reload page')}</button>
  </div>
{/snippet}
<svelte:boundary>
  {#if loadFailed}{@render loadError()}
  {:else if Editor}<Editor {...props} />
  {:else}<div class="code-loading"></div>{/if}
  {#snippet failed()}{@render loadError()}{/snippet}
</svelte:boundary>
<style>.code-loading { min-height: 10rem; } .code-load-error { padding: .75rem; }</style>
