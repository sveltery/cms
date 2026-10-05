<script lang="ts">
  import type { NodeViewState } from './node-view-state.svelte';
  import type { EmbedCardTab } from './embed-card-types';
  import { htmlDraft, htmlFieldValues, HTML_FIELDS, type HtmlField } from './html-draft.svelte';
  import { embedBlockFocus } from './embed-focus.svelte';
  import { htmlMessage } from './html-messages.source';
  import EmbedBlockCard from './EmbedBlockCard.svelte';
  import EmbedCodeEditor from './EmbedCodeEditor.svelte';
  import HtmlBlockPreview from './HtmlBlockPreview.svelte';
  let { state: viewState }: { state: NodeViewState } = $props();
  const draft = htmlDraft(() => viewState);
  let tab = $state<HtmlField | 'preview'>(HTML_FIELDS.some(field => htmlFieldValues(viewState.node.attrs)[field]) ? 'preview' : 'html');
  const previewHeight = { current: 128 };
  let panel: HTMLDivElement | undefined;
  const values = $derived(htmlFieldValues(viewState.node.attrs));
  const isolated = $derived(viewState.node.attrs.isolated === true);
  const activeTab = $derived(isolated || tab === 'html' ? tab : 'preview');
  const t = (message: string) => htmlMessage(viewState.translate, message);
  const tabs = $derived<EmbedCardTab[]>([
    ...(isolated ? HTML_FIELDS : ['html'] as const).map(field => ({ value: field, label: t(field.toUpperCase()), icon: ({ html: 'FileHtml', css: 'FileCss', js: 'FileJs' } as const)[field] })),
    { value: 'preview', label: t('Preview'), icon: 'Eye' }
  ]);
  const focus = embedBlockFocus(() => viewState, draft.flush, attrs => HTML_FIELDS.every(field => !htmlFieldValues(attrs)[field]));
  $effect(() => draft.synchronize(values));
  function changeTab(value: string) {
    if (value !== 'preview' && !HTML_FIELDS.includes(value as HtmlField)) return;
    draft.flush(); tab = value as HtmlField | 'preview';
  }
  function setMode(value: boolean) { draft.flush(); viewState.updateAttributes({ isolated: value }); }
  function remove() { draft.flush(); viewState.deleteBlock?.(); }
  function run() { draft.state.allowScripts = true; panel?.focus(); }
  const editorLabel = (field: HtmlField) => t(field === 'js' ? 'JavaScript code' : `${field.toUpperCase()} code`);
  const placeholder = (field: HtmlField) => t(field === 'html' && isolated ? 'Write HTML, or paste a snippet with its styles and scripts…' : field === 'js' ? 'Write JavaScript…' : `Write ${field.toUpperCase()}…`);
</script>
<EmbedBlockCard state={viewState} className="html-block" {tabs} {activeTab} onTabChange={changeTab}
  menuLabel={t('HTML block options')} onDelete={remove} {focus} {isolated} onModeChange={setMode} onPanelReady={element => { panel = element; }}>
  {#if activeTab === 'preview'}
    <HtmlBlockPreview {...values} {isolated} allowScripts={draft.state.allowScripts} onRun={run} lastHeight={previewHeight} translate={viewState.translate} />
  {:else}
    {#key `${activeTab}-${isolated}-${draft.state.revisions[activeTab]}`}
      <EmbedCodeEditor language={activeTab === 'js' ? 'javascript' : activeTab} value={values[activeTab]}
        onChange={value => draft.change(activeTab, value)} onFocusChange={focus.onFocusChange} onEscape={focus.onEscape}
        editable={viewState.editable} autoFocus={focus.state.autoFocus} ariaLabel={editorLabel(activeTab)}
        placeholder={placeholder(activeTab)} translate={viewState.translate} />
    {/key}
  {/if}
</EmbedBlockCard>
