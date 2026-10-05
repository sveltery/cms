<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { QueryClient } from '@tanstack/react-query';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import Calendar from '$lib/calendar/CalendarPage.svelte';
  import { parseCalendarSearch,type CalendarSearch } from '$lib/calendar/calendar.ts';
  import * as client from '$lib/calendar/client.ts';
  import type { PageData } from './$types';
  let { data }:{data:PageData}=$props();
  // Each actual page owns its query client. SSR/request instances never share it.
  const queryClient=new QueryClient();
  const search=$derived(parseCalendarSearch(Object.fromEntries(page.url.searchParams)));
  function updateSearch(patch:Partial<CalendarSearch>,push=false){
    const url=new URL(page.url);for(const [key,value]of Object.entries(patch)){if(value===undefined)url.searchParams.delete(key);else url.searchParams.set(key,value);}
    void goto(url,{replaceState:!push,keepFocus:true,noScroll:true});
  }
</script>
<svelte:head><title>Calendar · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={`${base}/`}>
  {#if data.available}<Calendar manifest={data.manifest} user={data.user} {client} {queryClient} {search} {updateSearch} back={()=>history.back()}/>
  {:else}<h1>Calendar</h1><p role="status">{data.error}</p>{/if}
</WorkspaceShell>
