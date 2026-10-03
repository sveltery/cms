import type {PageServerLoad} from './$types';
export const load:PageServerLoad=({locals})=>({canManage:
  locals.cms?.mutationsEnabled===true&&locals.cms.principal?.permissions.includes('redirects:manage')===true});
