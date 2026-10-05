<script lang="ts">
  // EmDash1.1.0 CalendarMonth placement/folding/reservation/picker behavior, pin913cb1bb; MIT.
  import { tick } from 'svelte';
  import { format } from 'date-fns';
  import { getDayPickerLocale } from '../ui/date-time-locales.ts';
  import { isMonthCutOff, shiftDay, dayKeyToUTC, type CalendarDisplay, type CalendarItem } from './calendar.ts';
  import Entry from './CalendarEntry.svelte';
  import DayList from './CalendarDayList.svelte';
  import type { CalendarSelectHandler } from './ui-types.ts';
  let { month, gridDays, days, unfilteredDays, today, now, display, loading, loadedThrough, compact=false, selectedKey, onSelect, onMonthChange, onClearFilters }: {
    month:string;gridDays:readonly string[];days:ReadonlyMap<string,CalendarItem[]>;unfilteredDays?:ReadonlyMap<string,CalendarItem[]>;
    today:string;now:number;display:CalendarDisplay;loading?:boolean;loadedThrough?:string;compact?:boolean;selectedKey?:string;
    onSelect?:CalendarSelectHandler;onMonthChange:(month:string)=>void;onClearFilters?:()=>void;
  }=$props();
  const weeks=$derived(Array.from({length:Math.ceil(gridDays.length/7)},(_,week)=>gridDays.slice(week*7,week*7+7)));
  let picked=$state<string>(), pickedMonth=$state<string>(), focusDay=$state<string>(), popover=$state<string>(), moreTrigger=$state<HTMLButtonElement>();
  $effect(()=>{if(pickedMonth!==month){pickedMonth=month;picked=undefined;}});
  $effect(()=>{if(focusDay?.startsWith(month)){const day=focusDay;void tick().then(()=>document.querySelector<HTMLButtonElement>(`[data-calendar-day="${day}"]`)?.focus());}});
  const firstWithEntries=(map:ReadonlyMap<string,CalendarItem[]>)=>[...map.keys()].filter(day=>day.startsWith(month)).toSorted()[0];
  const selected=$derived(picked??(today.startsWith(month)?today:firstWithEntries(unfilteredDays??days)??`${month}-01`));
  const filteredEmpty=$derived(Boolean(onClearFilters)&&!loading&&!(compact?firstWithEntries(days):gridDays.some(day=>days.has(day))));
  const cutOff=$derived(isMonthCutOff(month,loadedThrough));
  const currentItems=$derived(days.get(selected)??[]);
  function nowIndex(items:readonly CalendarItem[]){const index=items.findIndex(item=>item.time>now);return index===-1?items.length:index;}
  function dayLabel(day:string){const d=new Date(dayKeyToUTC(day));const local=new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),12);const label=format(local,'MMMM do, yyyy',{locale:getDayPickerLocale(display.locale)});const count=days.get(day)?.length??0;return count?`${label}, ${count} ${count===1?'entry':'entries'}`:label;}
  function keydown(event:KeyboardEvent,day:string){const step:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7};if(!(event.key in step))return;event.preventDefault();const next=shiftDay(day,step[event.key]!);focusDay=next;picked=next;if(!next.startsWith(month))onMonthChange(next.slice(0,7));else void tick().then(()=>document.querySelector<HTMLButtonElement>(`[data-calendar-day="${next}"]`)?.focus());}
  function roomiestEntries(items:readonly CalendarItem[]){return items.toSorted((a,b)=>Number(a.state==='published')-Number(b.state==='published')).slice(0,4);}
</script>
{#snippet notice()}<div class="notice"><p>{cutOff?'No loaded entries match these filters':'No entries match these filters'}</p><button type="button" onclick={onClearFilters}>Clear filters</button></div>{/snippet}
{#snippet cellEntries(day:string,items:readonly CalendarItem[])}
  {@const visible=items.length>4?items.slice(0,3):items}
  {@const nowAt=day===today?nowIndex(items):undefined}
  {@const lineAt=nowAt===undefined||nowAt<=visible.length?nowAt:nowAt===items.length?items.length:undefined}
  <ul aria-label={display.fullDate(day)}>
    {#each visible as item,index(item.key)}{#if index===lineAt}<li aria-hidden="true" class="now-line"></li>{/if}<li><Entry {item} {display} {now} {onSelect} chip selected={item.key===selectedKey}/></li>{/each}
    {#if lineAt===visible.length}<li aria-hidden="true" class="now-line"></li>{/if}
    {#if visible.length<items.length}<li><button type="button" aria-label={`${items.length-3} more ${items.length-3===1?'entry':'entries'} on ${display.fullDate(day)}`} onclick={event=>{moreTrigger=event.currentTarget;popover=day;}}>+{items.length-3} more</button></li>{/if}
    {#if visible.length<items.length&&lineAt===items.length}<li aria-hidden="true" class="now-line"></li>{/if}
  </ul>
{/snippet}
<div class="month">
<table aria-label={display.monthTitle(month)}><thead><tr>{#each weeks[0]??[] as day}<th scope="col" aria-label={display.weekday(day)}>{display.weekdayShort(day)}</th>{/each}</tr></thead>
<tbody>{#each weeks as week(week[0])}<tr>{#each week as day(day)}{@const reserved=unfilteredDays?.get(day)}
  <td class:outside={!day.startsWith(month)} class:weekend={display.isWeekend(day)} aria-current={day===today?'date':undefined}>
  {#if compact}
    {#if day.startsWith(month)}<button type="button" data-calendar-day={day} aria-label={dayLabel(day)} aria-pressed={selected===day} tabindex={(focusDay??selected)===day?0:-1} onclick={()=>picked=day} onkeydown={event=>keydown(event,day)}>{display.dayNumber(day)}<span aria-hidden="true" class="dots">{#each (days.get(day)??[]).slice(0,3) as item}<i class={item.state}></i>{/each}{#if (days.get(day)?.length??0)>3}+{/if}</span></button>{/if}
  {:else}<div class="cell"><div class="date">{day.endsWith('-01')?display.monthDayShort(day):display.dayNumber(day)}</div>
    <div class="entries">
      {#if reserved&&(reserved.length>4||(days.get(day)?.length??0)<reserved.length)}<div class="reservation" aria-hidden="true" inert>{@render cellEntries(day,roomiestEntries(reserved))}</div>{/if}
      <div class="visible-entries">{#if (days.get(day)?.length??0)>0}{@render cellEntries(day,days.get(day)!)}{:else if loadedThrough!==undefined&&day>=loadedThrough}<p class="not-loaded">Not loaded</p>{/if}</div>
    </div></div>
  {/if}</td>{/each}</tr>{/each}</tbody></table>
{#if !compact&&filteredEmpty}{@render notice()}{/if}</div>
{#if compact}<section><h3>{display.weekday(selected)} <span>{display.monthDay(selected)}</span></h3>
  {#if loading}<p role="status">Loading calendar…</p>{:else if filteredEmpty}{@render notice()}
  {:else if currentItems.length}<DayList items={currentItems} {display} {now} label={display.fullDate(selected)} nowAt={selected===today?nowIndex(currentItems):undefined} {selectedKey} {onSelect}/>
  {:else}<p>{loadedThrough&&selected>=loadedThrough?"This day wasn't loaded. The range has more entries than the calendar can show.":'Nothing on this day.'}</p>{/if}
</section>{/if}
{#if popover}<div role="dialog" aria-label={display.fullDate(popover)} tabindex="-1" class="popover" onkeydown={event=>{if(event.key==='Escape'){popover=undefined;moreTrigger?.focus();}}}>
  <h3>{display.fullDate(popover)}</h3><DayList items={days.get(popover)??[]} {display} {now} label={display.fullDate(popover)} nowAt={popover===today?nowIndex(days.get(popover)??[]):undefined} {selectedKey}
    onSelect={onSelect?(item,element)=>{popover=undefined;onSelect?.(item,moreTrigger??element);}:undefined}/>
  <button type="button" onclick={()=>{popover=undefined;moreTrigger?.focus();}}>Close</button></div>{/if}
<style>
  .month{position:relative;border:1px solid var(--border,#ddd);border-radius:.5rem;overflow:hidden;}table{width:100%;table-layout:fixed;border-collapse:collapse;}th{font-size:.75rem;font-weight:400;text-align:right;padding:.5rem;}td{vertical-align:top;border:1px solid var(--border,#ddd);padding:.25rem;}td.outside,td.weekend{background:var(--muted,#f5f5f5);} .cell{min-height:7rem;min-width:0;}.entries{display:grid;min-width:0;}.reservation,.visible-entries{grid-area:1/1;min-width:0;}.reservation{visibility:hidden;}.date{text-align:right;height:1.75rem;font-size:.75rem;}ul{list-style:none;padding:0;margin:0;display:grid;gap:4px;}button{font:inherit;color:inherit;background:var(--card,#fff);border:1px solid var(--border,#ddd);padding:.4rem;cursor:pointer;border-radius:.3rem;}[data-calendar-day]{width:100%;min-height:2.75rem;}[aria-pressed="true"]{background:var(--primary,#174bbf);color:white;}.dots{height:.4rem;display:flex;justify-content:center;gap:3px;font-size:.6rem;}i{width:5px;height:5px;background:#337bdb;border-radius:50%;}i.published{background:#329065;}i.overdue{background:#b96800;}.now-line{border-bottom:2px solid #b32929;height:2px;}.notice{padding:1rem;background:var(--card,#fff);display:flex;gap:1rem;align-items:center;justify-content:center;}.month>.notice{position:absolute;inset:0;background:#fffd;}h3{font-size:1rem;}h3 span{font-weight:400;}.popover{position:fixed;z-index:40;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--card,#fff);border:1px solid var(--border,#ddd);box-shadow:0 10px 40px #0003;padding:1rem;width:20rem;max-width:calc(100vw - 2rem);max-height:80vh;overflow:auto;}.not-loaded{font-size:.75rem;color:var(--muted-foreground,#666);}button:focus-visible{outline:2px solid var(--ring,#165ccc);outline-offset:2px;}
</style>
