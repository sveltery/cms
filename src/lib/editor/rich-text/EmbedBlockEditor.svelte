<script lang="ts">
  import type { NodeViewState } from './node-view-state.svelte';
  import type { EmbedCardTab } from './embed-card-types';
  import { iframeEmbedFromAttrs, iframeEmbedToCode, httpsUrl, iframeAllow } from '../portable-text/iframe-embed';
  import { iframeDraft } from './iframe-draft.svelte';
  import { embedBlockFocus } from './embed-focus.svelte';
  import EmbedCodeEditor from './EmbedCodeEditor.svelte';
  import IframePreview from './IframePreview.svelte';
  import HtmlBlockEditor from './HtmlBlockEditor.svelte';
  import EmbedBlockCard from './EmbedBlockCard.svelte';
  import EmbedIcon from './EmbedIcon.svelte';
  import { embedMessage } from './embed-messages.source';
  let { state: viewState }: { state: NodeViewState } = $props();
  function initialTab() { return viewState.node.attrs.src ? 'preview' : 'code'; }
  let tab = $state(initialTab());
  let panel: HTMLDivElement | undefined;
  // The actual NodeView rejects a node-type change. Initialize iframe lifecycle
  // owners only for iframe nodes; HtmlBlockEditor owns the HTML lifecycle.
  function createDraft() { return viewState.node.type.name === 'iframeBlock' ? iframeDraft(() => viewState) : undefined; }
  const draft = createDraft();
  const focus = draft ? embedBlockFocus(() => viewState, draft.flush, attrs => !iframeEmbedFromAttrs(attrs).src) : undefined;
  const errorId = $props.id();
  const embed = $derived(iframeEmbedFromAttrs(viewState.node.attrs));
  const code = $derived(embed.src ? iframeEmbedToCode(embed) : '');
  const url = $derived(httpsUrl(embed.src));
  const previewKey = $derived(`${url?.href} ${iframeAllow(embed.allow)} ${embed.allowFullscreen === true}`);
  const t = $derived(viewState.translate);
  const tabs = $derived<EmbedCardTab[]>([
    { value: 'code', label: embedMessage(t, 'Code'), icon: 'Code' },
    { value: 'preview', label: embedMessage(t, 'Preview'), icon: 'Eye' }
  ]);
  $effect(() => { draft?.synchronize(code); });
  function change(text: string) { if (viewState.editable) draft?.change(text); }
  function focusChanged(focused: boolean) { focus?.onFocusChange(focused); if (!focused) draft?.canonicalizeAfterBlur(); }
  function changeTab(value: string) { draft?.changeTab(); tab = value; }
  function remove() { draft?.flush(); viewState.deleteBlock?.(); }
</script>

{#if viewState.node.type.name === 'htmlBlock'}
  <HtmlBlockEditor state={viewState} />
{:else if draft && focus}
  <EmbedBlockCard state={viewState} className="iframe-block" {tabs} activeTab={tab} onTabChange={changeTab}
    menuLabel={embedMessage(t, 'Iframe block options')} onDelete={remove} {focus} onPanelReady={element => { panel = element; }}>
    {#if tab === 'preview'}
      {#if url && draft.state.loadable === embed.src}
        {#key previewKey}<IframePreview {embed} {url} translate={t} />{/key}
      {:else if url}
        <div class="preview-consent"><p>{embedMessage(t, 'This block embeds a page from {0}.', { 0: url.host })}</p><button type="button" onclick={() => { draft.state.loadable = embed.src; panel?.focus(); }}><EmbedIcon name="Play" />{embedMessage(t, 'Load preview')}</button></div>
      {:else}<p class="empty">{embedMessage(t, 'Nothing to preview yet.')}</p>{/if}
    {:else}
      {#key draft.state.revision}<EmbedCodeEditor language="html" value={code} onChange={change} onFocusChange={focusChanged}
        onEscape={focus.onEscape} editable={viewState.editable} autoFocus={focus.state.autoFocus} ariaLabel={embedMessage(t, 'Embed code')}
        placeholder={embedMessage(t, 'Paste an embed code or an https link…')} describedBy={errorId} translate={t} />{/key}
      <div id={errorId} aria-live="polite">{#if draft.state.error}<p role="alert">{embedMessage(t, draft.state.error)}</p>{/if}</div>
    {/if}
  </EmbedBlockCard>
{/if}
<style>
  .preview-consent { display: flex; flex-direction: column; align-items: center; gap: .75rem; padding: 1.5rem .75rem; font-size: .875rem; }
  .preview-consent p { margin: 0; color: #667080; }
  .preview-consent button { display: flex; align-items: center; gap: .5rem; border: 1px solid #c4cedd; border-radius: .375rem; padding: .375rem .75rem; background: white; font: inherit; }
  .empty { padding: 1.5rem .75rem; text-align: center; color: #667080; font-size: .875rem; }
</style>
