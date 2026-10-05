<script lang="ts">
  // EmDash1.1.0 CalendarAgenda whole placement/collapse behavior, pin913cb1bb; MIT.
  import { isMonthCutOff, shiftDay, type CalendarDisplay, type CalendarItem } from './calendar.ts';
  import DayList from './CalendarDayList.svelte';
  import type { CalendarSelectHandler } from './ui-types.ts';
  let { month, days, today, now, display, loading, loadedThrough, onClearFilters, selectedKey, onSelect }: {
    month:string; days:ReadonlyMap<string,CalendarItem[]>; today:string; now:number; display:CalendarDisplay;
    loading?:boolean; loadedThrough?:string; onClearFilters?:()=>void; selectedKey?:string; onSelect?:CalendarSelectHandler;
  } = $props();
  let showEarlier = $state<boolean>();
  const headingPrefix=$props.id(),tomorrow=$derived(shiftDay(today,1));
  const cutOff = $derived(isMonthCutOff(month, loadedThrough));
  const keys = $derived([...days.keys()].filter(day=>day.startsWith(month)).toSorted());
  const current = $derived(today.startsWith(month));
  const earlier = $derived(current ? keys.filter(day=>day<today) : []);
  const earlierCount = $derived(earlier.reduce((n,day)=>n+(days.get(day)?.length??0),0));
  const expanded = $derived(showEarlier ?? earlier.some(day=>days.get(day)?.some(item=>item.state==='overdue')));
  const shown = $derived(expanded || !current ? keys : keys.filter(day=>day>=today));
  const todayItems = $derived(current ? days.get(today) : undefined);
  const firstUpcoming = $derived(todayItems?.findIndex(item=>item.time>now)??-1);
  const nowAt = $derived(todayItems ? firstUpcoming === -1 ? todayItems.length : firstUpcoming : undefined);
  const nextDay = $derived(current && !todayItems ? shown.find(day=>day>today) : undefined);
  const nothingAfter = $derived(current && !cutOff && !keys.some(day=>days.get(day)?.some(item=>item.time>now)));
</script>
{#if loading}<p role="status">Loading calendar…</p>
{:else if keys.length === 0}
  <div class="empty"><h3>{cutOff ? onClearFilters ? 'No loaded entries match these filters' : "This month wasn't loaded" : onClearFilters ? 'No entries match these filters' : `Nothing published or scheduled in ${display.monthTitle(month)}`}</h3>
  {#if cutOff}<p>The range has more entries than the calendar can show.</p>{:else if !onClearFilters}<p>Scheduled entries appear here with their publish time.</p>{/if}
  {#if onClearFilters}<button type="button" onclick={onClearFilters}>Clear filters</button>{/if}</div>
{:else}
  {#if earlierCount > 0}<button class="earlier" type="button" aria-expanded={expanded} onclick={()=>showEarlier=!expanded}>{expanded ? 'Hide earlier entries' : `Show ${earlierCount} earlier ${earlierCount===1?'entry':'entries'}`}</button>{/if}
  {#each shown as day (day)}
    {#if day === nextDay}<p class="now">Now · {display.formatTime(now)}</p>{/if}
    <section aria-labelledby={`${headingPrefix}-${day}`}><h3 id={`${headingPrefix}-${day}`}>{display.weekday(day)} <span>{display.monthDay(day)}</span>{#if day===today} <strong>Today</strong>{:else if day===tomorrow} <strong>Tomorrow</strong>{/if}</h3><DayList items={days.get(day)??[]} {display} {now} label={display.fullDate(day)} nowAt={day===today?nowAt:undefined} {selectedKey} {onSelect}/></section>
  {/each}
  {#if current && !todayItems && !nextDay}<p class="now">Now · {display.formatTime(now)}</p>{/if}
  {#if nothingAfter}<p>Nothing else is scheduled this month.</p>{/if}
  {#if cutOff}<p>Later entries weren't loaded. The range has more entries than the calendar can show.</p>{/if}
{/if}
<style>section {margin:1.25rem 0;} h3 {font-size:.875rem;margin:0 0 .5rem;padding:0 .5rem;} .now{color:#b32929;border-bottom:2px solid #b32929;padding:.4rem .5rem;font-size:.75rem;} .empty{text-align:center;padding:3rem 1rem;} button{font:inherit;padding:.5rem .75rem;cursor:pointer;} .earlier{background:transparent;border:0;}</style>
