import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CharacterCount from '@tiptap/extension-character-count';
import Focus from '@tiptap/extension-focus';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { portableTextToProsemirror, prosemirrorToPortableText } from '../portable-text/admin-converters';
import { TABLE_CELL_MIN_WIDTH } from '../portable-text/portable-text-table';
import { TopBlockDocument } from './top-block';
import { PortableTextIdentityExtension, PortableTextSpanIdentity, LinkBoundaryExit, countWords, equalJsonValues, URL_SCHEME_REGEX, WWW_PREFIX_REGEX } from './editor-values';
import { EmDashOrderedList } from './ordered-list';
import { CodeMarkExtension } from './CodeMarkExtension';
import { CodeBlockExtension } from './CodeBlockExtension';
import { HtmlBlockExtension } from './HtmlBlockNode';
import { IframeBlockExtension } from './IframeBlockNode';
import { createEmbedBlockNodeView } from './embed-node-view';
import { ImageExtension } from './image-node';
import { GalleryExtension } from './gallery-node';
import { PluginBlockExtension } from './plugin-node';
import { MarkdownLinkExtension } from './MarkdownLinkExtension';
import { EmDashTable, EmDashTableRow, EmDashTableHeader, EmDashTableCell, TableIdentity } from './TableExtensions';
import { TableSafetyShortcuts } from './table-safety';
import { createTableResize } from './TableResize';
import { createTableCellSafety, type TablePasteRejection } from './TableCellSafety';
import { createTableClipboard } from './TableClipboard';
import { createSlashCommandsExtension, type SlashCommandItem, type SlashMenuState } from './slash-commands';
import { sourceMessage, type PortableTextEditorProps } from './types';

interface Host {
  element: HTMLElement; props: () => PortableTextEditorProps;
  filterCommands: (query: string) => SlashCommandItem[];
  getSlashState: () => SlashMenuState;
  setSlashState: (next: SlashMenuState | ((previous: SlashMenuState) => SlashMenuState)) => void;
  onTransaction: () => void; onError: (error: unknown) => void;
  onPasteRejected: (reason: TablePasteRejection) => void;
  onAnnouncement: (message: string) => void;
}

// Immutable Source extensions own rich data, list continuity, clipboard/table
// bounds, marks and history. The Svelte host owns rendering and actual props.
export function createPortableTextEditor(host: Host): Editor {
  const initial = host.props(), blockTypes = new Set((initial.pluginBlocks ?? []).map(block => block.type));
  let lastValue = initial.value ?? [];
  const editor = new Editor({
    element: host.element,
    content: portableTextToProsemirror(lastValue, blockTypes) as JSONContent,
    editable: initial.editable ?? true,
    extensions: [
      PortableTextIdentityExtension, PortableTextSpanIdentity, LinkBoundaryExit,
      StarterKit.configure({ document: false, codeBlock: false, code: false, orderedList: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] }, dropcursor: { color: '#3b82f6', width: 2 },
        link: { shouldAutoLink: url => URL_SCHEME_REGEX.test(url) || WWW_PREFIX_REGEX.test(url), openOnClick: false, enableClickSelection: true, HTMLAttributes: { class: 'text-kumo-link underline' } }, underline: {} }),
      TopBlockDocument, EmDashOrderedList, CodeMarkExtension,
      CodeBlockExtension.configure({ translate: descriptor => (host.props().translate ?? sourceMessage)(descriptor) }),
      HtmlBlockExtension.extend({ addNodeView: () => createEmbedBlockNodeView(() => host.props().translate ?? sourceMessage, () => host.props().locale ?? 'en') }),
      IframeBlockExtension.extend({ addNodeView: () => createEmbedBlockNodeView(() => host.props().translate ?? sourceMessage, () => host.props().locale ?? 'en') }),
      ImageExtension, GalleryExtension, PluginBlockExtension, MarkdownLinkExtension,
      Subscript, Superscript,
      EmDashTable.configure({ allowTableNodeSelection: true, cellMinWidth: TABLE_CELL_MIN_WIDTH, resizable: false }),
      createTableResize(() => host.onAnnouncement('Column width resized')),
      EmDashTableRow, EmDashTableHeader, EmDashTableCell, TableIdentity, TableSafetyShortcuts,
      createTableCellSafety(host.onPasteRejected),
      createTableClipboard(host.onPasteRejected, (rows, columns) => host.onAnnouncement(`${rows} × ${columns} table pasted`)),
      Placeholder.configure({ includeChildren: true, placeholder: () => host.props().placeholder ?? "Start writing, or type '/' for commands" }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      createSlashCommandsExtension({ filterCommands: host.filterCommands, getState: host.getSlashState, onStateChange: host.setSlashState }),
      CharacterCount.configure({ wordCounter: countWords }), Focus.configure({ className: 'has-focus', mode: 'all' }), Typography
    ],
    editorProps: { attributes: {
      class: 'prose prose-sm sm:prose-base dark:prose-invert flow-root w-full max-w-[calc(75ch+8rem)] mx-auto focus:outline-none min-h-[200px] p-4 ps-14 pe-14 sm:ps-16 sm:pe-16', dir: 'auto'
    } },
    onTransaction: host.onTransaction,
    onUpdate({ editor: current }) {
      const callback = host.props().onChange;
      if (!callback) return;
      try {
        const value = prosemirrorToPortableText(current.getJSON() as Parameters<typeof prosemirrorToPortableText>[0]);
        if (equalJsonValues(value, lastValue)) return;
        lastValue = value; callback(value);
      } catch (error) { host.onError(error); }
    }
  });
  const storage = editor.storage as unknown as Record<string, Record<string, unknown>>;
  if (storage.pluginBlock) storage.pluginBlock.registry = new Map((initial.pluginBlocks ?? []).map(block => [block.type, block]));
  return editor;
}
