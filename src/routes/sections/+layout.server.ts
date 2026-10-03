import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = ({ locals }) => ({
  canManageSections: locals.cms?.mutationsEnabled === true && Boolean(locals.cms?.database) && locals.cms?.principal?.permissions.includes('sections:manage') === true,
  canReadWidgets: locals.cms?.principal?.permissions.includes('widgets:read') === true
});
