import type { PageServerLoad } from './$types';
import { isSafeRedirect } from '$lib/server/auth/safe-redirect';

// Preserve the pinned login continuation; credential/session handling stays in auth.remote.
export const load: PageServerLoad = ({ url }) => {
  const requested = url.searchParams.get('redirect');
  return { loginRedirect: isSafeRedirect(requested) ? requested : null };
};
