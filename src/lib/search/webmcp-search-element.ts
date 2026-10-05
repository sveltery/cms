// Whole client script from EmDash pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/components/WebMcpSearch.astro
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt. Import/module extraction only.
import {
	registerSiteSearchTool,
	resolveModelContext,
	type SiteSearchToolConfig,
	type WithModelContext,
} from "./webmcp-search.ts";

class EmDashWebMcpSearch extends HTMLElement {
	private controller: AbortController | null = null;

	connectedCallback() {
		const modelContext = resolveModelContext(
			document as WithModelContext,
			navigator as WithModelContext,
		);
		if (!modelContext) return;

		const config = JSON.parse(this.dataset.config ?? "{}") as SiteSearchToolConfig;
		this.controller = new AbortController();
		registerSiteSearchTool(modelContext, config, location.origin, this.controller.signal);
	}

	disconnectedCallback() {
		this.controller?.abort();
		this.controller = null;
	}
}

if (!customElements.get("emdash-webmcp-search")) {
	customElements.define("emdash-webmcp-search", EmDashWebMcpSearch);
}
