<script lang="ts">
 import {onMount,type Snippet} from 'svelte';
 let {placeholder='Search...',collections,locale,currentLocale,minChars=2,debounce=300,limit=10,class:className='',style:styleAttr='',inputClass='',resultsClass='',resultClass='',showSnippets=true,autofocus=false,suggestMode=false,expandOnFocus,searchPage='',routeMap={},loading,noResults,result}: {
  placeholder?:string;collections?:string[];locale?:string|null;currentLocale?:string;minChars?:number;debounce?:number;limit?:number;class?:string;style?:string;inputClass?:string;resultsClass?:string;resultClass?:string;showSnippets?:boolean;autofocus?:boolean;suggestMode?:boolean;expandOnFocus?:{collapsed:string;expanded:string};searchPage?:string;routeMap?:Record<string,string>;loading?:Snippet;noResults?:Snippet;result?:Snippet;
 }=$props();
 const config=$derived({collections:collections?.join(',')??'',locale:(locale===undefined?currentLocale:locale)??'',minChars,debounce,limit,showSnippets,suggestMode,expandOnFocus:expandOnFocus??null,searchPage,routeMap});
 onMount(()=>{void import('$lib/search/live-search-client.ts');});
</script>
<emdash-live-search class={`emdash-live-search ${className}`} style={styleAttr} data-config={JSON.stringify(config)}>
 <!-- svelte-ignore a11y_autofocus (the source component exposes an explicit autofocus prop) -->
 <input type="search" {placeholder} class={`emdash-live-search-input ${inputClass}`} autocomplete="off" {autofocus} aria-label={placeholder}/>
 <div class={`emdash-live-search-results ${resultsClass}`} hidden>
  {#if loading}{@render loading()}{:else}<div class="emdash-live-search-loading">Searching...</div>{/if}
  {#if noResults}{@render noResults()}{:else}<div class="emdash-live-search-no-results">No results found</div>{/if}
  <template class="emdash-live-search-result-template">
   {#if result}{@render result()}{:else}
    <!-- svelte-ignore a11y_consider_explicit_label (the source client fills the visible title before inserting this inert template) -->
    <a class={`emdash-live-search-result ${resultClass}`} href="/">
     <span class="emdash-live-search-result-title"></span>
     <span class="emdash-live-search-result-collection"></span>
     <span class="emdash-live-search-result-snippet"></span>
    </a>
   {/if}
  </template>
  <div class="emdash-live-search-results-list"></div>
 </div>
</emdash-live-search>
<style>

	/*
	 * LiveSearch uses CSS custom properties for theming.
	 * Override these in your site's CSS to match your design:
	 *
	 * --emdash-search-bg: Background color for the results dropdown
	 * --emdash-search-text: Text color
	 * --emdash-search-muted: Muted/secondary text color
	 * --emdash-search-border: Border color
	 * --emdash-search-hover: Hover/focus background color
	 * --emdash-search-highlight: Highlighted match text color
	 */

	.emdash-live-search {
		position: relative;
		display: inline-block;
	}

	.emdash-live-search-input {
		width: 100%;
		padding: 0.5rem 1rem;
		font-size: 1rem;
		border: 1px solid var(--emdash-search-border, #ccc);
		border-radius: 0.25rem;
		background: var(--emdash-search-bg, white);
		color: var(--emdash-search-text, inherit);
	}

	.emdash-live-search-input:focus {
		outline: none;
		border-color: var(--emdash-search-border-focus, #666);
	}

	.emdash-live-search-results {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.25rem;
		background: var(--emdash-search-bg, white);
		border: 1px solid var(--emdash-search-border, #ccc);
		border-radius: 0.25rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		max-height: 400px;
		overflow-y: auto;
		z-index: 1000;
	}

	.emdash-live-search-loading,
	.emdash-live-search-no-results {
		padding: 1rem;
		text-align: center;
		color: var(--emdash-search-muted, #666);
	}

	.emdash-live-search-result {
		display: block;
		padding: 0.75rem 1rem;
		text-decoration: none;
		color: var(--emdash-search-text, inherit);
		border-bottom: 1px solid var(--emdash-search-border, #eee);
	}

	.emdash-live-search-result:last-child {
		border-bottom: none;
	}

	.emdash-live-search-result:hover,
	.emdash-live-search-result:focus,
	.emdash-live-search-result.focused {
		background: var(--emdash-search-hover, #f5f5f5);
		outline: none;
	}

	.emdash-live-search-result-title {
		display: block;
		font-weight: 500;
	}

	.emdash-live-search-result-collection {
		display: block;
		font-size: 0.75rem;
		color: var(--emdash-search-muted, #888);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 0.125rem;
	}

	.emdash-live-search-result-snippet {
		display: block;
		font-size: 0.875rem;
		color: var(--emdash-search-muted, #666);
		margin-top: 0.25rem;
	}

	/* Highlight matches in snippets (FTS5 uses <mark> tags) */
	.emdash-live-search-result-snippet :global(mark) {
		font-weight: 600;
		background: none;
		color: var(--emdash-search-highlight, var(--emdash-search-text, #000));
	}

</style>
