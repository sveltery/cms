import type { CodeEditorProps } from './code-editor-config.source';
import type { Translate } from './types';

// The lazy boundary and fulfilled real EditorView accept the same owning
// translator while keeping the whole pinned Source prop declaration intact.
export type NativeCodeEditorProps = CodeEditorProps & { translate?: Translate };
