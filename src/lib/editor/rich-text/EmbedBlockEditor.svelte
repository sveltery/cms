<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { NodeViewState } from './node-view-state.svelte';
  import { iframeEmbedFromAttrs, iframeEmbedToCode } from '../portable-text/iframe-embed';
  import { iframeDraft } from './iframe-draft.svelte';
  import { buildHtmlBlockFrame, HTML_BLOCK_FRAME_SANDBOX } from '../portable-text/html-block';
  let { state: viewState }: { state: NodeViewState } = $props();
  let tab = $state('html');
  const draft = iframeDraft(viewState, viewState.node.attrs.src ? iframeEmbedToCode(iframeEmbedFromAttrs(viewState.node.attrs)) : '');
  const iframe = $derived(viewState.node.type.name === 'iframeBlock');
  const tabs = $derived(iframe ? ['code', 'preview'] : ['html', 'css', 'js', 'preview']);
  const code = $derived(viewState.node.attrs.src ? iframeEmbedToCode(iframeEmbedFromAttrs(viewState.node.attrs)) : '');
  const current = $derived(iframe ? draft.state.typed ?? code : typeof viewState.node.attrs[tab] === 'string' ? viewState.node.attrs[tab] : '');
  const initialTab = $derived(iframe ? 'code' : 'html');
  $effect(() => { if (!tabs.includes(tab)) tab = initialTab; });
  $effect(() => { if (iframe) draft.synchronize(code); });
  function change(text: string) {
    if (!viewState.editable) return;
    if (!iframe) { viewState.updateAttributes({ [tab]: text }); return; }
    draft.change(text);
  }
  function blur() {
    if (iframe) draft.blur();
  }
  function changeTab(value: string) {
    if (iframe) draft.changeTab();
    tab = value;
  }
  onDestroy(() => { if (iframe) draft.cleanup(); });
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
    {#if draft.state.error}<p role="alert">{draft.state.error}</p>{/if}
  {/if}
</section>

<style>
  .embed-card { border: 1px solid #c4cedd; border-radius: .5rem; margin-block: 1rem; }
  [role='tablist'] { display: flex; gap: .25rem; padding: .5rem; background: #f3f5f7; }
  button { border: 0; padding: .5rem; font: inherit; background: transparent; }
  [aria-selected='true'] { background: #fff; } textarea { box-sizing: border-box; width: 100%; border: 0; resize: vertical; padding: 1rem; font-family: ui-monospace, monospace; }
  iframe { width: 100%; min-height: 15rem; border: 0; } p { padding: .5rem 1rem; }
</style>
