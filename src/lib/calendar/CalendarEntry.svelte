<script lang="ts">
  import { useCalendarMessages } from './message-context.svelte.ts';
  const t = useCalendarMessages();
  // EmDash1.1.0 CalendarEntry row/chip behavior, pin913cb1bb; MIT.
  import { base } from '$app/paths';
  import { getContext,onDestroy } from 'svelte';
  import {createCalendarHoverTiming,type CalendarTooltipGroup} from './presentation.ts';
  import { formatTimeAgo, formatShortDuration } from './calendar.ts';
  import { isPlainClick, stateLabels } from './entry.ts';
  import LocaleChip from './CalendarLocaleChip.svelte';
  import type { EntryProps } from './ui-types.ts';
  let { item, display, now, selected, onSelect, chip = false }: EntryProps = $props();
  const href = $derived(`${base}/content/${encodeURIComponent(item.collection)}/${encodeURIComponent(item.id)}?locale=${encodeURIComponent(item.locale)}`);
  const tooltipId=$props.id();
  let anchor=$state<HTMLAnchorElement>(),tooltip=$state<HTMLDivElement>(),tooltipOpen=$state(false),left=$state(0),top=$state(0),below=$state(false);
  function hideTooltip(){hover.close();}
  function closeTooltip(){tooltipOpen=false;}
  function showTooltip(){if(!chip||!anchor)return false;const rect=anchor.getBoundingClientRect();left=Math.max(8,Math.min(rect.left,window.innerWidth-272));top=Math.max(8,rect.top-10);tooltipOpen=true;return true;}
  const hover=createCalendarHoverTiming(showTooltip,closeTooltip,getContext<CalendarTooltipGroup|undefined>('calendar-tooltip-group'));
  function hoverTooltip(event:PointerEvent){if(chip)hover.enter(event.pointerType);}
  function leaveTooltip(event:PointerEvent){hover.cancel();if(event.relatedTarget instanceof Node&&(anchor?.contains(event.relatedTarget)||tooltip?.contains(event.relatedTarget)))return;hideTooltip();}
  $effect(()=>{if(tooltipOpen&&tooltip&&anchor){if(!tooltip.matches(':popover-open'))tooltip.showPopover();const trigger=anchor.getBoundingClientRect(),popup=tooltip.getBoundingClientRect(),above=trigger.top-10-popup.height;left=Math.max(8,Math.min(trigger.left+(trigger.width-popup.width)/2,window.innerWidth-popup.width-8));below=above<8;top=below?Math.max(8,Math.min(trigger.bottom+10,window.innerHeight-popup.height-8)):above;}});
  onDestroy(()=>hover.destroy());
</script>
<a bind:this={anchor} {href} class:chip class:published={item.state === 'published'} class:overdue={item.state === 'overdue'}
  aria-haspopup={onSelect ? 'dialog' : undefined} aria-current={selected ? 'true' : undefined}
  aria-describedby={tooltipOpen?tooltipId:undefined} onpointerenter={hoverTooltip} onpointermove={event=>{if(chip)hover.move(event.pointerType,event.movementX,event.movementY);}} onpointerleave={leaveTooltip} onfocus={event=>{if(chip&&event.currentTarget.matches(':focus-visible'))hover.focus();}} onblur={hideTooltip} onkeydown={event=>{if(event.key==='Escape'&&tooltipOpen){event.preventDefault();event.stopPropagation();hideTooltip();}}}
  onclick={event => {hideTooltip();if (onSelect && isPlainClick(event)) { event.preventDefault(); onSelect(item, event.currentTarget); } }}>
  <span class="time">{display.formatTime(item.time)}</span><span dir="auto" class="title">{item.title}</span>
  <span class="state">{chip&&item.state==='published'?t("{state}, {time}:",{state:t(stateLabels[item.state]),time:display.formatTime(item.time)}):t(stateLabels[item.state])}</span>
  {#if item.state === 'overdue'}<span class="note">{chip ? t("{lateness} late",{lateness:formatShortDuration(now-item.time,display.locale)}) : t("Overdue · {lateness}",{lateness:formatTimeAgo(now-item.time,display.locale)})}</span>
  {:else if item.state === 'update'}<span class="note" aria-hidden="true">{t("Update")}</span>{/if}
  {#if !chip}<span class="collection">{display.collection(item.collection).label}</span>{/if}
  {#if display.showLocale}<span class="locale"><LocaleChip locale={item.locale}/></span>{/if}
  {#if display.viewerZoneDiffers && !chip}<span class="viewer">{display.formatViewerTime(item.time)}</span>{/if}
</a>
{#if tooltipOpen}<div bind:this={tooltip} id={tooltipId} role="tooltip" popover="manual" class="entry-tooltip" class:below style:left={`${left}px`} style:top={`${top}px`} onpointerleave={leaveTooltip}>
  <strong dir="auto">{item.title}</strong><span>{t("{state} · {when}",{state:t(stateLabels[item.state]),when:display.formatDateTime(item.time)})}</span>{#if display.viewerZoneDiffers}<span>{t("Your time: {viewerTime}",{viewerTime:display.formatViewerTime(item.time)})}</span>{/if}<span>{display.collection(item.collection).label}{#if display.showLocale} · <LocaleChip locale={item.locale}/>{/if}</span>
</div>{/if}
<style>
  a { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; padding:.45rem .5rem; border-radius:.35rem; text-decoration:none; font-size:.875rem; }
  a:hover,a[aria-current="true"] { background:var(--muted,#eee); } a:focus-visible { outline:2px solid var(--ring,#165ccc); }
  .title { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .time { font-variant-numeric:tabular-nums; }
  .state { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
  .note,.collection,.locale,.viewer { font-size:.75rem; } .overdue .note { color:#a74b00; }
  .chip { display:grid; gap:.15rem; border:1px solid var(--border,#ddd); background:var(--card,#fff); font-size:.75rem; }
  .chip.published { display:flex; border:0; padding:.25rem .4rem; } .published { color:var(--muted-foreground,#666); }
  .entry-tooltip{position:fixed;inset:auto;margin:0;display:grid;gap:.25rem;width:max-content;max-width:16rem;border:1px solid var(--border,#ddd);border-radius:.35rem;background:var(--card,#fff);color:var(--foreground,#222);padding:.5rem .625rem;font-size:.75rem;box-shadow:0 .5rem 1.5rem #0003;}.entry-tooltip strong{font-size:.875rem;overflow-wrap:anywhere;}
  .entry-tooltip::after{content:'';position:absolute;inset-inline:0;top:100%;height:10px;}.entry-tooltip.below::after{top:auto;bottom:100%;}
</style>
