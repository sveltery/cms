<script lang="ts">
 // EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e WebMcpSearch.astro.
 // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
 // Native SSR/props hosting; the complete Source browser controller is shared unchanged.
 import {onMount} from 'svelte';
 interface Props {collections?:string[];locale?:string|null;currentLocale?:string|null;
  limit?:number;routeMap?:Record<string,string>}
 let {collections,locale,currentLocale,limit=10,routeMap={}}:Props=$props();
 const config=$derived({collections:collections?.join(',')??'',
  locale:(locale===undefined?currentLocale:locale)??'',limit,routeMap});
 onMount(()=>{void import('./webmcp-search-element.ts');});
</script>
<emdash-webmcp-search data-config={JSON.stringify(config)} hidden></emdash-webmcp-search>
