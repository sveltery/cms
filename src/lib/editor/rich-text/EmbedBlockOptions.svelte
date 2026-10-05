<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Translate } from './types';
  import { htmlMessage } from './html-messages.source';
  import EmbedIcon from './EmbedIcon.svelte';
  let { label, translate, direction, onDelete, isolated, onModeChange }: {
    label: string; translate: Translate; direction: 'ltr' | 'rtl'; onDelete: () => void;
    isolated?: boolean; onModeChange?: (isolated: boolean) => void;
  } = $props();
  let open = $state(false), left = $state(0), top = $state(0);
  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement>();
  const t = (message: string) => htmlMessage(translate, message);
  function items() { return [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"], [role="menuitemradio"]') ?? [])]; }
  async function show(last = false) {
    const rect = trigger.getBoundingClientRect();
    left = direction === 'rtl' ? Math.max(8, rect.right - 320) : Math.min(rect.left, window.innerWidth - 328);
    top = rect.bottom + 4; open = true; await tick();
    (last ? items().at(-1) : items()[0])?.focus();
  }
  function close(restore = true) { open = false; if (restore) trigger?.focus(); }
  function key(event: KeyboardEvent) {
    const rows = items(), current = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'Tab') { close(false); return; }
    if (event.key === 'ArrowDown') next = (current + 1) % rows.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + rows.length) % rows.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const found = rows.findIndex(row => row.textContent?.trim().toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (found < 0) return; next = found;
    } else return;
    event.preventDefault(); event.stopPropagation(); rows[next]?.focus();
  }
  // The real popup lives outside the clipped card, like Source DropdownMenu.
  function portal(element: HTMLElement) { document.body.append(element); return { destroy() { element.remove(); } }; }
  onMount(() => {
    const outside = (event: PointerEvent) => { if (open && event.target instanceof Node && !menu?.contains(event.target) && !trigger.contains(event.target)) close(false); };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  });
</script>
<button bind:this={trigger} type="button" class="options-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open}
  onclick={() => open ? close() : void show()} onkeydown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); void show(event.key === 'ArrowUp'); } }}>
  <EmbedIcon name="DotsThreeVertical" />
</button>
{#if open}
  <div bind:this={menu} use:portal role="menu" aria-label={label} dir={direction} class="embed-menu" style:left={`${left}px`} style:top={`${top}px`} tabindex="-1" onkeydown={key}>
    {#if onModeChange}
      <div role="group" aria-label={t('On the site')}>
        <div class="menu-label">{t('On the site')}</div>
        <button type="button" role="menuitemradio" aria-checked={isolated === true} onclick={() => { close(); onModeChange?.(true); }}>
          <span>{t('Isolated frame')}<small>{t('Runs HTML, CSS and JavaScript in a sandbox.')}</small></span>
        </button>
        <button type="button" role="menuitemradio" aria-checked={isolated !== true} onclick={() => { close(); onModeChange?.(false); }}>
          <span>{t('Inline')}<small>{t("HTML only, cleaned, using your site's styles.")}</small></span>
        </button>
      </div>
      <hr />
    {/if}
    <button type="button" role="menuitem" class="delete" onclick={() => { close(false); onDelete(); }}><EmbedIcon name="Trash" />{t('Delete block')}</button>
  </div>
{/if}
<style>
  .options-trigger { display: inline-flex; align-items: center; justify-content: center; flex: none; border: 0; border-radius: .25rem; width: 2rem; height: 2rem; background: transparent; color: inherit; }
  .options-trigger:hover { background: #eef0f3; }
  .embed-menu { position: fixed; z-index: 100; width: 20rem; max-width: calc(100vw - 1rem); padding: .25rem; border: 1px solid #c4cedd; border-radius: .5rem; background: white; color: #182030; box-shadow: 0 .5rem 1.5rem #18203026; }
  .menu-label { padding: .5rem; font-size: .75rem; color: #667080; }
  .embed-menu button { display: flex; align-items: center; gap: .5rem; width: 100%; border: 0; border-radius: .25rem; padding: .5rem; text-align: start; font: inherit; background: transparent; color: inherit; }
  .embed-menu button:focus, .embed-menu button:hover { outline: none; background: #eef0f3; }
  .embed-menu button[aria-checked='true'] { box-shadow: inset 3px 0 #375ce6; }
  small { display: block; font-size: .75rem; color: #667080; }
  hr { border: 0; border-top: 1px solid #dce0e7; margin: .25rem; }
  .embed-menu .delete { color: #b42318; }
</style>
