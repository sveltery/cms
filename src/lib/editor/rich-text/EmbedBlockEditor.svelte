<script lang="ts">
  import type { NodeViewState } from './node-view-state.svelte';
  import { parseIframeInput, iframeEmbedFromAttrs, iframeEmbedAttrs, iframeEmbedToCode } from '../portable-text/iframe-embed';
  import { buildHtmlBlockFrame, HTML_BLOCK_FRAME_SANDBOX } from '../portable-text/html-block';
  let { state: viewState }: { state: NodeViewState } = $props();
  let tab = $state('html'), error = $state('');
  const iframe = $derived(viewState.node.type.name === 'iframeBlock');
  const tabs = $derived(iframe ? ['code', 'preview'] : ['html', 'css', 'js', 'preview']);
  const current = $derived(iframe ? iframeEmbedToCode(iframeEmbedFromAttrs(viewState.node.attrs)) : typeof viewState.node.attrs[tab] === 'string' ? viewState.node.attrs[tab] : '');
  const initialTab = $derived(iframe ? 'code' : 'html');
  $effect(() => { if (!tabs.includes(tab)) tab = initialTab; });
  function change(text: string) {
    if (!viewState.editable) return;
    if (!iframe) { viewState.updateAttributes({ [tab]: text }); return; }
    const parsed = parseIframeInput(text);
    if (parsed.ok) { error = ''; viewState.updateAttributes(iframeEmbedAttrs(parsed.embed)); }
    else error = parsed.reason === 'not-https' ? 'Only https links can be embedded.' : 'No iframe found in this code. For an embed that runs a script, use an HTML block.';
  }
</script>

<section class="embed-card" contenteditable="false" aria-label={iframe ? 'Iframe' : 'HTML'}>
  <div role="tablist" aria-label={iframe ? 'Iframe block' : 'HTML block'}>
    {#each tabs as value}<button type="button" role="tab" aria-selected={tab === value} onclick={() => { tab = value; }}>{value === 'preview' ? 'Preview' : value.toUpperCase()}</button>{/each}
    <button type="button" aria-label="Delete block" disabled={!viewState.editable} onclick={() => viewState.editor.commands.deleteSelection()}>Delete</button>
  </div>
  {#if tab === 'preview'}
    {#if !iframe}
      {#if viewState.node.attrs.isolated === true}<iframe title="HTML preview" sandbox={HTML_BLOCK_FRAME_SANDBOX} srcdoc={buildHtmlBlockFrame({ html: viewState.node.attrs.html ?? '', css: viewState.node.attrs.css, js: viewState.node.attrs.js })}></iframe>
      {:else}<pre>{viewState.node.attrs.html}</pre>{/if}
    {:else}<p>Preview: {viewState.node.attrs.src || 'Nothing to preview yet.'}</p>{/if}
  {:else}
    <textarea value={current} rows="8" spellcheck="false" aria-label={iframe ? 'Embed code' : tab.toUpperCase()} disabled={!viewState.editable}
      placeholder={iframe ? 'Paste an embed code or an https link…' : `Enter ${tab.toUpperCase()}…`} oninput={event => change(event.currentTarget.value)}></textarea>
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
