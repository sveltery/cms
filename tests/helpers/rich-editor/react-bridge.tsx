// Test-only React transport. Whole original render/setup and assertions remain Source bytes.
import * as React from 'react';
import { useLingui } from '@lingui/react';
import { flushSync, mount, unmount } from 'svelte';
import FooterHost from './FooterHost.svelte';
import { bridgeState } from './state.svelte';
import type { Editor } from '@tiptap/core';
import type { PortableTextEditorProps, Translate } from '../../../src/lib/editor/rich-text/types';
export type { PortableTextEditorProps, PluginBlockDef } from '../../../src/lib/editor/rich-text/types';
export { countWords } from '../../../src/lib/editor/rich-text/editor-values';
export { _buildPluginBlockFormValues, _hasPluginBlockFormData } from '../../../src/lib/editor/rich-text/plugin-values';
export { portableTextToProsemirror as _portableTextToProsemirror, prosemirrorToPortableText as _prosemirrorToPortableText } from '../../../src/lib/editor/portable-text/admin-converters';
const EditorBridge = React.lazy(() => import('./editor-react-bridge'));
export function PortableTextEditor(props: PortableTextEditorProps) {
  return <React.Suspense fallback={null}><EditorBridge {...props} /></React.Suspense>;
}
export function _EditorFooter({ editor }: { editor: Editor }) {
  const { i18n } = useLingui();
  const target = React.useRef<HTMLDivElement>(null);
  const translate = React.useCallback<Translate>(descriptor => i18n._(descriptor), [i18n]);
  const state = React.useMemo(() => bridgeState({ editor, translate }), []);
  React.useLayoutEffect(() => { flushSync(() => Object.assign(state, { editor, translate })); });
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(FooterHost, { target: target.current!, props: { state } }));
    return () => { void unmount(instance); };
  }, []);
  return <div ref={target} />;
}
