import type { Snippet } from 'svelte';
export interface PluginBlockDef {
  type: string; label: string; pluginId: string; icon?: string;
  description?: string; placeholder?: string; fields?: unknown[]; category?: string;
}
export interface BlockSidebarPanel {
  type: 'image' | 'gallery'; attrs: Record<string, unknown>;
  onUpdate: (attrs: Record<string, unknown>) => void;
  onReplace: (attrs: Record<string, unknown>) => void;
  onDelete: () => void; onClose: () => void;
}
export interface EditorProps {
  value: unknown[]; onChange: (value: unknown[]) => void;
  minimal?: boolean; placeholder?: string; pluginBlocks: PluginBlockDef[];
  onBlockSidebarOpen: (panel: BlockSidebarPanel) => void;
  onBlockSidebarClose: () => void;
}
// Production must supply a real, qualified editor. An absent provider is shown
// explicitly; a fixture renderer belongs only to the preserved Source host.
export type EditorRenderer = Snippet<[EditorProps]>;
