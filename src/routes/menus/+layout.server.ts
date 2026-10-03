import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { menuStorageReady } from '$lib/server/menus/readiness.ts';
import { getI18nConfig } from '$lib/server/menus/i18n-config.ts';

/** Display current trusted capabilities; runtime requests still authorize writes. */
export const load: LayoutServerLoad = async ({ locals }) => {
  const context = locals.cms;
  if (!context?.principal) error(401, 'Authentication required');
  if (!context.principal.permissions.includes('menus:read')) error(403, 'Insufficient permissions');
  if (!await menuStorageReady(context.database)) error(503, 'Menus are unavailable');
  return { basePath: locals.cmsRuntime?.basePath ?? '', i18n: getI18nConfig(),
    canMutateMenus: context.mutationsEnabled === true && context.principal.permissions.includes('menus:manage') };
};
