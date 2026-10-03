export * from './sections.ts';
export * from './widgets.ts';
import { API_BASE, apiFetch, parseApiResponse } from './client.ts';
import type { PluginBlockDef } from './editor.ts';
export interface AdminManifest {
  version: string; hash: string; authMode: string; collections: Record<string, unknown>;
  plugins: Record<string, { portableTextBlocks?: Omit<PluginBlockDef, 'pluginId'>[] }>;
}
export interface Menu { id: string; name: string; label?: string }
export async function fetchManifest(): Promise<AdminManifest> {
  const response = await apiFetch(`${API_BASE}/manifest`);
  return parseApiResponse<AdminManifest>(response, 'Failed to fetch manifest');
}
export async function fetchMenus(): Promise<Menu[]> {
  const response = await apiFetch(`${API_BASE}/menus`);
  const result = await parseApiResponse<{ items: Menu[] }>(response, 'Failed to fetch menus');
  return result.items;
}
