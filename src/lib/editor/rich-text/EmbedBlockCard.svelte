<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { NodeViewState } from './node-view-state.svelte';
  import type { embedBlockFocus } from './embed-focus.svelte';
  import type { EmbedCardTab } from './embed-card-types';
  import { embedLocaleDirection } from './embed-locale.source';
  import EmbedCardTabs from './EmbedCardTabs.svelte';
  import EmbedBlockOptions from './EmbedBlockOptions.svelte';
  let { state: viewState, className, tabs, activeTab, onTabChange, menuLabel, onDelete, focus, isolated, onModeChange, onPanelReady, children }: {
    state: NodeViewState; className: string; tabs: readonly EmbedCardTab[];
    activeTab: string; onTabChange: (value: string) => void; menuLabel: string; onDelete: () => void;
    focus: ReturnType<typeof embedBlockFocus>; isolated?: boolean; onModeChange?: (value: boolean) => void; onPanelReady?: (panel: HTMLDivElement) => void; children: Snippet;
  } = $props();
  let card: HTMLDivElement, panel: HTMLDivElement;
  const direction = $derived(embedLocaleDirection(viewState.locale?.() ?? 'en'));
  const active = $derived(tabs.find(tab => tab.value === activeTab));
  $effect(() => { if (card && panel) { focus.setElements(card, panel); onPanelReady?.(panel); } });
</script>
<section class={className} contenteditable="false">
  <div bind:this={card} dir={direction} class="embed-card">
    <div class="embed-controls">
      <EmbedCardTabs {tabs} {activeTab} {onTabChange} {direction} />
      {#if viewState.editable}<EmbedBlockOptions label={menuLabel} translate={viewState.translate} {direction} {onDelete} {isolated} {onModeChange} />{/if}
    </div>
    <div bind:this={panel} role="tabpanel" aria-label={active?.label} tabindex="-1" onblur={focus.onPanelBlur}>{@render children()}</div>
  </div>
</section>
<style>
  section { margin-block: .75rem; }
  .embed-card { overflow: hidden; border: 1px solid #c4cedd; border-radius: .5rem; background: white; }
  .embed-card:focus-within { border-color: #375ce6; }
  :global(.ProseMirror-selectednode) .embed-card { outline: 2px solid #375ce6; }
  .embed-controls { display: flex; align-items: center; gap: .5rem; padding: .375rem; }
  [role='tabpanel'] { outline: none; }
</style>
