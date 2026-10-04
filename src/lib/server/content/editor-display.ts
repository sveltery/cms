import type { ServerPrincipal } from '../database/service.ts';

export interface EditorCapability {
  principalId: string | null; create: boolean; editAny: boolean; editOwn: boolean; deleteAny: boolean; deleteOwn: boolean;
}
/** Display only; each existing mutation still checks trusted configuration and stored ownership. */
export function editorCapability(context: { principal?: ServerPrincipal | null; database?: unknown; mutationsEnabled?: boolean } | undefined): EditorCapability {
  const principal = context?.principal;
  const ready = Boolean(context?.database && context.mutationsEnabled === true && principal);
  const permissions = new Set<string>(principal?.permissions ?? []);
  return { principalId: ready ? principal!.id : null, create: ready && permissions.has('content:create'),
    editAny: ready && permissions.has('content:edit_any'), editOwn: ready && permissions.has('content:edit_own'),
    deleteAny: ready && permissions.has('content:delete_any'), deleteOwn: ready && permissions.has('content:delete_own') };
}
