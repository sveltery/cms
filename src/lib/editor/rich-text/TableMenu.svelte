<script lang="ts">
  // Actual Svelte presentation of pinned TableMenu close intents/bookmarks.
  // TableActions, TableExtensions and insertTable remain their existing owners.
  import { flushSync, onMount, tick } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { NodeSelection, type SelectionBookmark } from '@tiptap/pm/state';
  import { getTableControlState, runTableAction } from './TableActions';
  import { selectionIsContainedInTableCells } from './TableExtensions';
  import { insertTable } from './insert-table';
  import TableSizePicker from './TableSizePicker.svelte';
  import { sourceMessage, type Translate } from './types';
  import { TABLE_ACTION_GROUPS, tableMessage, selectedTableLabel, tableActionLabel, tableActionResult, type TableMenuAction } from './table-menu';

  let { editor, editable: editableProp, more = false, onRun, translate = sourceMessage }: {
    editor: Editor; editable?: boolean; more?: boolean; onRun?: (label: string) => void; translate?: Translate;
  } = $props();
  let revision = $state(0), menuOpen = $state(false), pickerOpen = $state(false);
  let trigger = $state<HTMLButtonElement>(null!), surface = $state<HTMLDivElement>(null!);
  let bookmark: SelectionBookmark | null = null, closingFocus: Element | null = null, shortcutReturn = false;
  let pickerFrame = 0;
  const editable = $derived.by(() => { void revision; return editableProp ?? editor.isEditable; });
  const inTable = $derived.by(() => { void revision; return selectionIsContainedInTableCells(editor.state) ||
    (editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.spec.tableRole === 'table'); });
  const controls = $derived.by(() => { void revision; return menuOpen ? getTableControlState(editor) : null; });
  const title = $derived(translate(tableMessage(more ? 'More table actions' : 'Table')));

  $effect(() => {
    const current = editor;
    const update = () => { revision += 1; };
    current.on('transaction', update); current.on('selectionUpdate', update);
    return () => { current.off('transaction', update); current.off('selectionUpdate', update); };
  });
  $effect(() => { if (!editable) { menuOpen = false; pickerOpen = false; shortcutReturn = false; cancelAnimationFrame(pickerFrame); } });

  function restore(restoreSelection = true) {
    const active = document.activeElement;
    if (editor.isDestroyed || editor.view.hasFocus() ||
      (active !== document.body && active !== trigger && !closingFocus?.contains(active))) return;
    try { if (restoreSelection && bookmark) editor.view.dispatch(editor.state.tr.setSelection(bookmark.resolve(editor.state.doc))); } catch { /* Source tolerates an obsolete bookmark. */ }
    editor.view.focus();
  }
  function close(intent: 'focus' | 'restore' | 'picker' | null) {
    closingFocus = document.activeElement?.closest('[role="menu"], [role="dialog"]') ?? null;
    menuOpen = false; pickerOpen = false; shortcutReturn = false;
    // This Native surface has no close animation. Complete its DOM teardown
    // before the pinned close-intent restores focus to the editor.
    flushSync();
    if (intent === 'picker') pickerFrame = requestAnimationFrame(() => { if (editable && !editor.isDestroyed) pickerOpen = true; });
    else if (intent === 'focus') restore(false);
    else if (intent === 'restore') restore();
  }
  async function open() {
    if (!editable) return;
    bookmark = editor.state.selection.getBookmark(); shortcutReturn = false; menuOpen = true;
    await tick(); surface?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }
  function run(action: TableMenuAction) {
    if (!editable || !editor.isEditable || !controls) return;
    const before = editor.state.doc, state = controls;
    if (runTableAction(editor, action[0])) {
      const label = tableActionResult(action, state, !before.eq(editor.state.doc), translate);
      if (label) onRun?.(label); void close('focus');
    }
  }
  function insert(rows: number, columns: number, header: boolean) {
    if (!editable || !editor.isEditable) return;
    if (insertTable(editor, rows, columns, header)) { onRun?.(translate(tableMessage('Table inserted'))); void close('focus'); }
  }
  function menuKeyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void close('restore'); return; }
    const items = [...surface.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault(); event.stopPropagation(); items[next]?.focus();
  }
  onMount(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (more || !editable) return;
      if (event.altKey && event.key === 'F10' && editor.view.dom.contains(event.target as Node)) {
        bookmark = editor.state.selection.getBookmark(); shortcutReturn = true; trigger?.focus();
      } else if (event.key === 'Escape' && !menuOpen && event.target === trigger && shortcutReturn) {
        event.preventDefault(); shortcutReturn = false; restore();
      }
    };
    const outside = (event: Event) => {
      if ((!menuOpen && !pickerOpen) || surface?.contains(event.target as Node) || trigger?.contains(event.target as Node)) return;
      void close(null);
    };
    window.addEventListener('keydown', shortcut, true);
    document.addEventListener('pointerdown', outside, true); document.addEventListener('focusin', outside);
    return () => { window.removeEventListener('keydown', shortcut, true); document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside); cancelAnimationFrame(pickerFrame); };
  });
</script>

{#if editable}
  <div class="table-control">
    <button bind:this={trigger} type="button" aria-label={title} title={title} aria-haspopup="menu" aria-expanded={menuOpen}
      aria-keyshortcuts={more ? undefined : 'Alt+F10'} data-emdash-table-trigger={more ? undefined : ''}
      onmousedown={more ? undefined : event => event.preventDefault()} onblur={() => { shortcutReturn = false; }}
      onclick={() => { if (menuOpen) void close(null); else void open(); }}>{more ? '⋯' : '▦'}</button>
    {#if menuOpen}
      <div bind:this={surface} role="menu" aria-label={translate(tableMessage('Table actions'))} tabindex="-1" class="table-menu" onkeydown={menuKeyboard}>
        {#if more || inTable}
          {#if controls}
            <p class="selection-label">{selectedTableLabel(editor, controls, translate)}</p>
            {#each TABLE_ACTION_GROUPS as [group, actions], index}
              {#if index > 0}<hr />{/if}
              <div role="group" aria-label={translate(tableMessage(group))}>
                <p class="group-label">{translate(tableMessage(group))}</p>
                {#each actions as action}
                  {@const id = action[0]}
                  {@const header = id === 'header-row' || id === 'header-column'}
                  {@const checked = id === 'header-row' ? controls.headerRow : controls.headerColumn}
                  <button type="button" role={header ? 'menuitemcheckbox' : 'menuitem'} aria-checked={header ? checked : undefined}
                    data-emdash-header-checkbox={header && checked !== 'mixed' ? '' : undefined}
                    class:danger={id === 'delete-table'} disabled={!controls.can[id]} onclick={() => run(action)}>
                    {tableActionLabel(action, controls, translate)}
                    {#if header && checked === 'mixed'}<span class="mixed">{translate(tableMessage('Mixed'))}</span>{/if}
                  </button>
                {/each}
              </div>
            {/each}
          {/if}
        {:else}
          <button type="button" role="menuitem" onclick={() => void close('picker')}>{translate(tableMessage('Insert table'))}</button>
        {/if}
      </div>
    {/if}
    {#if pickerOpen && !more}
      <div bind:this={surface} class="table-popover"><TableSizePicker onInsert={insert} onCancel={() => void close('restore')} {translate} /></div>
    {/if}
  </div>
{/if}

<style>
  .table-control { position: relative; display: inline-flex; }
  .table-menu, .table-popover { position: absolute; inset-block-start: 100%; inset-inline-start: 0; z-index: 30; border: 1px solid #d0d7e2; border-radius: .375rem; background: white; }
  .table-menu { min-width: 12rem; max-width: calc(100vw - 1rem); max-height: min(28rem, 50dvh); overflow-y: auto; padding: .25rem; font-size: .875rem; }
  .table-menu button { display: flex; align-items: center; width: 100%; gap: .5rem; text-align: start; padding: .35rem .5rem; border: 0; background: none; }
  .table-menu button:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
  .table-menu button:disabled { opacity: .5; }
  .group-label, .selection-label { margin: .2rem .5rem; font-size: .75rem; color: #526174; }
  .mixed { margin-inline-start: auto; font-size: .75rem; color: #526174; }
  .danger { color: #b42318; }
  @media (any-pointer: coarse) { button { min-height: 2.75rem; } }
</style>
