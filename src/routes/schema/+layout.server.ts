import type { LayoutServerLoad } from './$types';

/** Display capability only; every remote independently checks trusted permission and mutation configuration. */
export const load: LayoutServerLoad = ({ locals }) => {
  const context = locals.cms;
  const principal = context?.principal;
  if (!principal || typeof principal.id !== 'string' || !principal.id.length || principal.id.length > 128 ||
    !Array.isArray(principal.permissions) || !principal.permissions.includes('schema:manage')) {
    return { canMutateSchema: false };
  }
  return { canMutateSchema: context?.mutationsEnabled === true && Boolean(context.database) };
};
