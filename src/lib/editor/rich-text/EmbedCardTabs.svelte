<script lang="ts">
  import type { EmbedCardTab } from './embed-card-types';
  import EmbedIcon from './EmbedIcon.svelte';
  let { tabs, activeTab, onTabChange, direction }: {
    tabs: readonly EmbedCardTab[]; activeTab: string;
    onTabChange: (value: string) => void; direction: 'ltr' | 'rtl';
  } = $props();
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
<div role="tablist" class="segmented-tabs">
  {#each tabs as tab (tab.value)}
    <button type="button" role="tab" aria-selected={activeTab === tab.value} tabindex={activeTab === tab.value ? 0 : -1}
      onfocus={() => activate(tab.value)} onclick={() => activate(tab.value)} onkeydown={key}>
      <EmbedIcon name={tab.icon} /><span class="tab-label">{tab.label}</span>
    </button>
  {/each}
</div>
<style>
  .segmented-tabs { display: flex; gap: .125rem; padding: .125rem; border-radius: .375rem; background: #eef0f3; }
  .segmented-tabs button { display: flex; align-items: center; gap: .25rem; border: 0; padding: .375rem .5rem; border-radius: .25rem; color: inherit; background: transparent; font: inherit; font-size: .875rem; }
  .segmented-tabs [aria-selected='true'] { background: white; box-shadow: 0 1px 2px #18203020; }
  @media (max-width: 639px) { .tab-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; } }
</style>
