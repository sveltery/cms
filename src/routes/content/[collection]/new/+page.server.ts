import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => {
  const context = locals.cms;
  return { canCreate: Boolean(context?.principal && context.database && context.mutationsEnabled === true &&
    context.principal.permissions.includes('content:create')) };
};
