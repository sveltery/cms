<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { NodeViewState } from './node-view-state.svelte';
  import { parseIframeInput, iframeEmbedFromAttrs, iframeEmbedAttrs, iframeEmbedToCode } from '../portable-text/iframe-embed';
  import { buildHtmlBlockFrame, HTML_BLOCK_FRAME_SANDBOX } from '../portable-text/html-block';
  let { state: viewState }: { state: NodeViewState } = $props();
  let tab = $state('html'), error = $state('');
  // Source IframeBlockNode retains the authored draft independently from the
  // persisted canonical code. Valid intermediate input must not replace it.
  let typed = $state<string | null>(null), pending: string | null = null, valid = true;
  let known = viewState.node.attrs.src ? iframeEmbedToCode(iframeEmbedFromAttrs(viewState.node.attrs)) : '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const iframe = $derived(viewState.node.type.name === 'iframeBlock');
  const tabs = $derived(iframe ? ['code', 'preview'] : ['html', 'css', 'js', 'preview']);
  const code = $derived(viewState.node.attrs.src ? iframeEmbedToCode(iframeEmbedFromAttrs(viewState.node.attrs)) : '');
  const current = $derived(iframe ? typed ?? code : typeof viewState.node.attrs[tab] === 'string' ? viewState.node.attrs[tab] : '');
  const initialTab = $derived(iframe ? 'code' : 'html');
  $effect(() => { if (!tabs.includes(tab)) tab = initialTab; });
  $effect(() => {
    if (!iframe || code === known) return;
    // Undo, redo and other tools own external attribute changes.
    known = code; pending = null; typed = null; error = '';
  });
  function flush(): boolean {
    clearTimeout(timer);
    if (pending === null) return false;
    const result = parseIframeInput(pending); valid = result.ok;
    if (!result.ok) {
      pending = null;
      error = result.reason === 'not-https' ? 'Only https links can be embedded.' : 'No iframe found in this code. For an embed that runs a script, use an HTML block.';
      return false;
    }
    error = '';
    // Source keeps valid pending input until the real owning position can write.
    if (viewState.editor.isDestroyed || !viewState.editor.isEditable || typeof viewState.getPos?.() !== 'number') return false;
    pending = null; known = result.embed ? iframeEmbedToCode(result.embed) : '';
    viewState.updateAttributes(iframeEmbedAttrs(result.embed)); return true;
  }
  function change(text: string) {
    if (!viewState.editable) return;
    if (!iframe) { viewState.updateAttributes({ [tab]: text }); return; }
    pending = text; typed = text; clearTimeout(timer); timer = setTimeout(flush, 250);
  }
  function blur() {
    if (!iframe) return;
    // Source queues writes outside the ProseMirror command that moved focus.
    queueMicrotask(flush);
    queueMicrotask(() => {
      if (!document.hasFocus() || !valid || pending !== null) return;
      if (typed !== null && typed !== known) typed = null;
    });
  }
  function changeTab(value: string) {
    if (iframe) { flush(); typed = null; error = ''; }
    tab = value;
  }
  // The Source focus owner flushes during cleanup; the live editor/getPos guards
  // prevent writes to a deleted block or destroyed editor.
  onDestroy(() => { if (iframe) queueMicrotask(flush); });
</script>

<section class="embed-card" contenteditable="false" aria-label={iframe ? 'Iframe' : 'HTML'}>
  <div role="tablist" aria-label={iframe ? 'Iframe block' : 'HTML block'}>
    {#each tabs as value}<button type="button" role="tab" aria-selected={tab === value} onclick={() => changeTab(value)}>{value === 'preview' ? 'Preview' : value.toUpperCase()}</button>{/each}
    <button type="button" aria-label="Delete block" disabled={!viewState.editable} onclick={() => viewState.deleteBlock?.()}>Delete</button>
  </div>
  {#if tab === 'preview'}
    {#if !iframe}
      {#if viewState.node.attrs.isolated === true}<iframe title="HTML preview" sandbox={HTML_BLOCK_FRAME_SANDBOX} srcdoc={buildHtmlBlockFrame({ html: viewState.node.attrs.html ?? '', css: viewState.node.attrs.css, js: viewState.node.attrs.js })}></iframe>
      {:else}<pre>{viewState.node.attrs.html}</pre>{/if}
    {:else}<p>Preview: {viewState.node.attrs.src || 'Nothing to preview yet.'}</p>{/if}
  {:else}
    <textarea value={current} rows="8" spellcheck="false" aria-label={iframe ? 'Embed code' : tab.toUpperCase()} disabled={!viewState.editable}
      placeholder={iframe ? 'Paste an embed code or an https link…' : `Enter ${tab.toUpperCase()}…`} oninput={event => change(event.currentTarget.value)} onblur={blur}></textarea>
    {#if error}<p role="alert">{error}</p>{/if}
  {/if}
</section>

<style>
  .embed-card { border: 1px solid #c4cedd; border-radius: .5rem; margin-block: 1rem; }
  [role='tablist'] { display: flex; gap: .25rem; padding: .5rem; background: #f3f5f7; }
  button { border: 0; padding: .5rem; font: inherit; background: transparent; }
  [aria-selected='true'] { background: #fff; } textarea { box-sizing: border-box; width: 100%; border: 0; resize: vertical; padding: 1rem; font-family: ui-monospace, monospace; }
  iframe { width: 100%; min-height: 15rem; border: 0; } p { padding: .5rem 1rem; }
</style>
