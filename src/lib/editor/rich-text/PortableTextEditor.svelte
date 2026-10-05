<script lang="ts">
  // Native Svelte rendering/lifecycle port of the pinned Source editor. Real
  // TipTap/ProseMirror extensions own authoring, identity, history and tables.
  import { onMount, tick } from 'svelte';
  import type { Editor, JSONContent } from '@tiptap/core';
  import { exitSuggestion } from '@tiptap/suggestion';
  import { UnsafePortableTextTableError } from '../portable-text/portable-text-table';
  import { findUnsupportedPortableTextMarks, UnsupportedPortableTextMarksError } from '../portable-text/portable-text-marks';
  import { portableTextToProsemirror } from '../portable-text/admin-converters';
  import EditorFooter from './EditorFooter.svelte';
  import TableSizePicker from './TableSizePicker.svelte';
  import { createPortableTextEditor } from './create-editor';
  import { defaultSlashCommands, insertHtmlBlock, insertIframeBlock, type SlashCommandItem, type SlashMenuState } from './slash-commands';
  import { insertTable } from './insert-table';
  import { getTableControlState, runTableAction, type TableActionId } from './TableActions';
  import { selectionTouchesTable, selectionIsContainedInTableCells } from './TableExtensions';
  import { setSelectionTextAlignment, type TextAlignment } from './table-safety';
  import type { TablePasteRejection } from './TableCellSafety';
  import { setSelectedTextLink } from './editor-values';
  import { sourceMessage, type PortableTextEditorProps, type AuthoringBlock } from './types';
  import './editor.css';
  let props: PortableTextEditorProps = $props();
  let editor = $state.raw<Editor | null>(null), revision = $state(0);
  let element = $state<HTMLDivElement>(null!), menu = $state<HTMLDivElement>(null!);
  let headings = $state(false), tableMenu = $state(false), linkOpen = $state(false), href = $state('');
  let sectionOpen = $state(false), sectionError = $state(''), providerMessage = $state('');
  let SectionPicker = $state<typeof import('../../ui/sections-widgets/SectionPickerModal.svelte').default>();
  let unsupported = $state<string[]>([]), tableError = $state(false), pasteReason = $state<TablePasteRejection | undefined>();
  let announcement = $state('');
  let pendingInsert: number | null = null, movedPointer = false;
  let slash = $state<SlashMenuState>({ isOpen: false, mode: 'commands', items: [], selectedIndex: 0, clientRect: null, range: null, trigger: 'slash', gutterBlockPos: null, dismissedSlashFrom: null });
  const t = $derived(props.translate ?? sourceMessage);
  const editable = $derived(props.editable ?? true);
  const pluginTypes = $derived(new Set((props.pluginBlocks ?? []).map(block => block.type)));
  const blocked = $derived(unsupported.length > 0 || tableError);
  const inTable = $derived.by(() => { void revision; return editor ? selectionTouchesTable(editor.state) : false; });
  const alignmentUnavailable = $derived.by(() => { void revision; return editor ? selectionTouchesTable(editor.state) && !selectionIsContainedInTableCells(editor.state) : false; });
  const controls = $derived.by(() => { void revision; return editor ? getTableControlState(editor) : null; });
  const canUndo = $derived.by(() => { void revision; return editor?.can().undo() ?? false; });
  const canRedo = $derived.by(() => { void revision; return editor?.can().redo() ?? false; });
  const selection = $derived.by(() => { void revision; return editor?.state.selection; });
  const pasteMessage = $derived(pasteReason === 'too-large' ? 'This paste is too large. Paste fewer cells or less text at a time.' :
    pasteReason === 'invalid-tsv' ? 'This spreadsheet data has invalid quoted cells. Fix the quotes or remove the tab separators and try again.' :
    pasteReason === 'table-must-be-top-level' ? 'Tables cannot be pasted inside lists or quotes. Paste the table into its own paragraph and try again.' :
    pasteReason === 'invalid-table' ? 'This table has unsupported cell formatting, merged cells, or column widths. Paste it as plain text or simplify the table and try again.' :
    'Table cells accept text, links, and formatting only.');
  const actions: [TableActionId, string][] = [
    ['select-row', 'Select row'], ['select-column', 'Select column'], ['select-table', 'Select table'],
    ['add-row-before', 'Add row above'], ['add-row-after', 'Add row below'], ['delete-row', 'Delete row'],
    ['add-column-before', 'Add column before'], ['add-column-after', 'Add column after'], ['delete-column', 'Delete column'],
    ['header-row', 'Toggle header row'], ['header-column', 'Toggle header column'], ['merge', 'Merge selected cells'], ['split', 'Split merged cell'],
    ['decrease-width', 'Decrease column width'], ['increase-width', 'Increase column width'], ['distribute-widths', 'Distribute columns evenly'], ['reset-widths', 'Reset column widths'],
    ['paragraph-before', 'Insert paragraph before'], ['paragraph-after', 'Insert paragraph after'], ['delete-table', 'Delete table']
  ];
  const commands = $derived.by(() => {
    const items = defaultSlashCommands.filter(item => item.id !== 'iframe' || !pluginTypes.has('iframe')).map(item => {
      const insert = item.id === 'htmlBlock' ? insertHtmlBlock : item.id === 'iframe' ? insertIframeBlock : undefined;
      return insert ? { ...item, deferInsertion: true, command: ({ editor: current, range }: Parameters<SlashCommandItem['command']>[0]) => {
        const position = pendingInsert; pendingInsert = null;
        if (position === null) insert(current, range); else insert(current, undefined, position);
      } } : item;
    });
    for (const [id, title, description, aliases] of [
      ['image', 'Image', 'Insert an image', ['img', 'photo', 'picture', 'url']],
      ['gallery', 'Gallery', 'Insert an image gallery', ['gal', 'photos', 'grid']],
      ['section', 'Section', 'Insert a reusable section', ['pattern', 'block', 'template']]
    ] as const) items.push({ id, title, description, aliases: [...aliases], icon: '▣', deferInsertion: true,
      command: ({ editor: current, range }) => { current.chain().focus().deleteRange(range).run(); request(id); } });
    for (const block of props.pluginBlocks ?? []) items.push({ id: `plugin-${block.pluginId}-${block.type}`, title: block.label,
      description: block.description ?? `Embed a ${block.label}`, aliases: [block.type], category: block.category ?? 'Embeds', icon: '▣', deferInsertion: true,
      command: ({ editor: current, range }) => {
        current.chain().focus().deleteRange(range).run();
        if (props.onRequestPluginBlock) props.onRequestPluginBlock(block, values => insert({ type: 'pluginBlock', attrs: { blockType: block.type, id: typeof values.url === 'string' ? values.url : '', data: values } }));
        else { pendingInsert = null; providerMessage = 'This block can be inserted when its plugin is available.'; }
      } });
    return items;
  });
  function filterCommands(query: string) {
    if (!query) return commands;
    const search = query.toLowerCase(), titles: SlashCommandItem[] = [], others: SlashCommandItem[] = [];
    for (const item of commands) {
      if (t(item.title).toLowerCase().includes(search)) titles.push(item);
      else if (t(item.description).toLowerCase().includes(search) || item.aliases?.some(alias => alias.toLowerCase().includes(search))) others.push(item);
    }
    return [...titles, ...others];
  }
  function setSlash(next: SlashMenuState | ((previous: SlashMenuState) => SlashMenuState)) { slash = typeof next === 'function' ? next(slash) : next; }
  function error(cause: unknown) {
    if (cause instanceof UnsupportedPortableTextMarksError) unsupported = [...new Set([...unsupported, ...cause.marks])].toSorted();
    else if (cause instanceof UnsafePortableTextTableError) tableError = true;
    else throw cause;
  }
  onMount(() => {
    unsupported = findUnsupportedPortableTextMarks(props.value ?? []);
    if (unsupported.length) return;
    try { portableTextToProsemirror(props.value ?? [], pluginTypes); } catch (cause) { error(cause); return; }
    const current = createPortableTextEditor({ element, props: () => props, filterCommands, getSlashState: () => slash, setSlashState: setSlash,
      onTransaction: () => { revision += 1; }, onError: error, onPasteRejected: reason => { pasteReason = reason; }, onAnnouncement: message => { announcement = message; } });
    editor = current; props.onEditorReady?.(current); props.onGutterReady?.(openGutter);
    const gutterKeys = (event: KeyboardEvent) => {
      if (!slash.isOpen || slash.trigger !== 'gutter') return;
      if (event.key === 'Tab') { closeSlash(); return; }
      if (event.key === 'Escape') { event.preventDefault(); closeSlash(); return; }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { if (slash.items.length) { event.preventDefault(); setSlash(previous => ({ ...previous, selectedIndex: (previous.selectedIndex + (event.key === 'ArrowUp' ? -1 : 1) + previous.items.length) % previous.items.length })); } return; }
      if (event.key === 'Enter') { const item = slash.items[slash.selectedIndex]; if (item) { event.preventDefault(); execute(item); } return; }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && slash.gutterBlockPos !== null) {
        event.preventDefault(); current.chain().focus().insertContentAt(slash.gutterBlockPos, { type: 'paragraph', content: [{ type: 'text', text: event.key }] }).setTextSelection(slash.gutterBlockPos + event.key.length + 1).run();
        setSlash(previous => ({ ...previous, isOpen: false, gutterBlockPos: null }));
      } else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); closeSlash(); }
    };
    current.view.dom.addEventListener('keydown', gutterKeys, true);
    return () => { current.view.dom.removeEventListener('keydown', gutterKeys, true); props.onEditorReady?.(null); current.destroy(); editor = null; };
  });
  $effect(() => {
    if (!editor) return;
    if (editor.isEditable !== (editable && !blocked)) editor.setEditable(editable && !blocked);
    if (!editable && slash.mode === 'table-size') closeSlash();
  });
  $effect(() => {
    if (!slash.isOpen || !menu) { movedPointer = false; return; }
    const bounds = slash.clientRect?.();
    if (bounds) { menu.style.top = `${Math.min(bounds.bottom + 8, window.innerHeight - Math.min(320, menu.offsetHeight) - 8)}px`; menu.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - menu.offsetWidth - 8))}px`; }
    menu.querySelector<HTMLElement>(`[data-index="${slash.selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    const outside = (event: PointerEvent) => { if (!menu.contains(event.target as Node)) closeSlash(); };
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('pointerdown', outside, true); };
  });
  function closeSlash() {
    const state = slash;
    setSlash(previous => ({ ...previous, isOpen: false, mode: 'commands', gutterBlockPos: null, dismissedSlashFrom: state.trigger === 'slash' ? state.range?.from ?? null : previous.dismissedSlashFrom }));
    if (editor && state.trigger === 'slash') exitSuggestion(editor.view);
  }
  function openGutter(position: number) {
    if (!editor?.isEditable) return;
    const dismissed = slash.trigger === 'slash' && slash.isOpen ? slash.range?.from ?? null : slash.dismissedSlashFrom;
    setSlash(previous => ({ ...previous, dismissedSlashFrom: dismissed })); exitSuggestion(editor.view); editor.commands.focus();
    setSlash({ isOpen: true, mode: 'commands', items: filterCommands(''), selectedIndex: 0, range: { from: position, to: position }, trigger: 'gutter', gutterBlockPos: position, dismissedSlashFrom: dismissed,
      clientRect: () => { if (!editor || editor.isDestroyed) return null; const bounds = editor.view.coordsAtPos(position); return new DOMRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top); } });
  }
  function execute(item: SlashCommandItem) {
    if (!editor?.isEditable || !slash.range) return;
    // A new command owns its own insertion position, even if an external
    // provider cancelled an earlier request without returning a selection.
    pendingInsert = null;
    if (item.opensTablePicker) { setSlash(previous => ({ ...previous, mode: 'table-size', isOpen: true })); return; }
    let range = slash.range;
    if (slash.trigger === 'gutter') {
      const position = slash.gutterBlockPos; if (position === null) return;
      if (item.deferInsertion) { pendingInsert = position; const at = editor.state.selection.from; range = { from: at, to: at }; }
      else { if (!editor.chain().focus().insertContentAt(position, { type: 'paragraph' }).setTextSelection(position + 1).run()) return; range = { from: position + 1, to: position + 1 }; }
    }
    item.command({ editor, range }); setSlash(previous => ({ ...previous, isOpen: false, mode: 'commands', gutterBlockPos: null }));
  }
  function insert(content: JSONContent | JSONContent[]) {
    const position = pendingInsert; pendingInsert = null;
    if (!editor?.isEditable) return;
    const chain = editor.chain().focus();
    if (position === null) chain.insertContent(content).run(); else chain.insertContentAt(position, content).run();
  }
  function sectionSelect(section: { content: unknown[] }) {
    if (!editor || !section.content?.length) return;
    try { const document = portableTextToProsemirror(section.content as AuthoringBlock[], pluginTypes); sectionError = ''; insert(document.content as JSONContent[]); }
    catch (cause) {
      if (cause instanceof UnsupportedPortableTextMarksError) sectionError = `This section contains unsupported Portable Text marks: ${cause.marks.join(', ')}.`;
      else if (cause instanceof UnsafePortableTextTableError) sectionError = 'This section contains table content that the editor cannot preserve. Update the section before inserting it.';
      else throw cause;
    }
  }
  export function insertSection(section: { content: unknown[] }) { sectionSelect(section); }
  function request(kind: string) {
    providerMessage = '';
    if (kind === 'section') { if (props.onRequestSection) props.onRequestSection(sectionSelect);
      else { sectionOpen = true; void import('../../ui/sections-widgets/SectionPickerModal.svelte').then(({ default: Picker }) => { SectionPicker = Picker; }).catch(() => { sectionOpen = false; pendingInsert = null; providerMessage = 'Could not load the section picker. Try again.'; }); } }
    else if (kind === 'image' && props.onRequestImage) props.onRequestImage(attrs => insert({ type: 'image', attrs }));
    else if (kind === 'gallery' && props.onRequestGallery) props.onRequestGallery(attrs => insert({ type: 'gallery', attrs }));
    else { pendingInsert = null; providerMessage = 'Media can be inserted when the media library is available.'; }
  }
  function tableInsert(rows: number, columns: number, header: boolean) {
    if (!editor?.isEditable) return;
    if (!insertTable(editor, rows, columns, header, slash.trigger === 'slash' ? slash.range ?? undefined : undefined, slash.trigger === 'gutter' ? slash.gutterBlockPos ?? undefined : undefined)) return;
    if (slash.trigger === 'slash') exitSuggestion(editor.view);
    setSlash(previous => ({ ...previous, isOpen: false, mode: 'commands', gutterBlockPos: null, dismissedSlashFrom: null })); announcement = 'Table inserted';
  }
  function tableCancel() { closeSlash(); editor?.view.focus(); }
  function active(mark: string) { void revision; return editor?.isActive(mark) ?? false; }
  function mark(name: string) { editor?.chain().focus().toggleMark(name).run(); }
  async function heading(level: number) { editor?.chain().focus().setNode(level ? 'heading' : 'paragraph', level ? { level } : {}).run(); headings = false; await tick(); editor?.view.focus(); }
  function link() { if (!editor) return; href = String(editor.getAttributes('link').href ?? ''); linkOpen = true; }
  function applyLink() { if (!editor) return; const url = href.trim(); if (url) setSelectedTextLink(editor, url); else editor.chain().focus().unsetLink().run(); linkOpen = false; }
</script>

<div class={`rich-editor min-w-0 ${props.className ?? ''}`} data-emdash-editor-floating-root>
  {#if tableError}<div role="alert" class="rich-error"><p>This table cannot be edited safely</p><p>This field contains table content that the editor cannot preserve. Update it through the API before editing or saving this content.</p></div>
  {:else if unsupported.length}<div role="alert" class="rich-error"><p>This content cannot be edited safely</p><p>This field contains unsupported Portable Text marks: <code dir="auto">{unsupported.join(', ')}</code>. Remove them through the API before editing or saving this content.</p></div>
  {:else}
    <div class:bg-kumo-base={!props.minimal} class="editor-surface" data-emdash-editor-surface>
      {#if editor && !props.minimal}
        <div role="toolbar" aria-label="Text formatting" class="formatting-toolbar">
          {#each [['Bold', 'bold', 'B'], ['Italic', 'italic', 'I'], ['Underline', 'underline', 'U'], ['Strikethrough', 'strike', 'S'], ['Inline Code', 'code', '</>']] as [label, name, symbol]}
            <button type="button" aria-label={label} aria-pressed={active(name)} disabled={!editable} onmousedown={event => event.preventDefault()} onclick={() => mark(name)}>{symbol}</button>
          {/each}
          <button type="button" aria-label="Headings" aria-expanded={headings} disabled={!editable || inTable} onclick={() => { headings = !headings; }}>H ▾</button>
          <button type="button" aria-label="Bullet List" aria-pressed={active('bulletList')} disabled={!editable || inTable} onmousedown={event => event.preventDefault()} onclick={() => editor?.chain().focus().toggleBulletList().run()}>•</button>
          <button type="button" aria-label="Numbered List" aria-pressed={active('orderedList')} disabled={!editable || inTable} onmousedown={event => event.preventDefault()} onclick={() => editor?.chain().focus().toggleOrderedList().run()}>1.</button>
          <button type="button" aria-label="Quote" aria-pressed={active('blockquote')} disabled={!editable || inTable} onmousedown={event => event.preventDefault()} onclick={() => editor?.chain().focus().toggleBlockquote().run()}>“</button>
          <button type="button" aria-label="Code Block" aria-pressed={active('codeBlock')} disabled={!editable || inTable} onmousedown={event => event.preventDefault()} onclick={() => editor?.chain().focus().toggleCodeBlock().run()}>[ ]</button>
          <button type="button" aria-label="Insert Link" disabled={!editable} onmousedown={event => event.preventDefault()} onclick={link}>↗</button>
          {#each [['Left', 'left'], ['Center', 'center'], ['Right', 'right']] as [label, align]}<button type="button" aria-label={`Align ${label}`} disabled={!editable || alignmentUnavailable} onmousedown={event => event.preventDefault()} onclick={() => editor && setSelectionTextAlignment(editor, align as TextAlignment)}>{label}</button>{/each}
          <button type="button" aria-label="Table" data-emdash-table-trigger aria-expanded={tableMenu} disabled={!editable} onmousedown={event => event.preventDefault()} onclick={() => { tableMenu = !tableMenu; }}>▦</button>
          <button type="button" aria-label="Undo" disabled={!editable || !canUndo} onmousedown={event => event.preventDefault()} onclick={() => editor?.chain().focus().undo().run()}>↶</button>
          <button type="button" aria-label="Redo" disabled={!editable || !canRedo} onmousedown={event => event.preventDefault()} onclick={() => editor?.chain().focus().redo().run()}>↷</button>
        </div>
        {#if headings}<div role="menu" aria-label="Headings" class="heading-menu"><button type="button" role="menuitem" onclick={() => void heading(0)}>Paragraph</button>{#each [1, 2, 3, 4, 5, 6] as level}<button type="button" role="menuitem" data-emdash-heading-item onclick={() => void heading(level)}>Heading {level}</button>{/each}</div>{/if}
        {#if tableMenu}<div role="menu" aria-label="Table actions" class="table-menu">{#if controls}{#each actions as [id, label]}<button type="button" role="menuitem" onclick={() => { if (editor && runTableAction(editor, id)) { announcement = label; tableMenu = false; } }}>{label}</button>{/each}{:else}<button type="button" role="menuitem" onclick={() => { tableMenu = false; openGutter(editor!.state.doc.content.size); setSlash(previous => ({ ...previous, mode: 'table-size' })); }}>Insert table</button>{/if}</div>{/if}
        {#if linkOpen}<div class="link-form"><label>Link URL<input value={href} oninput={event => { href = event.currentTarget.value; }} onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } else if (event.key === 'Escape') { event.preventDefault(); linkOpen = false; editor?.view.focus(); } }} placeholder="https://" /></label><button type="button" onclick={applyLink}>Apply</button><button type="button" onclick={() => { linkOpen = false; editor?.view.focus(); }}>Cancel</button></div>{/if}
      {/if}
      <div bind:this={element} class:spotlight-mode={props.focusMode === 'spotlight'} aria-labelledby={props['aria-labelledby']}></div>
      {#if editor && !props.minimal}<EditorFooter {editor} translate={t} />{/if}
      {#if editor && editable && !props.onGutterReady}<button type="button" class="gutter-insert" aria-label="Insert block" onclick={() => { const selection = editor!.state.selection.$from; const at = selection.depth ? selection.after(1) : selection.pos; openGutter(at); }}>+</button>{/if}
    </div>
    {#if editor && editable && selection && !selection.empty}<div data-emdash-inline-bubble-menu class="inline-bubble"><button type="button" aria-label="Subscript" onmousedown={event => event.preventDefault()} onclick={() => mark('subscript')}>x₂</button><button type="button" aria-label="Superscript" onmousedown={event => event.preventDefault()} onclick={() => mark('superscript')}>x²</button></div>{/if}
    {#if pasteReason}<div role="alert"><p>{pasteMessage}</p><button type="button" aria-label="Dismiss table paste error" onclick={() => { pasteReason = undefined; }}>×</button></div>{/if}
    {#if sectionError}<div role="alert"><p>Could not insert section</p><p>{sectionError}</p><button type="button" aria-label="Dismiss section error" onclick={() => { sectionError = ''; }}>×</button></div>{/if}
    {#if providerMessage}<p role="status">{providerMessage}</p>{/if}
    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">{announcement}</div>
  {/if}
</div>
{#if slash.isOpen}
  <div class="slash-command-menu-positioner">
  <!-- Native nonmodal focus sentinels retain Source portal structure. TipTap
       owns focus; the whole pinned stylesheet keeps these outside Tab order. -->
  <span data-base-ui-focus-guard tabindex="-1" aria-hidden="true" onfocus={() => editor?.view.focus()}></span>
  <div bind:this={menu} class="slash-command-menu" data-slash-command-menu role="dialog" tabindex="-1" aria-label="Insert block" onpointermove={() => { movedPointer = true; }}>
    {#if slash.mode === 'table-size'}<TableSizePicker onInsert={tableInsert} onCancel={tableCancel} />
    {:else}
      {#if slash.items[slash.selectedIndex]}<span role="status" class="sr-only">Selected {t(slash.items[slash.selectedIndex].title)}</span>{/if}
      <div data-slash-menu-scroll-viewport class="overflow-y-auto overscroll-contain slash-scroll">
        {#each slash.items as item, index (item.id)}<button type="button" tabindex="-1" data-index={index} aria-current={index === slash.selectedIndex ? 'true' : undefined}
          class:bg-kumo-interact={index === slash.selectedIndex} onpointerdown={event => event.preventDefault()} onclick={() => execute(item)} onmouseenter={() => { if (movedPointer) setSlash(previous => ({ ...previous, selectedIndex: index })); }}>
          <span aria-hidden="true">{typeof item.icon === 'string' ? item.icon : '▣'}</span><span class="command-text"><span class="font-medium">{t(item.title)}</span><span class="text-xs">{t(item.description)}</span></span>
        </button>{:else}<p>No results</p>{/each}
      </div>
    {/if}
  </div>
  <span data-base-ui-focus-guard tabindex="-1" aria-hidden="true" onfocus={() => editor?.view.focus()}></span>
  </div>
{/if}
{#if sectionOpen && SectionPicker}<SectionPicker open={sectionOpen} onOpenChange={value => { sectionOpen = value; if (!value) pendingInsert = null; }} onSelect={sectionSelect} />{:else if sectionOpen}<p role="status">Loading sections...</p>{/if}
