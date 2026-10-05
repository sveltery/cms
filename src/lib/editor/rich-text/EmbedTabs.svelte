<script lang="ts">
  let { tabs, active, label, onChange, ariaLabel }: {
    tabs: string[]; active: string; label: (value: string) => string;
    onChange: (value: string) => void; ariaLabel: string;
  } = $props();
  function activate(value: string) { if (active !== value) onChange(value); }
  function key(event: KeyboardEvent) {
    const button = event.currentTarget as HTMLButtonElement;
    const list = button.closest('[role="tablist"]')!;
    const items = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const current = items.indexOf(button), rtl = getComputedStyle(list).direction === 'rtl';
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowLeft') next = (current + (rtl ? 1 : -1) + items.length) % items.length;
    else if (event.key === 'ArrowRight') next = (current + (rtl ? -1 : 1) + items.length) % items.length;
    else return;
    event.preventDefault(); event.stopPropagation(); items[next]?.focus();
  }
</script>
<div role="tablist" aria-label={ariaLabel}>
  {#each tabs as value}<button type="button" role="tab" aria-selected={active === value} tabindex={active === value ? 0 : -1}
    onfocus={() => activate(value)} onkeydown={key} onclick={() => activate(value)}>{label(value)}</button>{/each}
</div>
<style>
  [role='tablist'] { display: flex; gap: .25rem; }
  button { border: 0; padding: .5rem; font: inherit; background: transparent; }
  [aria-selected='true'] { background: #fff; }
</style>
