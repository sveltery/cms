import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => ({
  canManageWidgets: locals.cms?.mutationsEnabled === true && Boolean(locals.cms?.database) && locals.cms?.principal?.permissions.includes('widgets:manage') === true,
  canReadSections: locals.cms?.principal?.permissions.includes('sections:read') === true
});
