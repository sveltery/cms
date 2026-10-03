// Browser-safe media-only UI projection of the pinned auth RBAC thresholds.
// Server permission/origin/identity checks remain authoritative for every request.
const mediaRoles=Object.freeze({
 'media:read':10,'media:upload':20,'media:edit_own':30,
 'media:edit_any':40,'media:delete_own':30,'media:delete_any':40,
} as const);
export type MediaPermission=keyof typeof mediaRoles;
export function mediaPermissionsForUser(user:{role:unknown}|null|undefined):readonly MediaPermission[]{
 if(!user||![10,20,30,40,50].includes(user.role as number))return [];
 return (Object.keys(mediaRoles) as MediaPermission[]).filter(permission=>(user.role as number)>=mediaRoles[permission]);
}
