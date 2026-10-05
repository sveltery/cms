<script lang="ts">
  // EmDash1.1.0 Calendar page behavior, pin913cb1bb; MIT notices/emdash-MIT.txt.
  // Framework host supplies one real QueryClient and URL/history operations.
  import { onDestroy,onMount,untrack } from 'svelte';
  import {calendarInitialLoading,calendarTabTarget,calendarTabFocus} from './presentation.ts';
  import {createCalendarRangeOwner} from './range-owner.ts';
  import { QueryObserver,type QueryClient } from '@tanstack/react-query';
  import { calendarQueryOptions,CALENDAR_MAX_ENTRIES,type CalendarRange } from './api.ts';
  import { ApiResponseError } from '../sections-widgets/client.ts';
  import { createCalendarDisplay,dayKeyInZone,dayKeyToUTC,fetchRange,filterItems,groupByDay,isCalendarState,isMonthKey,monthGridDays,readList,shiftMonth,toCalendarItems,toListParam,type CalendarSearch,type CalendarFilterValues,type CalendarItem } from './calendar.ts';
  import { getDayPickerLocale } from '../ui/date-time-locales.ts';
  import Agenda from './CalendarAgenda.svelte';
  import Month from './CalendarMonth.svelte';
  import Filters from './CalendarFilters.svelte';
  import Panel from './CalendarEntryPanel.svelte';
  import Toolbar from './CalendarToolbar.svelte';
  import type { CalendarClient,CalendarManifest,CalendarUser,CalendarNotice } from './ui-types.ts';
  let { manifest,user,client,queryClient,locale='en',search={},updateSearch,back }: {
    manifest?:CalendarManifest;user?:CalendarUser;client:CalendarClient;queryClient:QueryClient;locale?:string;search?:CalendarSearch;
    updateSearch:(patch:Partial<CalendarSearch>,push?:boolean)=>void;back:()=>void;
  }=$props();
  let now=$state(untrack(()=>Date.now())),compact=$state(false),container=$state<HTMLDivElement>();
  let data=$state<CalendarRange>(),updatedAt=$state(0),fetching=$state(false),initialPending=$state(true),error=$state<unknown>();
  let refetch=()=>{};
  let notice=$state<CalendarNotice>(),tabFocus=$state(0),monthTab=$state<HTMLButtonElement>(),agendaTab=$state<HTMLButtonElement>(),tabList=$state<HTMLDivElement>();
  const collections=$derived(Object.entries(manifest?.collections??{}).filter(([,c])=>!c.hidden).map(([slug,c])=>({slug,label:c.label,icon:c.icon})));
  const collectionOrder=$derived(collections.map(c=>c.slug)),locales=$derived(manifest?.i18n?.locales??[]);
  const display=$derived(createCalendarDisplay({locale,timeZone:manifest?.timezone,collections,showLocale:locales.length>1}));
  const today=$derived(dayKeyInZone(now,display.timeZone)),month=$derived(search.month??today.slice(0,7)),view=$derived(search.view??(compact?'agenda':'month'));
  $effect(()=>{tabFocus=calendarTabFocus(view==='month'?0:1,untrack(()=>tabFocus),Boolean(tabList?.contains(document.activeElement)));});
  function viewTabKey(event:KeyboardEvent,index:number){const target=calendarTabTarget(event.key,index,2,getComputedStyle(event.currentTarget as HTMLElement).direction==='rtl'?'rtl':'ltr');if(target!==undefined){event.preventDefault();event.stopPropagation();tabFocus=target;(target===0?monthTab:agendaTab)?.focus();}}
  const weekStartsOn=$derived(getDayPickerLocale(locale).options?.weekStartsOn??0);
  const gridDays=$derived(monthGridDays(month,weekStartsOn)),range=$derived(fetchRange(gridDays));
  const filters=$derived<CalendarFilterValues>({collections:readList(search.collections).filter(slug=>collectionOrder.includes(slug)),locales:readList(search.locales).filter(value=>locales.includes(value)),states:readList(search.states).filter(isCalendarState)});
  const filtered=$derived(filters.collections.length+filters.locales.length+filters.states.length>0);
  const rangeHasNow=$derived(now>=Date.parse(range.from)&&now<Date.parse(range.to));
  let calendarObserver=$state<QueryObserver<CalendarRange,Error,CalendarRange,CalendarRange,readonly ['calendar',string,string]>>();
  const rangeOwner=createCalendarRangeOwner(result=>{data=result.data;updatedAt=result.dataUpdatedAt;fetching=result.isFetching;initialPending=result.isPending;error=result.error;},observer=>{calendarObserver=observer;});
  onDestroy(()=>rangeOwner.destroy());
  $effect(()=>{rangeOwner.update(queryClient,manifest,{...calendarQueryOptions(range.from,range.to),staleTime:0,refetchInterval:query=>untrack(()=>rangeHasNow)&&query.state.status!=='error'?60000:false});});
  refetch=()=>{void rangeOwner.refetch();};
  // The Source keeps one observer per range. A minute clock updates interval
  // eligibility without remounting stale queries or restarting terminal errors.
  $effect(()=>{const observer=calendarObserver,containsNow=rangeHasNow;if(observer)observer.setOptions({...observer.options,refetchInterval:query=>containsNow&&query.state.status!=='error'?60000:false});});
  onMount(()=>{
    let timer:ReturnType<typeof setTimeout>;
    const tick=()=>{timer=setTimeout(()=>{now=Date.now();tick();},60000-(Date.now()%60000));};tick();
    const measure=()=>{compact=(container?.clientWidth??window.innerWidth)<640+(compact?24:0);};measure();
    // Deliver layout changes outside ResizeObserver's delivery cycle; switching
    // the month/agenda layout can resize the same observed container.
    let frame=0;
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);});if(container)observer.observe(container);
    return()=>{clearTimeout(timer);cancelAnimationFrame(frame);observer.disconnect();};
  });
  const items=$derived(data?toCalendarItems(data.items,{timeZone:display.timeZone,loadedAt:updatedAt,collectionOrder}):[]);
  const visible=$derived(filterItems(items,filters)),days=$derived(groupByDay(visible)),unfilteredDays=$derived(filtered?groupByDay(items):days);
  const loadedThrough=$derived(data?.truncated?items.at(-1)?.day:undefined);
  const selectedKey=$derived(search.entry),withoutEntry=$derived(JSON.stringify({...search,entry:undefined}));
  let pushedFrom:string|null=null,returnFocus={current:null as HTMLElement|null},lastSelected=$state<CalendarItem>();
  const found=$derived(selectedKey?items.find(item=>item.key===selectedKey):undefined);
  $effect(()=>{if(found)lastSelected=found;if(selectedKey===undefined)pushedFrom=null;});
  const selected=$derived(found??(lastSelected?.key===selectedKey?lastSelected:undefined));
  $effect(()=>{if(selectedKey&&!found&&data&&!fetching)updateSearch({entry:undefined});});
  function openEntry(item:CalendarItem,element:HTMLElement){returnFocus.current=element;if(selectedKey===undefined)pushedFrom=withoutEntry;updateSearch({entry:item.key},selectedKey===undefined);}
  function closeEntry(){const from=pushedFrom;pushedFrom=null;if(from===withoutEntry)back();else updateSearch({entry:undefined});}
  function goToMonth(next:string|undefined){if(next===undefined||isMonthKey(next))updateSearch({month:next});}
  function setFilters(patch:Partial<CalendarFilterValues>){updateSearch({...('collections'in patch?{collections:toListParam(patch.collections??[])}:{}),...('locales'in patch?{locales:toListParam(patch.locales??[])}:{}),...('states'in patch?{states:toListParam(patch.states??[])}:{})});}
  const filterTrigger={current:null as HTMLButtonElement|null};
  function clearFilters(){setFilters({collections:[],locales:[],states:[]});filterTrigger.current?.focus();}
  function prefetch(target:string){if(!isMonthKey(target))return;const next=fetchRange(monthGridDays(target,weekStartsOn));void queryClient.prefetchQuery({...calendarQueryOptions(next.from,next.to),staleTime:60000});}
  const errorMessage=$derived(error instanceof ApiResponseError?error.code==='FORBIDDEN'?"You don't have permission to view the calendar.":error.message:'Check your connection and try again.');
  const zoneTime=$derived(dayKeyToUTC(`${month}-15`)+12*3600000);
</script>
<div bind:this={container} class="calendar">
<header><div><h1>Calendar</h1><p>Published and scheduled entries across collections, in the site's time zone.</p></div><Filters {display} {collections} {locales} value={filters} onChange={setFilters} triggerRef={filterTrigger}/></header>
{#if notice}<div role={notice.type==='error'?'alert':'status'} class="notice"><strong>{notice.title}</strong>{#if notice.description}<p>{notice.description}</p>{/if}<button type="button" aria-label="Dismiss notification" onclick={()=>notice=undefined}>×</button></div>{/if}
<div role="tablist" bind:this={tabList} aria-label="Calendar view"><button type="button" role="tab" bind:this={monthTab} tabindex={tabFocus===0?0:-1} onfocus={()=>tabFocus=0} onkeydown={event=>viewTabKey(event,0)} aria-selected={view==='month'} onclick={()=>updateSearch({view:'month'})}>Month</button><button type="button" role="tab" bind:this={agendaTab} tabindex={tabFocus===1?0:-1} onfocus={()=>tabFocus=1} onkeydown={event=>viewTabKey(event,1)} aria-selected={view==='agenda'} onclick={()=>updateSearch({view:'agenda'})}>Agenda</button></div>
<Toolbar title={display.monthTitle(month)} {display} {zoneTime} loading={calendarInitialLoading(initialPending,fetching)} onPrevious={()=>goToMonth(shiftMonth(month,-1))} onNext={()=>goToMonth(shiftMonth(month,1))} onToday={()=>goToMonth(undefined)} onPreviewPrevious={()=>prefetch(shiftMonth(month,-1))} onPreviewNext={()=>prefetch(shiftMonth(month,1))}/>
{#if error}<div role="alert"><h3>Could not load the calendar</h3><p>{errorMessage}</p><button type="button" onclick={()=>refetch()}>Retry</button></div>{/if}
{#if data?.truncated}<div role="status"><h3>This range has more than {new Intl.NumberFormat(locale).format(CALENDAR_MAX_ENTRIES)} entries</h3><p>The calendar shows the first {new Intl.NumberFormat(locale).format(CALENDAR_MAX_ENTRIES)}{loadedThrough?`, which end on ${display.monthDay(loadedThrough)}`:''}.</p></div>{/if}
{#if !(error&&!data)}{#if view==='month'}<Month {month} {gridDays} {days} {unfilteredDays} {today} {now} {display} loading={!data} {loadedThrough} {compact} {selectedKey} onSelect={openEntry} onMonthChange={goToMonth} onClearFilters={filtered?clearFilters:undefined}/>
{:else}{#key month}<Agenda {month} {days} {today} {now} {display} loading={!data} {loadedThrough} {selectedKey} onSelect={openEntry} onClearFilters={filtered?clearFilters:undefined}/>{/key}{/if}{/if}
<Panel item={selected} {display} {now} {compact} i18n={manifest?.i18n} urlPatterns={Object.fromEntries(Object.entries(manifest?.collections??{}).map(([slug,collection])=>[slug,collection.urlPattern]))} {user} {returnFocus} {client} {queryClient} onNotice={value=>notice=value} onClose={closeEntry} onRescheduled={(item,at)=>{const target=dayKeyInZone(Date.parse(at),display.timeZone).slice(0,7);if(target!==month)goToMonth(target);}}/>
</div>
<style>.calendar{min-width:0;display:grid;gap:1.25rem;}header{display:flex;justify-content:space-between;gap:1rem;align-items:start;}h1{margin:0;font-size:2rem;}header p{font-size:.875rem;color:var(--muted-foreground,#666);}button{font:inherit;color:inherit;background:var(--card,#fff);border:1px solid var(--border,#ccc);border-radius:.35rem;padding:.55rem .8rem;cursor:pointer;}[role="tablist"]{display:flex;gap:.35rem;}[aria-selected="true"]{background:var(--primary,#174bbf);color:white;}[role="alert"]{border:1px solid #c55;padding:1rem;}[role="status"]{border:1px solid #ba8a36;padding:1rem;}button:focus-visible{outline:2px solid var(--ring,#165ccc);outline-offset:2px;}@media(max-width:639px){header{flex-wrap:wrap;}[role="tablist"] button{flex:1;}}</style>
