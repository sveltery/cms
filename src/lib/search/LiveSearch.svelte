<script lang="ts">
 // EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e LiveSearch.astro.
 // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
 // Native SSR/prop/snippet hosting; the complete Source browser controller is shared unchanged.
 import { onMount, type Snippet } from 'svelte';
 import { resolveSearchLocale } from './search-locale.ts';
 import './live-search.css';
 interface Props {
  placeholder?: string; collections?: string[]; locale?: string|null;
  /** Trusted page locale replaces Astro.currentLocale. */
  currentLocale?: string|null;
  minChars?: number; debounce?: number; limit?: number;
  class?: string; style?: string; inputClass?: string; resultsClass?: string; resultClass?: string;
  showSnippets?: boolean; autofocus?: boolean; suggestMode?: boolean;
  expandOnFocus?: {collapsed:string;expanded:string}; searchPage?:string;
  routeMap?: Record<string,string>; loading?:Snippet; noResults?:Snippet; result?:Snippet;
 }
 let { placeholder='Search...',collections,locale,currentLocale,minChars=2,debounce=300,limit=10,
  class:className='',style:styleAttr='',inputClass='',resultsClass='',resultClass='',
  showSnippets=true,autofocus=false,suggestMode=false,expandOnFocus,searchPage='',routeMap={},
  loading,noResults,result }:Props=$props();
 const config=$derived({collections:collections?.join(',')??'',
  locale:resolveSearchLocale(locale,currentLocale),minChars,debounce,limit,showSnippets,
  suggestMode,expandOnFocus:expandOnFocus??null,searchPage,routeMap});
 onMount(()=>{void import('./live-search-element.ts');});
</script>

<emdash-live-search class={['emdash-live-search',className].filter(Boolean).join(' ')} style={styleAttr} data-config={JSON.stringify(config)}>
 <!-- svelte-ignore a11y_autofocus -->
 <input type="search" {placeholder} class={['emdash-live-search-input',inputClass].filter(Boolean).join(' ')} autocomplete="off" {autofocus}/>
 <div class={['emdash-live-search-results',resultsClass].filter(Boolean).join(' ')} hidden>
  {#if loading}{@render loading()}{:else}<div class="emdash-live-search-loading">Searching...</div>{/if}
  {#if noResults}{@render noResults()}{:else}<div class="emdash-live-search-no-results">No results found</div>{/if}
  <template class="emdash-live-search-result-template">
   {#if result}{@render result()}{:else}
    <!-- Source controller supplies each cloned link's text and URL before display. -->
    <!-- svelte-ignore a11y_consider_explicit_label a11y_invalid_attribute -->
    <a class={['emdash-live-search-result',resultClass].filter(Boolean).join(' ')} href="">
     <span class="emdash-live-search-result-title"></span>
     <span class="emdash-live-search-result-collection"></span>
     <span class="emdash-live-search-result-snippet"></span>
    </a>
   {/if}
  </template>
  <div class="emdash-live-search-results-list"></div>
 </div>
</emdash-live-search>
