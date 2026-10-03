<script lang="ts">
 import {resolve} from '$app/paths';
 import {onMount} from 'svelte';
 import {getDashboardStats} from '$lib/dashboard.remote';
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 const result=await getDashboardStats().then(data=>({data,unavailable:false}),()=>({data:null,unavailable:true}));
 let hydrated=$state(false);onMount(()=>{hydrated=true;});
</script>
<svelte:head><title>Dashboard · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')} activePage="dashboard">
 <div data-native-dashboard={hydrated?'true':'false'}>
  <h1>Dashboard</h1>
  {#if result.unavailable}<p role="status">Sign in to view your dashboard.</p>
  {:else if result.data}
   <section aria-label="Collections"><h2>Collections</h2>
    {#if result.data.collections.length===0}<p>No collections yet.</p>{:else}
    <ul>{#each result.data.collections as collection (collection.slug)}<li><a href={resolve('/content/[collection]',{collection:collection.slug})}>{collection.label}</a>: {collection.total} entries, {collection.published} published, {collection.draft} drafts{#if collection.scheduled}, {collection.scheduled} scheduled{/if}</li>{/each}</ul>{/if}
   </section>
   <section aria-label="Workspace totals"><h2>Workspace</h2><p>{result.data.userCount} users</p></section>
   <section aria-label="Recent content"><h2>Recent content</h2>
    {#if result.data.recentItems.length===0}<p>No content yet.</p>{:else}<ul>{#each result.data.recentItems as item (item.collection+':'+item.id)}<li><a href={resolve('/content/[collection]/[id]',{collection:item.collection,id:item.id})}>{item.title}</a> · {item.collectionLabel} · {item.status}</li>{/each}</ul>{/if}
   </section>
  {/if}
 </div>
</WorkspaceShell>
<style>h1{font-size:2.25rem;}section{margin-block:2rem;}li{margin-block:.75rem;}</style>
