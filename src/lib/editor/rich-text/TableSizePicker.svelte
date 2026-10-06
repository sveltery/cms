<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { sourceMessage, type Translate } from './types';
  import { tableMessage } from './table-control-messages';
  let { onInsert, onCancel, translate = sourceMessage }: { onInsert: (rows: number, columns: number, header: boolean) => void; onCancel: () => void; translate?: Translate } = $props();
  let rows = $state(1), columns = $state(1), header = $state(true);
  let hovered = $state<readonly [number, number] | null>(null), coarse = $state(false);
  let grid = $state<HTMLDivElement>(null!);
  let rowsControl = $state<HTMLSelectElement>(null!);
  const sizes = Array.from({ length: 10 }, (_, index) => index + 1);
  const preview = $derived(hovered ?? [rows, columns]);
  const id = $props.id();
  onMount(() => { coarse = matchMedia('(any-pointer: coarse)').matches; void tick().then(focusActiveControl); });
  function focusActiveControl() {
    if (coarse) rowsControl?.focus();
    else grid?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }
  async function move(row: number, column: number) { hovered = null; rows = Math.max(1, Math.min(10, row)); columns = Math.max(1, Math.min(10, column)); await tick(); focusActiveControl(); }
  function keyboard(event: KeyboardEvent) {
    const rtl = getComputedStyle(grid).direction === 'rtl';
    if (event.key === 'Enter' || event.key === ' ') onInsert(rows, columns, header);
    else if (event.key === 'ArrowUp') void move(rows - 1, columns);
    else if (event.key === 'ArrowDown') void move(rows + 1, columns);
    else if (event.key === 'ArrowLeft') void move(rows, columns + (rtl ? 1 : -1));
    else if (event.key === 'ArrowRight') void move(rows, columns + (rtl ? -1 : 1));
    else if (event.key === 'Home') void move(event.ctrlKey ? 1 : rows, 1);
    else if (event.key === 'End') void move(event.ctrlKey ? 10 : rows, 10);
    else return;
    event.preventDefault(); event.stopPropagation();
  }
</script>

<div role="dialog" aria-label={translate(tableMessage('Insert table'))} tabindex="-1" class="table-picker" onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); onCancel(); } }}>
  <p>{translate(tableMessage('{previewRows} × {previewColumns} table', { previewRows: preview[0], previewColumns: preview[1] }))}</p>
  {#if !coarse}
    <div bind:this={grid} role="grid" tabindex="-1" aria-label={translate(tableMessage('Table size'))} aria-multiselectable="true" onkeydown={keyboard} onmouseleave={() => { hovered = null; }}>
      {#each sizes as row}<div role="row">{#each sizes as column}
        <button type="button" role="gridcell" tabindex={row === rows && column === columns ? 0 : -1}
          aria-label={translate(tableMessage('{row} × {column} table', { row, column }))} aria-selected={row <= preview[0] && column <= preview[1]}
          onmouseenter={() => { hovered = [row, column]; }} onfocus={() => { rows = row; columns = column; hovered = null; }} onclick={() => onInsert(row, column, header)}></button>
      {/each}</div>{/each}
    </div>
  {:else}
    <label for={`${id}-rows`}>{translate(tableMessage('Rows'))}</label><select bind:this={rowsControl} id={`${id}-rows`} bind:value={rows}>{#each sizes as size}<option value={size}>{size}</option>{/each}</select>
    <label for={`${id}-columns`}>{translate(tableMessage('Columns'))}</label><select id={`${id}-columns`} bind:value={columns}>{#each sizes as size}<option value={size}>{size}</option>{/each}</select>
  {/if}
  <label><input type="checkbox" role="switch" bind:checked={header} /> {translate(tableMessage('Header row'))}</label>
  {#if coarse}<button type="button" onclick={() => onInsert(rows, columns, header)}>{translate(tableMessage('Insert table'))}</button>{/if}
</div>

<style>
  .table-picker { padding: .75rem; width: fit-content; max-width: 100%; }
  [role='row'] { display: grid; grid-template-columns: repeat(10, 1.5rem); gap: .125rem; margin-block-end: .125rem; }
  [role='gridcell'] { height: 1.5rem; width: 1.5rem; border: 1px solid #c4cedd; border-radius: .125rem; padding: 0; background: white; }
  [aria-selected='true'] { background: #3b82f6; } label { display: block; margin-block-start: .75rem; }
</style>
