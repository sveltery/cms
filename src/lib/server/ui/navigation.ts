import type { RequestEvent } from '@sveltejs/kit';
import { editorManifest } from '../content/manifest.ts';
import type { WorkspaceNavigation } from '../../ui/nav/navigation.ts';
/** Trusted, read-only display data. Never resolves, creates or alters a principal. */
export async function workspaceNavigation(event: Pick<RequestEvent, 'locals'>): Promise<WorkspaceNavigation> {
  const context = event.locals.cms;
  const principal = context?.principal;
  if (!principal) return { authenticated: false, permissions: [], collections: {} };
  const permissions = [...principal.permissions];
  if (!permissions.includes('content:read') || !permissions.includes('content:read_drafts')) {
    return { authenticated: true, permissions, collections: {} };
  }
  if (!context?.database) return { authenticated: true, permissions, collections: {}, unavailable: true };
  const manifest = await editorManifest(context.database, principal);
  return { authenticated: true, permissions, collections: Object.fromEntries(Object.entries(manifest.collections)
    .map(([slug, { label, hidden, group, icon }]) => [slug, { label, hidden, group, icon }])) };
}
