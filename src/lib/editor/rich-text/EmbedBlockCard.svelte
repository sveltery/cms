<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { NodeViewState } from './node-view-state.svelte';
  import type { embedBlockFocus } from './embed-focus.svelte';
  import type { EmbedCardTab } from './embed-card-types';
  import { embedLocaleDirection } from './embed-locale.source';
  import EmbedIcon from './EmbedIcon.svelte';
  import EmbedBlockOptions from './EmbedBlockOptions.svelte';
  let { state: viewState, className, tabs, activeTab, onTabChange, menuLabel, onDelete, focus, isolated, onModeChange, onPanelReady, children }: {
    state: NodeViewState & { locale?: () => string }; className: string; tabs: readonly EmbedCardTab[];
    activeTab: string; onTabChange: (value: string) => void; menuLabel: string; onDelete: () => void;
    focus: ReturnType<typeof embedBlockFocus>; isolated?: boolean; onModeChange?: (value: boolean) => void; onPanelReady?: (panel: HTMLDivElement) => void; children: Snippet;
  } = $props();
  let card: HTMLDivElement, panel: HTMLDivElement;
  const direction = $derived(embedLocaleDirection(viewState.locale?.() ?? 'en'));
  const active = $derived(tabs.find(tab => tab.value === activeTab));
  $effect(() => { if (card && panel) { focus.setElements(card, panel); onPanelReady?.(panel); } });
  function activate(value: string) { if (value !== activeTab) onTabChange(value); }
  function key(event: KeyboardEvent) {
    const button = event.currentTarget as HTMLButtonElement;
    const rows = [...button.closest('[role="tablist"]')!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const current = rows.indexOf(button), rtl = direction === 'rtl'; let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else if (event.key === 'ArrowLeft') next = (current + (rtl ? 1 : -1) + rows.length) % rows.length;
    else if (event.key === 'ArrowRight') next = (current + (rtl ? -1 : 1) + rows.length) % rows.length;
    else return;
    event.preventDefault(); event.stopPropagation(); rows[next]?.focus();
  }
</script>
<section class={className} contenteditable="false">
  <div bind:this={card} dir={direction} class="embed-card">
    <div class="embed-controls">
      <div role="tablist" class="segmented-tabs">
        {#each tabs as tab (tab.value)}
          <button type="button" role="tab" aria-selected={activeTab === tab.value} tabindex={activeTab === tab.value ? 0 : -1}
            onfocus={() => activate(tab.value)} onclick={() => activate(tab.value)} onkeydown={key}>
            <EmbedIcon name={tab.icon} /><span class="tab-label">{tab.label}</span>
          </button>
        {/each}
      </div>
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
  .segmented-tabs { display: flex; gap: .125rem; padding: .125rem; border-radius: .375rem; background: #eef0f3; }
  .segmented-tabs button { display: flex; align-items: center; gap: .25rem; border: 0; padding: .375rem .5rem; border-radius: .25rem; color: inherit; background: transparent; font: inherit; font-size: .875rem; }
  .segmented-tabs [aria-selected='true'] { background: white; box-shadow: 0 1px 2px #18203020; }
  [role='tabpanel'] { outline: none; }
  @media (max-width: 639px) { .tab-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; } }
</style>
