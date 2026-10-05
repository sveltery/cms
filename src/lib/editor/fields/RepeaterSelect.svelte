<script lang="ts">
  import { untrack } from 'svelte';
  let { id, label, value, options = [], required = false, disabled = false, onChange }: {
    id: string; label: string; value: unknown; options?: string[];
    required?: boolean; disabled?: boolean; onChange: (value: string) => void;
  } = $props();
  let query = $state(untrack(() => typeof value === 'string' ? value : ''));
  let previous = $state(untrack(() => typeof value === 'string' ? value : ''));
  let open = $state(false), active = $state(-1);
  const filtered = $derived(options.filter(option => option.toLowerCase().includes(query.toLowerCase())));
  const listId = $derived(`${id}-options`);
  $effect(() => {
    const incoming = typeof value === 'string' ? value : '';
    untrack(() => { if (incoming !== previous) { previous = incoming; query = incoming; } });
  });
  function select(option: string) {
    if (disabled) return;
    query = option; open = false; active = -1; onChange(option);
  }
  function keyboard(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); open = true;
      active = filtered.length ? (active + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : -1;
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const option = filtered[active] ?? options.find(option => option === query);
      if (option !== undefined) select(option);
    } else if (event.key === 'Escape') {
      event.preventDefault(); open = false; active = -1;
      query = typeof value === 'string' ? value : '';
    }
  }
</script>

<div class="combobox">
  <label for={id}>{label}{required ? ' *' : ''}</label>
  <input {id} role="combobox" aria-autocomplete="list" aria-expanded={open}
    aria-controls={listId} aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
    value={query} {required} {disabled} placeholder="Select..."
    onfocus={() => { if (!disabled) { open = true; active = -1; } }}
    oninput={event => { query = event.currentTarget.value; open = true; active = -1; }}
    onkeydown={keyboard}
    onblur={() => { open = false; query = typeof value === 'string' ? value : ''; }} />
  {#if open && !disabled}
    <ul id={listId} role="listbox" aria-label={label}>
      {#each filtered as option, index}
        <li id={`${listId}-${index}`} role="option" aria-selected={option === value} class:active={index === active}>
          <button type="button" tabindex="-1" onpointerdown={event => { event.preventDefault(); select(option); }}>{option}</button>
        </li>
      {:else}<li class="empty">No results</li>{/each}
    </ul>
  {/if}
</div>

<style>
  .combobox { position: relative; }
  label { display: block; margin-block-end: .5rem; }
  input { box-sizing: border-box; inline-size: 100%; padding: .625rem; border: 1px solid #c4cedd; border-radius: .375rem; font: inherit; }
  ul { position: absolute; z-index: 10; inset-inline: 0; max-block-size: 16rem; overflow: auto; margin: .25rem 0 0; padding: .25rem; list-style: none; background: white; border: 1px solid #c4cedd; border-radius: .375rem; }
  button { inline-size: 100%; text-align: start; padding: .5rem; border: 0; background: transparent; font: inherit; }
  .active, li:hover { background: #eaf1ff; }
  .empty { padding: .5rem; }
</style>
