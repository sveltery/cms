import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => {
  const context = locals.cms;
  return {
    mutationsEnabled: Boolean(context?.principal && context.database && context.mutationsEnabled === true),
    principalId: context?.principal?.id,
    editAny: Boolean(context?.principal?.permissions.includes('content:edit_any')),
    editOwn: Boolean(context?.principal?.permissions.includes('content:edit_own'))
  };
};
