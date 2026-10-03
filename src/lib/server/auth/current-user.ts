import type { RequestEvent } from '@sveltejs/kit';
import { identityAdapter } from './identity-store.ts';
import { requestIdentity } from './identity-request.ts';

/** Only the resolved request principal selects a profile; caller identity is never accepted. */
export async function currentUser(event: RequestEvent) {
  const principal = event.locals.cms?.principal;
  if (!principal) return null;
  const user = await identityAdapter(requestIdentity(event).database).getUserById(principal.id);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role,
    avatarUrl: user.avatarUrl, isFirstLogin: !user.data?.welcomeDismissed };
}
