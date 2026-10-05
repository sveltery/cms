<script lang="ts">
  // Actual Svelte presentation of pinned TableMenu close intents/bookmarks.
  // TableActions, TableExtensions and insertTable remain their existing owners.
  import { flushSync, onMount } from 'svelte';
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
  const triggerId = $props.id();
  let bookmark: SelectionBookmark | null = null, closingFocus: Element | null = null, shortcutReturn = false;
  let pickerFrame = 0, running = false, typeahead = '', typeaheadTimer: ReturnType<typeof setTimeout>;
  let typeaheadPrevious = -1, typeaheadMatch = -1;
  let menuLeft = $state(0), menuTop = $state(0);
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
  function items() { return surface ? [...surface.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]')] : []; }
  function focusItem(item?: HTMLButtonElement) {
    if (!item) return;
    for (const button of items()) button.tabIndex = button === item ? 0 : -1;
    item.focus(); item.scrollIntoView?.({ block: 'nearest' });
  }
  function positionMenu() {
    if (!menuOpen || !trigger || !surface) return;
    const anchor = trigger.getBoundingClientRect(), bounds = surface.getBoundingClientRect(), viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? window.innerWidth), bottom = top + (viewport?.height ?? window.innerHeight);
    const start = getComputedStyle(trigger).direction === 'rtl' ? anchor.right - bounds.width : anchor.left;
    menuLeft = Math.max(left + 8, Math.min(start, right - bounds.width - 8));
    menuTop = Math.max(top + 8, Math.min(anchor.bottom, bottom - bounds.height - 8));
  }
  function open(last = false) {
    if (!editable) return;
    bookmark = editor.state.selection.getBookmark(); shortcutReturn = false; menuOpen = true;
    typeahead = ''; clearTimeout(typeaheadTimer);
    flushSync(); if (!menuOpen || !surface) return;
    positionMenu(); const buttons = items(); focusItem(last ? buttons.at(-1) : buttons[0]);
  }
  function run(action: TableMenuAction, target: HTMLButtonElement) {
    if (!editable || !editor.isEditable || !controls?.can[action[0]]) return;
    const before = editor.state.doc, state = controls;
    const keepOpen = (action[0] === 'header-row' && state.headerRow !== 'mixed') ||
      (action[0] === 'header-column' && state.headerColumn !== 'mixed');
    running = true;
    const changed = runTableAction(editor, action[0]);
    if (changed) {
      const label = tableActionResult(action, state, !before.eq(editor.state.doc), translate);
      if (label) onRun?.(label);
      if (keepOpen) { flushSync(); focusItem(target); }
      else close('focus');
    }
    running = false;
  }
  function insert(rows: number, columns: number, header: boolean) {
    if (!editable || !editor.isEditable) return;
    if (insertTable(editor, rows, columns, header)) { onRun?.(translate(tableMessage('Table inserted'))); void close('focus'); }
  }
  function menuKeyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void close('restore'); return; }
    const buttons = items(), index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      // Exact session/matching rules from pinned BaseUI1.5 useTypeahead;
      // menuRoot supplies500ms and includes focusable disabled items.
      const activeSession = typeahead.length > 0, fresh = !activeSession;
      if (fresh) typeaheadPrevious = index;
      const labels = buttons.map(button => button.textContent?.trim() ?? '');
      const allowRepeated = labels.every(label => label[0]?.toLocaleLowerCase() !== label[1]?.toLocaleLowerCase());
      if (allowRepeated && typeahead === event.key) { typeahead = ''; typeaheadPrevious = typeaheadMatch; }
      typeahead += event.key; clearTimeout(typeaheadTimer);
      typeaheadTimer = setTimeout(() => { typeahead = ''; typeaheadPrevious = typeaheadMatch; }, 500);
      const start = (fresh ? index : typeaheadPrevious) + 1;
      next = matchingItem(buttons, labels, typeahead, start);
      if (next !== -1) typeaheadMatch = next;
      else if (event.key !== ' ') typeahead = '';
      if (event.key === ' ' && !activeSession) return;
    } else return;
    event.preventDefault(); event.stopPropagation(); focusItem(buttons[next]);
  }
  function matchingItem(buttons: HTMLButtonElement[], labels: string[], prefix: string, start: number) {
    if (!buttons.length) return -1;
    const normalizedStart = (start % buttons.length + buttons.length) % buttons.length;
    for (let offset = 0; offset < buttons.length; offset++) {
      const index = (normalizedStart + offset) % buttons.length, item = buttons[index], styles = getComputedStyle(item);
      if (!labels[index].toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()) || !item.isConnected ||
        styles.visibility === 'hidden' || styles.visibility === 'collapse') continue;
      if (typeof item.checkVisibility === 'function' ? !item.checkVisibility() : styles.display === 'none' || styles.display === 'contents') continue;
      return index;
    }
    return -1;
  }
  function triggerKeyboard(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault(); event.stopPropagation(); void open(event.key === 'ArrowUp');
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
      if (running || (!menuOpen && !pickerOpen) || surface?.contains(event.target as Node) || trigger?.contains(event.target as Node)) return;
      void close(null);
    };
    window.addEventListener('keydown', shortcut, true);
    document.addEventListener('pointerdown', outside, true); document.addEventListener('focusin', outside);
    window.addEventListener('resize', positionMenu); window.addEventListener('scroll', positionMenu, true);
    return () => { window.removeEventListener('keydown', shortcut, true); document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside); cancelAnimationFrame(pickerFrame); clearTimeout(typeaheadTimer);
      window.removeEventListener('resize', positionMenu); window.removeEventListener('scroll', positionMenu, true); };
  });
</script>

{#if editable}
  <div class="table-control">
    <button bind:this={trigger} id={triggerId} type="button" aria-label={title} title={title} aria-haspopup="menu" aria-expanded={menuOpen}
      aria-keyshortcuts={more ? undefined : 'Alt+F10'} data-emdash-table-trigger={more ? undefined : ''}
      onmousedown={more ? undefined : event => event.preventDefault()} onblur={() => { shortcutReturn = false; }}
      onkeydown={triggerKeyboard}
      onclick={() => { if (menuOpen) void close(null); else void open(); }}>{more ? '⋯' : '▦'}</button>
    {#if menuOpen}
      <div bind:this={surface} role="menu" aria-label={translate(tableMessage('Table actions'))} aria-labelledby={triggerId} tabindex="-1" class="table-menu" style:left={`${menuLeft}px`} style:top={`${menuTop}px`} onkeydown={menuKeyboard}>
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
                    tabindex="-1" aria-disabled={!controls.can[id]}
                    onmousemove={event => { if (menuOpen && editable && event.currentTarget !== document.activeElement) focusItem(event.currentTarget); }}
                    data-emdash-header-checkbox={header && checked !== 'mixed' ? '' : undefined}
                    class:danger={id === 'delete-table'} onclick={event => run(action, event.currentTarget)}>{tableActionLabel(action, controls, translate)}{#if header && checked === 'mixed'}<span class="mixed">{translate(tableMessage('Mixed'))}</span>{/if}</button>
                {/each}
              </div>
            {/each}
          {/if}
        {:else}
          <button type="button" role="menuitem" tabindex="-1"
            onmousemove={event => { if (menuOpen && editable && event.currentTarget !== document.activeElement) focusItem(event.currentTarget); }}
            onclick={() => void close('picker')}>{translate(tableMessage('Insert table'))}</button>
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
  .table-menu, .table-popover { z-index: 101; border: 1px solid var(--color-kumo-line, #d0d7e2); border-radius: .375rem; background: var(--color-kumo-base, white); }
  .table-menu { position: fixed; }
  .table-popover { position: absolute; inset-block-start: 100%; inset-inline-start: 0; }
  .table-menu { min-width: 12rem; max-width: calc(100vw - 1rem); max-height: min(28rem, 50dvh); overflow-y: auto; padding: .25rem; font-size: .875rem; }
  .table-menu button { display: flex; align-items: center; width: 100%; gap: .5rem; text-align: start; padding: .35rem .5rem; border: 0; background: none; }
  .table-menu button:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
  .table-menu button[aria-disabled="true"] { opacity: .5; }
  .group-label, .selection-label { margin: .2rem .5rem; font-size: .75rem; color: #526174; }
  .mixed { margin-inline-start: auto; font-size: .75rem; color: #526174; }
  .danger { color: #b42318; }
  @media (any-pointer: coarse) { button { min-height: 2.75rem; } }
</style>
