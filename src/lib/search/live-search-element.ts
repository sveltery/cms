// Whole client script from EmDash pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/components/LiveSearch.astro
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt. Import/module extraction only.
import {
	buildLiveSearchResultUrl,
	type LiveSearchRouteMap,
	type LiveSearchRoutableResult,
} from "./live-search-routing.ts";

interface SearchResult {
	collection: string;
	id: string;
	slug: string | null;
	title?: string;
	snippet?: string;
	score: number;
}

interface Suggestion {
	collection: string;
	id: string;
	slug?: string | null;
	title: string;
}

interface Config {
	collections: string;
	locale: string;
	minChars: number;
	debounce: number;
	limit: number;
	showSnippets: boolean;
	suggestMode: boolean;
	expandOnFocus: { collapsed: string; expanded: string } | null;
	searchPage: string;
	routeMap: LiveSearchRouteMap;
}

class EmDashLiveSearch extends HTMLElement {
	private input: HTMLInputElement | null = null;
	private resultsContainer: HTMLElement | null = null;
	private resultsList: HTMLElement | null = null;
	private loadingEl: HTMLElement | null = null;
	private noResultsEl: HTMLElement | null = null;
	private template: HTMLTemplateElement | null = null;
	private config: Config = {
		collections: "",
		locale: "",
		minChars: 2,
		debounce: 300,
		limit: 10,
		showSnippets: true,
		suggestMode: false,
		expandOnFocus: null,
		searchPage: "",
		routeMap: {},
	};
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private abortController: AbortController | null = null;

	connectedCallback() {
		// Parse config
		const configStr = this.dataset.config;
		if (configStr) {
			try {
				this.config = { ...this.config, ...JSON.parse(configStr) };
			} catch {
				// Use defaults
			}
		}

		// Get elements
		this.input = this.querySelector(".emdash-live-search-input");
		this.resultsContainer = this.querySelector(
			".emdash-live-search-results"
		);
		this.resultsList = this.querySelector(
			".emdash-live-search-results-list"
		);
		this.loadingEl = this.querySelector(".emdash-live-search-loading");
		this.noResultsEl = this.querySelector(".emdash-live-search-no-results");
		this.template = this.querySelector(
			".emdash-live-search-result-template"
		);

		if (!this.input) return;

		// Event listeners
		this.input.addEventListener("input", this.handleInput.bind(this));
		this.input.addEventListener("keydown", this.handleKeydown.bind(this));

		// Close on click outside
		document.addEventListener("click", (e) => {
			if (!this.contains(e.target as Node)) {
				this.hideResults();
			}
		});

		// Show results on focus if we have a query
		this.input.addEventListener("focus", () => {
			if (this.input && this.input.value.length >= this.config.minChars) {
				this.showResults();
			}
			// Handle expand on focus
			if (this.config.expandOnFocus && this.input) {
				this.input.style.width = this.config.expandOnFocus.expanded;
			}
		});

		// Handle collapse on blur
		this.input.addEventListener("blur", () => {
			// Delay to allow clicking on results
			setTimeout(() => {
				if (
					this.config.expandOnFocus &&
					this.input &&
					document.activeElement !== this.input
				) {
					// Only collapse if not focused on a result
					const activeInResults = this.resultsContainer?.contains(
						document.activeElement
					);
					if (!activeInResults) {
						this.input.style.width = this.config.expandOnFocus.collapsed;
					}
				}
			}, 150);
		});

		// Set initial width if expandOnFocus is enabled
		if (this.config.expandOnFocus) {
			this.input.style.width = this.config.expandOnFocus.collapsed;
			// Apply transition after initial width is set so the collapsed
			// width doesn't animate in on page load
			requestAnimationFrame(() => {
				if (this.input) {
					this.input.style.transition = "width 0.2s ease";
				}
			});
		}
	}

	private handleInput() {
		if (!this.input) return;

		const query = this.input.value.trim();

		// Clear any pending request
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		if (query.length < this.config.minChars) {
			this.hideResults();
			return;
		}

		// Debounce the search
		this.debounceTimer = setTimeout(() => {
			this.search(query);
		}, this.config.debounce);
	}

	private handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			this.hideResults();
			this.input?.blur();
		} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			this.navigateResults(e.key === "ArrowDown" ? 1 : -1);
		} else if (e.key === "Enter") {
			const focused = this.resultsList?.querySelector(
				".emdash-live-search-result:focus, .emdash-live-search-result.focused"
			) as HTMLAnchorElement | null;
			if (focused?.href) {
				e.preventDefault();
				window.location.href = focused.href;
				return;
			}

			const query = this.input?.value.trim();
			if (query && this.config.searchPage) {
				e.preventDefault();
				const url = new URL(this.config.searchPage, window.location.origin);
				url.searchParams.set("q", query);
				window.location.href = url.toString();
			}
		}
	}

	private buildResultUrl(result: LiveSearchRoutableResult): string {
		return buildLiveSearchResultUrl(result, this.config.routeMap);
	}

	private navigateResults(direction: number) {
		if (!this.resultsList) return;

		const results = [
			...this.resultsList.querySelectorAll(".emdash-live-search-result"),
		] as HTMLElement[];
		if (results.length === 0) return;

		const currentIndex = results.findIndex(
			(r) => r === document.activeElement || r.classList.contains("focused")
		);

		// Remove current focus
		results.forEach((r) => r.classList.remove("focused"));

		let nextIndex: number;
		if (currentIndex === -1) {
			nextIndex = direction > 0 ? 0 : results.length - 1;
		} else {
			nextIndex = currentIndex + direction;
			if (nextIndex < 0) nextIndex = results.length - 1;
			if (nextIndex >= results.length) nextIndex = 0;
		}

		const nextResult = results[nextIndex];
		if (nextResult) {
			nextResult.classList.add("focused");
			nextResult.focus();
		}
	}

	private async search(query: string) {
		// Cancel any in-flight request
		if (this.abortController) {
			this.abortController.abort();
		}
		this.abortController = new AbortController();

		this.showLoading();

		try {
			const endpoint = this.config.suggestMode
				? "/_emdash/api/search/suggest"
				: "/_emdash/api/search";

			const params = new URLSearchParams({
				q: query,
				limit: String(this.config.limit),
			});

			if (this.config.collections) {
				params.set("collections", this.config.collections);
			}

			if (this.config.locale) {
				params.set("locale", this.config.locale);
			}

			const response = await fetch(`${endpoint}?${params}`, {
				signal: this.abortController.signal,
			});

			if (!response.ok) {
				throw new Error("Search failed");
			}

			const responseData = await response.json();
			// Handle API response envelope: { data: { items: [...] } }
			const data = responseData.data || responseData;

			if (this.config.suggestMode) {
				this.renderSuggestions(data.items || data.suggestions || []);
			} else {
				this.renderResults(data.items || data.results || []);
			}
		} catch (error) {
			if ((error as Error).name === "AbortError") {
				// Request was cancelled, ignore
				return;
			}
			console.error("Search error:", error);
			this.showNoResults();
		}
	}

	private renderResults(results: SearchResult[]) {
		if (!this.resultsList || !this.template) return;

		this.resultsList.innerHTML = "";

		if (results.length === 0) {
			this.showNoResults();
			return;
		}

		for (const result of results) {
			const clone = this.template.content.cloneNode(true) as DocumentFragment;
			const link = clone.querySelector("a");

			if (link) {
				link.href = this.buildResultUrl(result);

				// Fill in title
				const titleEl = link.querySelector(
					".emdash-live-search-result-title"
				);
				if (titleEl) {
					titleEl.textContent = result.title ?? result.slug ?? result.id;
				}

				// Fill in collection
				const collectionEl = link.querySelector(
					".emdash-live-search-result-collection"
				);
				if (collectionEl) {
					collectionEl.textContent = result.collection;
				}

				// Snippets returned by /api/search are already sanitised
				// server-side by sanitizeSnippet() — they contain only
				// HTML-escaped text plus literal <mark>...</mark> tags
				// around matched terms.
				const snippetEl = link.querySelector(
					".emdash-live-search-result-snippet"
				);
				if (snippetEl && this.config.showSnippets && result.snippet) {
					snippetEl.innerHTML = result.snippet;
				} else if (snippetEl) {
					snippetEl.remove();
				}

				// Store data on element for custom handling
				link.dataset.id = result.id;
				link.dataset.collection = result.collection;
				link.dataset.slug = result.slug ?? "";
				link.dataset.score = String(result.score);
			}

			this.resultsList.appendChild(clone);
		}

		this.showResultsList();
	}

	private renderSuggestions(suggestions: Suggestion[]) {
		if (!this.resultsList || !this.template) return;

		this.resultsList.innerHTML = "";

		if (suggestions.length === 0) {
			this.showNoResults();
			return;
		}

		for (const suggestion of suggestions) {
			const clone = this.template.content.cloneNode(true) as DocumentFragment;
			const link = clone.querySelector("a");

			if (link) {
				link.href = this.buildResultUrl(suggestion);

				const titleEl = link.querySelector(
					".emdash-live-search-result-title"
				);
				if (titleEl) {
					titleEl.textContent = suggestion.title;
				}

				const collectionEl = link.querySelector(
					".emdash-live-search-result-collection"
				);
				if (collectionEl) {
					collectionEl.textContent = suggestion.collection;
				}

				// Remove snippet for suggestions
				const snippetEl = link.querySelector(
					".emdash-live-search-result-snippet"
				);
				if (snippetEl) {
					snippetEl.remove();
				}

				link.dataset.id = suggestion.id;
				link.dataset.collection = suggestion.collection;
				link.dataset.slug = suggestion.slug ?? "";
			}

			this.resultsList.appendChild(clone);
		}

		this.showResultsList();
	}

	private showResults() {
		if (this.resultsContainer) {
			this.resultsContainer.hidden = false;
		}
	}

	private hideResults() {
		if (this.resultsContainer) {
			this.resultsContainer.hidden = true;
		}
	}

	private showLoading() {
		this.showResults();
		if (this.loadingEl) this.loadingEl.hidden = false;
		if (this.noResultsEl) this.noResultsEl.hidden = true;
		if (this.resultsList) this.resultsList.hidden = true;
	}

	private showNoResults() {
		this.showResults();
		if (this.loadingEl) this.loadingEl.hidden = true;
		if (this.noResultsEl) this.noResultsEl.hidden = false;
		if (this.resultsList) this.resultsList.hidden = true;
	}

	private showResultsList() {
		this.showResults();
		if (this.loadingEl) this.loadingEl.hidden = true;
		if (this.noResultsEl) this.noResultsEl.hidden = true;
		if (this.resultsList) this.resultsList.hidden = false;
	}
}

customElements.define("emdash-live-search", EmDashLiveSearch);
