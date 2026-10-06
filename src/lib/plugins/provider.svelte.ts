import { getContext, setContext } from 'svelte';
import type { Component } from 'svelte';
import { resolvePluginPagePath } from './page-path.ts';

export type PluginComponent = Component<Record<string, unknown>>;
export type { ContentEditorPanelExtension as PluginEditorPanel } from './content-editor-panels.ts';
export type { ContentListColumnExtension as PluginListColumn } from './content-list-columns.ts';
import { resolveContentEditorPanels, type ContentEditorPanelExtension, type ResolvedContentEditorPanel } from './content-editor-panels.ts';
import { resolveContentListColumns, type ContentListColumnExtension, type ResolvedContentListColumn } from './content-list-columns.ts';
import type { AdminManifest } from './manifest-types.ts';
/** Trusted native component values stay in the supplied component tree. */
export interface PluginAdminModule {
  widgets?: Record<string, PluginComponent>;
  pages?: Record<string, PluginComponent>;
  fields?: Record<string, PluginComponent>;
  contentEditorPanels?: readonly ContentEditorPanelExtension[];
  contentListColumns?: readonly ContentListColumnExtension[];
}
export type PluginAdmins = Record<string, PluginAdminModule>;
interface PluginAdminContext { readonly admins: PluginAdmins }
const PLUGIN_ADMIN_CONTEXT = Symbol.for('sveltery:plugin-admin-context');

/** Called during component initialization; getters retain current parent props. */
export function providePluginAdmins(read: () => PluginAdmins): void {
  setContext<PluginAdminContext>(PLUGIN_ADMIN_CONTEXT, { get admins() { return read(); } });
}
export function usePluginAdmins(): PluginAdmins {
  return getContext<PluginAdminContext | undefined>(PLUGIN_ADMIN_CONTEXT)?.admins ?? {};
}
export function usePluginWidget(pluginId: string, widgetId: string): PluginComponent | null {
  return usePluginAdmins()[pluginId]?.widgets?.[widgetId] ?? null;
}
export function usePluginPage(pluginId: string, pathname: string): PluginComponent | null {
  return resolvePluginPagePath(usePluginAdmins()[pluginId]?.pages, pathname);
}
export function usePluginField(pluginId: string, fieldType: string): PluginComponent | null {
  return usePluginAdmins()[pluginId]?.fields?.[fieldType] ?? null;
}
export function usePluginHasPages(pluginId: string): boolean {
  return Object.keys(usePluginAdmins()[pluginId]?.pages ?? {}).length > 0;
}
export function usePluginHasWidgets(pluginId: string): boolean {
  return Object.keys(usePluginAdmins()[pluginId]?.widgets ?? {}).length > 0;
}
export function usePluginEditorPanels(collection: string, userRole: number, pluginStates?: AdminManifest['plugins']): ResolvedContentEditorPanel[] {
  return resolveContentEditorPanels(usePluginAdmins(), collection, userRole, pluginStates);
}
export function usePluginContentListColumns(collection: string, userRole: number, pluginStates?: AdminManifest['plugins']): ResolvedContentListColumn[] {
  return resolveContentListColumns(usePluginAdmins(), collection, userRole, pluginStates);
}
