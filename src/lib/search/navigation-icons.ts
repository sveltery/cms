// Native icon identities preserve pinned navigation selection; Svelte owns rendering.
export type NavIcon=string;
export const Bell="Bell";
export const BookOpen="BookOpen";
export const Browser="Browser";
export const CalendarBlank="CalendarBlank";
export const CardsThree="CardsThree";
export const Chats="Chats";
export const ChartBar="ChartBar";
export const ChartLine="ChartLine";
export const ClockCounterClockwise="ClockCounterClockwise";
export const Code="Code";
export const Crop="Crop";
export const Database="Database";
export const Download="Download";
export const FileText="FileText";
export const Files="Files";
export const Folder="Folder";
export const Folders="Folders";
export const Gear="Gear";
export const GridFour="GridFour";
export const IdentificationCard="IdentificationCard";
export const Image="Image";
export const ImagesSquare="ImagesSquare";
export const LinkSimple="LinkSimple";
export const List="List";
export const MagnifyingGlass="MagnifyingGlass";
export const Medal="Medal";
export const Newspaper="Newspaper";
export const Palette="Palette";
export const Path="Path";
export const Plug="Plug";
export const PuzzlePiece="PuzzlePiece";
export const Rows="Rows";
export const Signature="Signature";
export const SquaresFour="SquaresFour";
export const Star="Star";
export const Tag="Tag";
export const Trophy="Trophy";
export const Upload="Upload";
export const Users="Users";
export const ArrowsLeftRight="ArrowsLeftRight";
/** Shared icon vocabulary for first-party admin entities and navigation surfaces. */
export const ADMIN_NAV_ICONS = {
	dashboard: SquaresFour,
	calendar: CalendarBlank,
	collection: Files,
	pages: Browser,
	posts: Newspaper,
	media: ImagesSquare,
	comments: Chats,
	menus: Rows,
	redirects: Path,
	widgets: PuzzlePiece,
	sections: CardsThree,
	taxonomy: Folders,
	tags: Tag,
	bylines: Signature,
	bylineSchema: IdentificationCard,
	contentTypes: Database,
	plugins: Plug,
	import: Download,
	folder: Folder,
} as const satisfies Record<string, NavIcon>;

const COLLECTION_NAV_ICON_OVERRIDES: Record<string, NavIcon> = {
	pages: ADMIN_NAV_ICONS.pages,
	posts: ADMIN_NAV_ICONS.posts,
};

/**
 * A collection's declared icon wins; built-in collections have distinct
 * defaults and custom collections share the generic one. An icon name that
 * does not resolve falls back to that default.
 */
export function getCollectionNavIcon(name: string, iconName?: string): NavIcon {
	const fallback = Object.hasOwn(COLLECTION_NAV_ICON_OVERRIDES, name)
		? COLLECTION_NAV_ICON_OVERRIDES[name]!
		: ADMIN_NAV_ICONS.collection;
	return iconName ? resolveNavIcon(iconName, fallback) : fallback;
}

/** Tags have a distinct meaning; other taxonomies are collections of terms. */
export function getTaxonomyNavIcon(name: string): NavIcon {
	return name === "tag" ? ADMIN_NAV_ICONS.tags : ADMIN_NAV_ICONS.taxonomy;
}

/** Common plugin-declared icon names that should resolve without loading another chunk. */
const PLUGIN_NAV_ICON_MAP: Record<string, NavIcon> = {
	settings: Gear,
	gear: Gear,
	chart: ChartBar,
	"chart-line": ChartLine,
	dashboard: ADMIN_NAV_ICONS.dashboard,
	history: ClockCounterClockwise,
	image: Image,
	award: Medal,
	trophy: Trophy,
	grid: GridFour,
	crop: Crop,
	book: BookOpen,
	plug: Plug,
	code: Code,
	file: FileText,
	document: FileText,
	users: Users,
	database: Database,
	list: List,
	calendar: CalendarBlank,
	bell: Bell,
	folder: Folder,
	star: Star,
	tag: Tag,
	link: LinkSimple,
	search: MagnifyingGlass,
	palette: Palette,
	upload: Upload,
};

const ICON_NAME_SEPARATOR = /[-_\s]+/;

/** Convert kebab, snake, or space-separated names to Phosphor's PascalCase exports. */
export function toPhosphorIconName(name: string): string {
	return name
		.split(ICON_NAME_SEPARATOR)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}


export function resolveNavIcon(name?:string,fallback:NavIcon=ADMIN_NAV_ICONS.plugins):NavIcon{if(!name)return fallback;if(Object.hasOwn(PLUGIN_NAV_ICON_MAP,name))return PLUGIN_NAV_ICON_MAP[name]!;return toPhosphorIconName(name);}
