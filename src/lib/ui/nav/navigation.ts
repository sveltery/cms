import { groupNavItems } from './sidebar-groups.ts';
export interface WorkspaceCollection { label: string; hidden?: boolean; group?: string; icon?: string }
export interface WorkspaceNavigation {
  authenticated: boolean; permissions: readonly string[];
  collections: Record<string, WorkspaceCollection>; unavailable?: boolean;
}
export interface WorkspaceLink { href: string; label: string; group?: string; iconName?: string }
/** Display projection only. Destinations independently authorize requests. */
export function collectionNavigation(navigation: WorkspaceNavigation, homeHref: string) {
  const prefix = homeHref.endsWith('/') ? homeHref : `${homeHref}/`;
  return groupNavItems(Object.entries(navigation.collections).filter(([, collection]) => !collection.hidden)
    .map(([slug, collection]): WorkspaceLink => ({ href: `${prefix}content/${encodeURIComponent(slug)}`,
      label: collection.label, group: collection.group, iconName: collection.icon })));
}
// Pinned Sidebar.tsx isItemActive contract, with native base-qualified paths.
export function isItemActive(itemPath: string, currentPath: string): boolean {
  const queryIndex = itemPath.indexOf('?');
  const path = queryIndex === -1 ? itemPath : itemPath.slice(0, queryIndex);
  return path === '/' ? currentPath === '/' : currentPath === path || currentPath.startsWith(`${path}/`);
}
// Pinned Sidebar.tsx parseFolderState contract; failures stay display-only.
export function parseFolderState(raw: string | null): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const state: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) if (typeof value === 'boolean') state[key] = value;
    return state;
  } catch { return {}; }
}

// Native installed-route display projection; complete Source Sidebar remains separate.
export { installedManagementNavigation } from '../common-navigation/installed.ts';
