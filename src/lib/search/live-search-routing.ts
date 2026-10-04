// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/components/live-search-routing.ts
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt. Import hosting only.
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
