<script lang="ts">
  import { onMount } from 'svelte';
  import {observeCalendarMetadata} from '$lib/calendar/metadata-owner.ts';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { i18n } from '@lingui/core';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { createCalendarQueryClient } from '$lib/calendar/query-client.ts';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import Calendar from '$lib/calendar/CalendarPage.svelte';
  import { parseCalendarSearch,type CalendarSearch } from '$lib/calendar/calendar.ts';
  import * as client from '$lib/calendar/client.ts';
  import type { PageData } from './$types';
  let { data }:{data:PageData}=$props();
  // Each actual page owns its query client. SSR/request instances never share it.
  const queryClient=createCalendarQueryClient();
  let manifest=$state(data.manifest),user=$state(data.user);
  onMount(()=>{if(!data.available)return;const owner=observeCalendarMetadata(queryClient,client,{manifest,user},value=>{manifest=value.manifest;user=value.user;});return()=>owner.destroy();});
  // Original admin bootstrap owns browser locale before any client request.
  // Existing i18n is reused; no locale is changed on an SSR request.
  if(browser&&!i18n.locale)i18n.loadAndActivate({locale:'en',messages:{}});
  const search=$derived(parseCalendarSearch(Object.fromEntries(page.url.searchParams)));
  function updateSearch(patch:Partial<CalendarSearch>,push=false){
    const url=new URL(page.url);for(const [key,value]of Object.entries(patch)){if(value===undefined)url.searchParams.delete(key);else url.searchParams.set(key,value);}
    void goto(url,{replaceState:!push,keepFocus:true,noScroll:true});
  }
</script>
<svelte:head><title>Calendar · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={`${base}/`}>
  {#if data.available}<Calendar manifest={manifest} user={user} locale={i18n.locale||'en'} {client} {queryClient} {search} {updateSearch} back={()=>history.back()}/>
  {:else}<h1>Calendar</h1><p role="status">{data.error}</p>{/if}
</WorkspaceShell>
