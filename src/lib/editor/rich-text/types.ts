import type { Editor } from '@tiptap/core';
import type { MessageDescriptor } from '@lingui/core';
import type { portableTextToProsemirror } from '../portable-text/admin-converters';

export type AuthoringBlock = Parameters<typeof portableTextToProsemirror>[0][number];
export type BlockField = { action_id: string; type: string; initial_value?: unknown; [key: string]: unknown };
export interface PluginBlockDef {
  type: string; pluginId: string; label: string; icon?: string; description?: string;
  placeholder?: string; fields?: BlockField[]; category?: string;
}
export type Translate = (descriptor: MessageDescriptor | string) => string;
export interface PortableTextEditorProps {
  value?: AuthoringBlock[]; onChange?: (value: AuthoringBlock[]) => void;
  placeholder?: string; className?: string; editable?: boolean; 'aria-labelledby'?: string;
  pluginBlocks?: PluginBlockDef[]; focusMode?: 'normal' | 'spotlight';
  onFocusModeChange?: (mode: 'normal' | 'spotlight') => void;
  onEditorReady?: (editor: Editor | null) => void; minimal?: boolean;
  onGutterReady?: (insert: (position: number) => void) => void;
  onRequestImage?: (insert: (attributes: Record<string, unknown>) => void) => void;
  onRequestGallery?: (insert: (attributes: Record<string, unknown>) => void) => void;
  onRequestSection?: (insert: (section: { content: unknown[] }) => void) => void;
  onRequestPluginBlock?: (block: PluginBlockDef, insert: (values: Record<string, unknown>) => void) => void;
  translate?: Translate; locale?: string;
}

// English Source fallbacks work without a runtime React/Lingui provider. A
// configured Native localization host supplies the actual catalog translator.
export function sourceMessage(descriptor: MessageDescriptor | string): string {
  if (typeof descriptor === 'string') return descriptor;
  const message = descriptor.message ?? descriptor.id ?? '';
  return message.replace(/\{(\w+), plural, one \{([^}]+)\} other \{([^}]+)\}\}/g,
    (_match, name: string, one: string, other: string) => {
      const count = Number(descriptor.values?.[name]);
      return (count === 1 ? one : other).replaceAll('#', new Intl.NumberFormat('en').format(count));
    }).replace(/\{(\w+)\}/g, (_match, name: string) => String(descriptor.values?.[name] ?? ''));
}
