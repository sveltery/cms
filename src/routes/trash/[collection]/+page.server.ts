import type { PageServerLoad } from './$types';

/** Display capability only. The remote rechecks trusted configuration, permission and persisted owner. */
export const load: PageServerLoad = ({ locals }) => {
  const context = locals.cms;
  const principal = context?.principal;
  const ready = context?.mutationsEnabled === true && Boolean(context.database) &&
    typeof principal?.id === 'string' && principal.id.length > 0 && principal.id.length <= 128 &&
    Array.isArray(principal.permissions);
  return {
    restoreCapability: {
      any: Boolean(ready && principal?.permissions.includes('content:edit_any')),
      own: Boolean(ready && principal?.permissions.includes('content:edit_own')),
      actorId: ready && principal?.permissions.includes('content:edit_own') ? principal.id : null
    }
  };
};
