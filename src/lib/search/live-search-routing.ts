// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; blob 352cbcc9758b72dd6197e291c11bc2067ae979f0. MIT Copyright2026 Cloudflare Inc.
// notices/emdash-MIT.txt; module specifier only.
export interface LiveSearchRoutableResult {
	collection: string;
	id: string;
	slug?: string | null;
}

export type LiveSearchRouteMap = Record<string, string>;

function replaceRouteToken(template: string, token: string, value: string): string {
	return template.split(token).join(value);
}

export function buildLiveSearchResultUrl(
	result: LiveSearchRoutableResult,
	routeMap: LiveSearchRouteMap = {},
): string {
	const path = result.slug ?? result.id;
	const template = routeMap[result.collection];

	if (!template) {
		return `/${result.collection}/${path}`;
	}

	return [
		[":collection", result.collection],
		[":id", result.id],
		[":slug", result.slug ?? result.id],
		[":path", path],
	].reduce((url, [token, value]) => replaceRouteToken(url, token, value), template);
}
