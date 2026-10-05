<script lang="ts">
  // Svelte lifecycle/presentation of pinned PortableTextEditor.tsx4369–4448.
  // The genuine3.20.0 plugin owns standard-browser positioning and visibility.
  import { onMount } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
  import { PluginKey } from '@tiptap/pm/state';
  import { CellSelection } from '@tiptap/pm/tables';
  import { getTableControlState, runTableAction } from './TableActions';
  import TableMenu from './TableMenu.svelte';
  import { tableMessage, selectedTableLabel } from './table-menu';
  import { sourceMessage, type Translate } from './types';

  let { editor, editable, floatingRoot, formattingToolbar, onRun, translate = sourceMessage }: {
    editor: Editor; editable: boolean; floatingRoot: HTMLElement; formattingToolbar: HTMLElement;
    onRun: (label: string) => void; translate?: Translate;
  } = $props();
  let element = $state<HTMLDivElement>(null!), revision = $state(0);
  const pluginKey = new PluginKey('emdashTableBubbleMenu');
  const controls = $derived.by(() => { void revision; return getTableControlState(editor); });
  onMount(() => {
    const update = () => { revision += 1; };
    editor.on('transaction', update); editor.on('selectionUpdate', update);
    return () => { editor.off('transaction', update); editor.off('selectionUpdate', update); };
  });
  function collisionOptions() {
    const viewport = window.visualViewport, top = viewport?.offsetTop ?? 0, left = viewport?.offsetLeft ?? 0;
    const width = viewport?.width ?? window.innerWidth, bottom = top + (viewport?.height ?? window.innerHeight);
    const toolbarBottom = formattingToolbar?.getBoundingClientRect().bottom ?? top;
    const safeTop = Math.min(bottom, Math.max(top, toolbarBottom));
    return { rootBoundary: { x: left, y: safeTop, width, height: Math.max(0, bottom - safeTop) }, padding: 8 };
  }
  $effect(() => {
    if (!element || editor.isDestroyed) return;
    // Source React registration tracks the current editable presentation.
    const canEdit = editable;
    const plugin = BubbleMenuPlugin({
      editor, element, pluginKey, appendTo: () => floatingRoot,
      options: {
        strategy: 'absolute', placement: 'top', offset: 8, flip: collisionOptions, shift: collisionOptions,
        size: () => ({ ...collisionOptions(), apply: ({ availableWidth, elements }) => {
          elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
          elements.floating.style.overflowX = 'auto'; elements.floating.style.borderRadius = 'var(--radius-lg)';
        } })
      },
      shouldShow: ({ editor: activeEditor, element: activeMenu, state, view }) => {
        // jsdom lacks both Range layout methods. Retain actual registration
        // without requesting unsupported geometry; standard browsers execute
        // the pinned condition below. This provides no visibility/layout credit.
        if (typeof Range.prototype.getBoundingClientRect !== 'function' || typeof Range.prototype.getClientRects !== 'function') return false;
        const active = document.activeElement, triggerId = activeMenu.querySelector('[aria-expanded="true"]')?.id;
        const hasMenuFocus = Boolean(triggerId && active?.closest('[role="menu"]')?.getAttribute('aria-labelledby') === triggerId);
        return canEdit && activeEditor.isEditable && (view.hasFocus() || activeMenu.contains(active) || hasMenuFocus) &&
          activeEditor.isActive('table') && (state.selection.empty || state.selection instanceof CellSelection);
      }
    });
    editor.registerPlugin(plugin);
    return () => { if (!editor.isDestroyed) editor.unregisterPlugin(pluginKey); };
  });
  function run(id: 'add-row-after' | 'add-column-after', message: string) {
    if (editable && editor.isEditable && controls?.can[id] && runTableAction(editor, id)) onRun(translate(tableMessage(message)));
  }
</script>

<div bind:this={element} data-emdash-table-bubble-menu role="group" aria-label={translate({ id: 'q+bMmy', message: 'Table controls' })} class="table-bubble-menu" style:visibility="hidden">
  {#if controls && (controls.rows > 1 || controls.columns > 1)}<span class="summary">{selectedTableLabel(editor, controls, translate)}</span>{/if}
  <button type="button" aria-label={translate(tableMessage('Add row below'))} title={translate(tableMessage('Add row below'))} disabled={!controls?.can['add-row-after']} onclick={() => run('add-row-after', 'Row added below')}>＋↧</button>
  <button type="button" aria-label={translate(tableMessage('Add column after'))} title={translate(tableMessage('Add column after'))} disabled={!controls?.can['add-column-after']} onclick={() => run('add-column-after', 'Column added after')}>＋→</button>
  <TableMenu {editor} {editable} more {translate} {onRun} />
</div>

<style>
  .table-bubble-menu { position: absolute; z-index: 100; display: flex; align-items: center; gap: .125rem; border-radius: .5rem; background: var(--color-kumo-base, white); padding: .25rem; box-shadow: 0 10px 15px -3px #0002; outline: 1px solid var(--color-kumo-line, #d0d7e2); }
  .summary { padding-inline: .5rem; font-size: .75rem; color: var(--text-color-kumo-subtle, #526174); white-space: nowrap; }
  button { width: 2rem; height: 2rem; border: 0; border-radius: .375rem; background: transparent; }
  button:disabled { opacity: .5; }
  button:focus-visible { outline: 2px solid var(--color-kumo-ring, #2563eb); }
  @media (any-pointer: coarse) { button { min-width: 2.75rem; min-height: 2.75rem; } }
</style>
