// Complete pinned WebMcpSearch.astro client; native module specifier only.
// MIT Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.

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
