import type { SandboxedEditorActionDeclaration, SandboxedEditorPanelDeclaration } from './editor-extensions.ts';
/** JSON provider declaration, separate from supplied trusted Svelte components. */
export interface PluginSurfaceManifest {
  enabled?: boolean;
  adminMode?: 'svelte' | 'blocks' | 'react';
  editorPanels?: readonly SandboxedEditorPanelDeclaration[];
  editorActions?: readonly SandboxedEditorActionDeclaration[];
}
export interface AdminManifest {
  plugins?: Record<string, PluginSurfaceManifest>;
}
