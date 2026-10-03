// Complete pinned buildNavItems/filterNavItems, with native type/icon/i18n imports.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e MIT Cloudflare Inc.
// notices/emdash-MIT.txt; framework presentation substitutions recorded in docs/search.md.
import {ADMIN_NAV_ICONS,getCollectionNavIcon,getTaxonomyNavIcon,resolveNavIcon,Gear,Users,ArrowsLeftRight,type NavIcon} from './navigation-icons.ts';
type MessageDescriptor=string;
const msg=(parts:TemplateStringsArray)=>parts.join('');
const ROLE_ADMIN=50,ROLE_EDITOR=40,ROLE_CONTRIBUTOR=20;
const PLUGIN_PAGE_PATH_PATTERN=/^\/[a-z0-9][a-z0-9/_-]*$/i;
export type CommandPaletteManifest={collections:Record<string,{label:string;labelSingular?:string;icon?:string;hidden?:boolean}>;plugins:Record<string,{enabled?:boolean;adminPages?:{path:string;label?:string;icon?:string}[]}>};
export interface NavItem{id:string;title:string;to:string;params?:Record<string,string>;icon:NavIcon;minRole?:number;keywords?:string[]}
export function visibleCollectionEntries<T extends { hidden?: boolean }>(
	collections: Record<string, T>,
): Array<[string, T]> {
	return Object.entries(collections).filter(([, config]) => !config.hidden);
}


export function resolvePluginPageLabel(
	label: string | undefined,
	pluginId: string,
	translate: (id: string) => string,
): string {
	if (label) return translate(label);
	return pluginId
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}


export function normalizePluginPagePath(path: string): string {
	return path.startsWith("/") ? path : `/${path}`;
}


export function isSafePluginPagePath(path: string): boolean {
	if (path.length === 0) return false;
	const normalized = normalizePluginPagePath(path);
	return (
		(normalized === "/" || PLUGIN_PAGE_PATH_PATTERN.test(normalized)) &&
		!normalized.split("/").some((segment) => segment === "." || segment === "..")
	);
}


export function buildNavItems(
	manifest: CommandPaletteManifest,
	userRole: number,
	translateLabel: (id: string) => string,
): NavItem[] {
	const items: NavItem[] = [
		{
			id: "dashboard",
			title: msg`Dashboard`,
			to: "/",
			icon: ADMIN_NAV_ICONS.dashboard,
			keywords: ["home", "overview"],
		},
		{
			id: "calendar",
			title: msg`Calendar`,
			to: "/calendar",
			icon: ADMIN_NAV_ICONS.calendar,
			minRole: ROLE_CONTRIBUTOR,
			keywords: ["schedule", "scheduled", "publishing", "agenda"],
		},
	];

	// Add collection links
	for (const [name, config] of visibleCollectionEntries(manifest.collections)) {
		items.push({
			id: `collection-${name}`,
			title: config.label,
			to: "/content/$collection",
			params: { collection: name },
			icon: getCollectionNavIcon(name, config.icon),
			keywords: ["content", name],
		});
	}

	// Add core admin links
	items.push(
		{
			id: "media",
			title: msg`Media Library`,
			to: "/media",
			icon: ADMIN_NAV_ICONS.media,
			keywords: ["images", "files", "uploads"],
		},
		{
			id: "menus",
			title: msg`Menus`,
			to: "/menus",
			icon: ADMIN_NAV_ICONS.menus,
			minRole: ROLE_EDITOR,
			keywords: ["navigation"],
		},
		{
			id: "widgets",
			title: msg`Widgets`,
			to: "/widgets",
			icon: ADMIN_NAV_ICONS.widgets,
			minRole: ROLE_EDITOR,
			keywords: ["sidebar", "footer"],
		},
		{
			id: "sections",
			title: msg`Sections`,
			to: "/sections",
			icon: ADMIN_NAV_ICONS.sections,
			minRole: ROLE_EDITOR,
			keywords: ["page builder", "blocks"],
		},
		{
			id: "content-types",
			title: msg`Content Types`,
			to: "/content-types",
			icon: ADMIN_NAV_ICONS.contentTypes,
			minRole: ROLE_ADMIN,
			keywords: ["schema", "collections"],
		},
		{
			id: "categories",
			title: msg`Categories`,
			to: "/taxonomies/$taxonomy",
			params: { taxonomy: "category" },
			icon: getTaxonomyNavIcon("category"),
			minRole: ROLE_EDITOR,
			keywords: ["taxonomy"],
		},
		{
			id: "tags",
			title: msg`Tags`,
			to: "/taxonomies/$taxonomy",
			params: { taxonomy: "tag" },
			icon: getTaxonomyNavIcon("tag"),
			minRole: ROLE_EDITOR,
			keywords: ["taxonomy"],
		},
		{
			id: "users",
			title: msg`Users`,
			to: "/users",
			icon: Users,
			minRole: ROLE_ADMIN,
			keywords: ["accounts", "team"],
		},
		{
			id: "plugins",
			title: msg`Plugins`,
			to: "/plugins-manager",
			icon: ADMIN_NAV_ICONS.plugins,
			minRole: ROLE_ADMIN,
			keywords: ["extensions", "add-ons"],
		},
		{
			id: "import",
			title: msg`Import`,
			to: "/import/wordpress",
			icon: ADMIN_NAV_ICONS.import,
			minRole: ROLE_ADMIN,
			keywords: ["wordpress", "migrate"],
		},
		{
			id: "settings",
			title: msg`Settings`,
			to: "/settings",
			icon: Gear,
			minRole: ROLE_ADMIN,
			keywords: ["configuration", "preferences"],
		},
		{
			id: "transfer",
			title: msg`Site Transfer`,
			to: "/settings/transfer",
			icon: ArrowsLeftRight,
			minRole: ROLE_ADMIN,
			keywords: ["export", "import", "migrate", "move", "package"],
		},
		{
			id: "security",
			title: msg`Security Settings`,
			to: "/settings/security",
			icon: Gear,
			minRole: ROLE_ADMIN,
			keywords: ["passkeys", "authentication"],
		},
	);

	// Add plugin pages
	for (const [pluginId, config] of Object.entries(manifest.plugins)) {
		if (config.enabled === false) continue;
		if (config.adminPages && config.adminPages.length > 0) {
			for (const page of config.adminPages) {
				if (!isSafePluginPagePath(page.path)) continue;
				// Same treatment as the sidebar: declared labels go through the
				// shared i18n instance so plugin catalogs can localize them.
				const label = resolvePluginPageLabel(page.label, pluginId, translateLabel);

				items.push({
					id: `plugin-${pluginId}-${page.path}`,
					title: label,
					to: `/plugins/${pluginId}${normalizePluginPagePath(page.path)}`,
					icon: resolveNavIcon(page.icon),
					keywords: ["plugin", pluginId],
				});
			}
		}
	}

	// Filter by role
	return items.filter((item) => !item.minRole || userRole >= item.minRole);
}

export function filterNavItems(
	items: NavItem[],
	query: string,
	translate: (d: MessageDescriptor) => string,
): NavItem[] {
	if (!query) return items;
	const lowerQuery = query.toLowerCase();
	return items.filter((item) => {
		const titleStr = typeof item.title === "string" ? item.title : translate(item.title);
		const titleMatch = titleStr.toLowerCase().includes(lowerQuery);
		const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(lowerQuery));
		return titleMatch || keywordMatch;
	});
}
