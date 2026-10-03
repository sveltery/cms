<script lang="ts">
 import WebMcpSearch from '$lib/ui/WebMcpSearch.svelte';
 import LiveSearch from '$lib/ui/LiveSearch.svelte';
</script>
<svelte:head><title>Search · Sveltery CMS</title><meta name="description" content="Search published content"/></svelte:head>
<main><h1>Search</h1><LiveSearch placeholder="Search published content..." limit={20}/><WebMcpSearch/></main>
<style>main{max-width:800px;margin:64px auto;padding:24px;font-family:system-ui,sans-serif;}h1{font-size:32px;}</style>
