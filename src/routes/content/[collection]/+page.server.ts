import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => {
  const context = locals.cms;
  return {
    configuredEditor: Boolean(context?.principal && context.database && context.mutationsEnabled === true),
    canCreate: Boolean(context?.principal?.permissions.includes('content:create'))
  };
};
