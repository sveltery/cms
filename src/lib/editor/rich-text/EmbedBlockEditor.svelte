<script lang="ts">
  import type { NodeViewState } from './node-view-state.svelte';
  import { iframeEmbedFromAttrs, iframeEmbedToCode, httpsUrl, iframeAllow } from '../portable-text/iframe-embed';
  import { iframeDraft } from './iframe-draft.svelte';
  import { embedBlockFocus } from './embed-focus.svelte';
  import EmbedCodeEditor from './EmbedCodeEditor.svelte';
  import IframePreview from './IframePreview.svelte';
  import { buildHtmlBlockFrame, HTML_BLOCK_FRAME_SANDBOX } from '../portable-text/html-block';
  let { state: viewState }: { state: NodeViewState } = $props();
  function initialTab() { return viewState.node.type.name === 'iframeBlock' ? viewState.node.attrs.src ? 'preview' : 'code' : 'html'; }
  let tab = $state(initialTab());
  let card: HTMLElement, panel: HTMLDivElement;
  const draft = iframeDraft(() => viewState);
  const focus = embedBlockFocus(() => viewState, draft.flush, attrs => viewState.node.type.name === 'iframeBlock' ? !iframeEmbedFromAttrs(attrs).src : !attrs.html && !attrs.css && !attrs.js);
  const errorId = $props.id();
  const iframe = $derived(viewState.node.type.name === 'iframeBlock');
  const tabs = $derived(iframe ? ['code', 'preview'] : ['html', 'css', 'js', 'preview']);
  const embed = $derived(iframeEmbedFromAttrs(viewState.node.attrs));
  const code = $derived(embed.src ? iframeEmbedToCode(embed) : '');
  const url = $derived(httpsUrl(embed.src));
  const previewKey = $derived(`${url?.href} ${iframeAllow(embed.allow)} ${embed.allowFullscreen === true}`);
  const current = $derived(typeof viewState.node.attrs[tab] === 'string' ? viewState.node.attrs[tab] : '');
  $effect(() => { if (iframe) draft.synchronize(code); });
  $effect(() => { if (card && panel) focus.setElements(card, panel); });
  function change(text: string) { if (viewState.editable) { if (iframe) draft.change(text); else viewState.updateAttributes({ [tab]: text }); } }
  function focusChanged(focused: boolean) { focus.onFocusChange(focused); if (!focused) draft.canonicalizeAfterBlur(); }
  function changeTab(value: string) { if (iframe) draft.changeTab(); tab = value; }
  function label(value: string) { return value === 'preview' ? 'Preview' : value === 'code' ? 'Code' : value.toUpperCase(); }
</script>

<section bind:this={card} class="embed-card" contenteditable="false" aria-label={iframe ? 'Iframe' : 'HTML'}>
  <div role="tablist" aria-label={iframe ? 'Iframe block' : 'HTML block'}>
    {#each tabs as value}<button type="button" role="tab" aria-selected={tab === value} onclick={() => changeTab(value)}>{label(value)}</button>{/each}
    <button type="button" aria-label="Delete block" disabled={!viewState.editable} onclick={() => { if (iframe) draft.flush(); viewState.deleteBlock?.(); }}>Delete</button>
  </div>
  <div bind:this={panel} role="tabpanel" aria-label={label(tab)} tabindex="-1" onblur={focus.onPanelBlur}>
    {#if tab === 'preview'}
      {#if !iframe}
        {#if viewState.node.attrs.isolated === true}<iframe title="HTML preview" sandbox={HTML_BLOCK_FRAME_SANDBOX} srcdoc={buildHtmlBlockFrame({ html: viewState.node.attrs.html ?? '', css: viewState.node.attrs.css, js: viewState.node.attrs.js })}></iframe>
        {:else}<pre>{viewState.node.attrs.html}</pre>{/if}
      {:else if url && draft.state.loadable === embed.src}
        {#key previewKey}<IframePreview {embed} {url} />{/key}
      {:else if url}
        <div class="preview-consent"><p>This block embeds a page from {url.host}.</p><button type="button" onclick={() => { draft.state.loadable = embed.src; panel.focus(); }}>Load preview</button></div>
      {:else}<p>Nothing to preview yet.</p>{/if}
    {:else if iframe}
      {#key draft.state.revision}<EmbedCodeEditor language="html" value={code} onChange={change} onFocusChange={focusChanged}
        onEscape={focus.onEscape} editable={viewState.editable} autoFocus={focus.state.autoFocus} ariaLabel="Embed code"
        placeholder="Paste an embed code or an https link…" describedBy={errorId} />{/key}
      <div id={errorId} aria-live="polite">{#if draft.state.error}<p role="alert">{draft.state.error}</p>{/if}</div>
    {:else}
      <textarea value={current} rows="8" spellcheck="false" aria-label={tab.toUpperCase()} disabled={!viewState.editable}
        placeholder={`Enter ${tab.toUpperCase()}…`} oninput={event => change(event.currentTarget.value)}></textarea>
    {/if}
  </div>
</section>

<style>
  .embed-card { border: 1px solid #c4cedd; border-radius: .5rem; margin-block: 1rem; }
  [role='tablist'] { display: flex; gap: .25rem; padding: .5rem; background: #f3f5f7; }
  button { border: 0; padding: .5rem; font: inherit; background: transparent; }
  [aria-selected='true'] { background: #fff; } textarea { box-sizing: border-box; width: 100%; border: 0; resize: vertical; padding: 1rem; font-family: ui-monospace, monospace; }
  iframe { width: 100%; min-height: 15rem; border: 0; } p { padding: .5rem 1rem; }
</style>
