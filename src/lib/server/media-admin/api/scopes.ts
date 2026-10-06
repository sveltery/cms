// Complete pinned requireScope body; imports consume the existing scope/error owners.
// EmDash1.1.0 913cb1bb; Copyright2026 Cloudflare Inc. MIT notices/emdash-MIT.txt.
import {apiError} from '../../general-media/upstream/api/error.ts';
import {hasScope} from '../../auth/vendor/tokens.ts';
export function requireScope(locals: { tokenScopes?: string[] }, scope: string): Response | null {
	// Session auth = no scope restrictions
	if (!locals.tokenScopes) return null;

	if (hasScope(locals.tokenScopes, scope)) return null;

	return apiError("INSUFFICIENT_SCOPE", `Token lacks required scope: ${scope}`, 403);
}
