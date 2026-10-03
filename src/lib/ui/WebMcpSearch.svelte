<script lang="ts">
 import {onMount} from 'svelte';
 let {collections,locale,currentLocale,limit=10,routeMap={}}:{collections?:string[];locale?:string|null;currentLocale?:string;limit?:number;routeMap?:Record<string,string>}=$props();
 const config=$derived({collections:collections?.join(',')??'',locale:(locale===undefined?currentLocale:locale)??'',limit,routeMap});
 onMount(()=>{void import('$lib/search/webmcp-client.ts');});
</script>
<emdash-webmcp-search data-config={JSON.stringify(config)} hidden></emdash-webmcp-search>
