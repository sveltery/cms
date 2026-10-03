import type { RequestEvent } from '@sveltejs/kit';
import { editorManifest } from '../content/manifest.ts';
import type { WorkspaceNavigation } from '../../ui/nav/navigation.ts';
/** Trusted, read-only display data. Never resolves, creates or alters a principal. */
export async function workspaceNavigation(event: Pick<RequestEvent, 'locals'> & Partial<Pick<RequestEvent, 'request' | 'isRemoteRequest'>>): Promise<WorkspaceNavigation> {
  const context = event.locals.cms;
  const principal = context?.principal;
  if (!principal) return { authenticated: false, permissions: [], collections: {} };
  const permissions = [...principal.permissions];
  // SSR may also render a native form response. Display metadata never adds
  // storage reads to a non-GET page render; actual principal state stays intact.
  // Kit's server-owned remote flag distinguishes successful form refreshes
  // from no-JavaScript page rendering (remote/query.js refresh contract).
  if (event.request && event.request.method !== 'GET' && !event.isRemoteRequest) {
    return { authenticated: true, permissions, collections: {}, unavailable: true };
  }
  if (!permissions.includes('content:read') || !permissions.includes('content:read_drafts')) {
    return { authenticated: true, permissions, collections: {} };
  }
  if (!context?.database) return { authenticated: true, permissions, collections: {}, unavailable: true };
  const manifest = await editorManifest(context.database, principal);
  return { authenticated: true, permissions, collections: Object.fromEntries(Object.entries(manifest.collections)
    .map(([slug, { label, hidden, group, icon }]) => [slug, { label, hidden, group, icon }])) };
}
