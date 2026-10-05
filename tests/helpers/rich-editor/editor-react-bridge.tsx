// Only the two whole editor families load this transport. Their ORIGINAL
// Source vi.mock factories still own Source provider/module mock behavior.
import * as React from 'react';
import { useLingui } from '@lingui/react';
import { flushSync, mount, unmount } from 'svelte';
import Host from './EditorHost.svelte';
import { bridgeState } from './state.svelte';
import type { Editor } from '@tiptap/core';
import type { PortableTextEditorProps, Translate } from '../../../src/lib/editor/rich-text/types';
import { SectionPickerModal } from '../../../parity/emdash/rich-editor-source/packages/admin/src/components/SectionPickerModal';
import { MediaPickerModal } from '../../../parity/emdash/rich-editor-source/packages/admin/src/components/MediaPickerModal';
import { DragHandleWrapper } from '../../../parity/emdash/rich-editor-source/packages/admin/src/components/editor/DragHandleWrapper';
export default function EditorBridge(props: PortableTextEditorProps) {
  const { i18n } = useLingui();
  const target = React.useRef<HTMLDivElement>(null);
  const instance = React.useRef<ReturnType<typeof Host> | null>(null);
  const gutter = React.useRef<((position: number) => void) | null>(null);
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [sectionOpen, setSectionOpen] = React.useState(false);
  const [imageOpen, setImageOpen] = React.useState(false);
  const imageInsert = React.useRef<((attributes: Record<string, unknown>) => void) | null>(null);
  const translate = React.useCallback<Translate>(descriptor => i18n._(descriptor), [i18n]);
  const ready = React.useCallback((current: Editor | null) => { setEditor(current); props.onEditorReady?.(current); }, [props.onEditorReady]);
  const adapted = { ...props, translate, locale: props.locale ?? i18n.locale, onEditorReady: ready,
    onGutterReady: (insert: (position: number) => void) => { gutter.current = insert; },
    onRequestSection: () => setSectionOpen(true),
    onRequestImage: (insert: (attributes: Record<string, unknown>) => void) => { imageInsert.current = insert; setImageOpen(true); }
  };
  const state = React.useMemo(() => bridgeState(adapted), []);
  React.useLayoutEffect(() => { flushSync(() => Object.assign(state, adapted)); });
  React.useLayoutEffect(() => {
    instance.current = flushSync(() => mount(Host, { target: target.current!, props: { state } }));
    return () => { if (instance.current) void unmount(instance.current); instance.current = null; };
  }, []);
  return <>
    <div ref={target} />
    {editor && (props.editable ?? true) && <DragHandleWrapper editor={editor} onInsertBlock={(position: number) => gutter.current?.(position)} />}
    <SectionPickerModal open={sectionOpen} onOpenChange={setSectionOpen} onSelect={section => instance.current?.insertSection(section)} />
    <MediaPickerModal open={imageOpen} onOpenChange={setImageOpen} onSelect={item => { imageInsert.current?.(item); }} />
  </>;
}
