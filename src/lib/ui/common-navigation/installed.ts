/**
 * Source-directed native display projection for installed routes only.
 * EmDash 1.1.0 Sidebar.tsx at 913cb1bb uses role40 for Comments, Menus,
 * Widgets and Sections, and role50 for Redirects. These existing trusted
 * capabilities have those same floors. Actual destinations authorize requests
 * independently; display visibility does not depend on the mutation switch.
 * MIT upstream attribution: notices/emdash-MIT.txt; docs/common-navigation.md.
 */
const MANAGEMENT_ITEMS = [
  { route: 'comments', label: 'Comments', permission: 'comments:moderate' },
  { route: 'menus', label: 'Menus', permission: 'menus:manage' },
  { route: 'redirects', label: 'Redirects', permission: 'redirects:manage' },
  { route: 'widgets', label: 'Widgets', permission: 'widgets:manage' },
  { route: 'sections', label: 'Sections', permission: 'sections:manage' }
] as const;

export function installedManagementNavigation(permissions: readonly string[], homeHref: string) {
  const prefix = homeHref.endsWith('/') ? homeHref : `${homeHref}/`;
  return MANAGEMENT_ITEMS.filter(item => permissions.includes(item.permission))
    .map(item => ({ href: `${prefix}${item.route}`, label: item.label }));
}
