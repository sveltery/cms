<script lang="ts">
  import { useCalendarMessages } from './message-context.svelte.ts';
  const t = useCalendarMessages();
  // EmDash1.1.0 CalendarEntry row/chip behavior, pin913cb1bb; MIT.
  import { base } from '$app/paths';
  import { getContext,onDestroy } from 'svelte';
  import {createCalendarHoverTiming,type CalendarTooltipGroup} from './presentation.ts';
  import {createCalendarTooltipTransit,type CalendarTooltipSide} from './tooltip-transit.ts';
  import {computeCalendarTooltipPosition} from './tooltip-position.ts';
  import {autoUpdate} from '@floating-ui/dom';
  import { formatTimeAgo, formatShortDuration } from './calendar.ts';
  import { isPlainClick, stateLabels } from './entry.ts';
  import LocaleChip from './CalendarLocaleChip.svelte';
  import type { EntryProps } from './ui-types.ts';
  let { item, display, now, selected, onSelect, chip = false }: EntryProps = $props();
  const href = $derived(`${base}/content/${encodeURIComponent(item.collection)}/${encodeURIComponent(item.id)}?locale=${encodeURIComponent(item.locale)}`);
  const tooltipId=$props.id();
  let anchor=$state<HTMLAnchorElement>(),tooltip=$state<HTMLDivElement>(),tooltipArrow=$state<HTMLSpanElement>(),tooltipOpen=$state(false),left=$state(0),top=$state(0),side=$state<CalendarTooltipSide>('top'),positioned=$state(false),arrowX=$state<number>(),arrowY=$state<number>(),arrowUncentered=$state(false),anchorHidden=$state(false);
  let transit:ReturnType<typeof createCalendarTooltipTransit>|undefined,removeTransitListener:(()=>void)|undefined;
  function stopTransit(){transit?.destroy();transit=undefined;removeTransitListener?.();removeTransitListener=undefined;}
  function hideTooltip(){hover.close();}
  function closeTooltip(){stopTransit();tooltipOpen=false;positioned=false;}
  function showTooltip(){if(!chip||!anchor)return false;positioned=false;tooltipOpen=true;return true;}
  const hover=createCalendarHoverTiming(showTooltip,closeTooltip,getContext<CalendarTooltipGroup|undefined>('calendar-tooltip-group'));
  function hoverTooltip(event:PointerEvent){stopTransit();if(chip)hover.enter(event.pointerType);}
  function transitEvent(event:PointerEvent,leaving=false){const target=event.composedPath()[0]??event.target;return{type:leaving?'mouseleave' as const:'mousemove' as const,clientX:event.clientX,clientY:event.clientY,insideTrigger:target instanceof Node&&Boolean(anchor?.contains(target)),insidePopup:target instanceof Node&&Boolean(tooltip?.contains(target)),relatedInsidePopup:event.relatedTarget instanceof Node&&Boolean(tooltip?.contains(event.relatedTarget))};}
  function leaveTooltip(event:PointerEvent){
    hover.cancel();
    if(!tooltipOpen||!anchor||!tooltip||event.pointerType!=='mouse'){hideTooltip();return;}
    if(!transit){
      transit=createCalendarTooltipTransit({x:event.clientX,y:event.clientY,side,rects:()=>({trigger:anchor!.getBoundingClientRect(),popup:tooltip!.getBoundingClientRect()}),onClose:hideTooltip});
      const moved=(next:PointerEvent)=>{if(next.pointerType==='mouse')transit?.move(transitEvent(next));};
      document.addEventListener('pointermove',moved);removeTransitListener=()=>document.removeEventListener('pointermove',moved);
    }
    transit.move(transitEvent(event,true));
  }
  $effect(()=>{
    const trigger=anchor,popup=tooltip,arrow=tooltipArrow;if(!tooltipOpen||!trigger||!popup||!arrow)return;
    if(!popup.matches(':popover-open'))popup.showPopover();
    let active=true;
    const update=async()=>{const result=await computeCalendarTooltipPosition(trigger,popup,{arrow});if(!active)return;left=result.x;top=result.y;side=result.placement.split('-')[0] as CalendarTooltipSide;arrowX=result.middlewareData.arrow?.x;arrowY=result.middlewareData.arrow?.y;arrowUncentered=result.middlewareData.arrow?.centerOffset!==0;anchorHidden=Boolean(result.middlewareData.hide?.referenceHidden);positioned=true;};
    const stop=autoUpdate(trigger,popup,()=>{void update();},{elementResize:typeof ResizeObserver!=='undefined',layoutShift:typeof IntersectionObserver!=='undefined'});
    return()=>{active=false;stop();};
  });
  onDestroy(()=>{stopTransit();hover.destroy();});
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
{#if tooltipOpen}<div bind:this={tooltip} id={tooltipId} role="tooltip" popover="manual" class="entry-tooltip" data-side={side} data-anchor-hidden={anchorHidden?'':undefined} style:opacity={positioned?undefined:0} style:left={`${left}px`} style:top={`${top}px`} onpointerleave={leaveTooltip}>
  <span bind:this={tooltipArrow} aria-hidden="true" class="tooltip-arrow" data-uncentered={arrowUncentered?'':undefined} style:left={arrowX===undefined?undefined:`${arrowX}px`} style:top={arrowY===undefined?undefined:`${arrowY}px`}><svg width="20" height="10" viewBox="0 0 20 10" fill="none"><path d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z" fill="var(--card,#fff)"/><path d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z" fill="var(--border,#ddd)"/><path d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z" fill="var(--border,#ddd)"/></svg></span>
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
  .entry-tooltip{position:fixed;inset:auto;margin:0;display:grid;gap:.25rem;width:max-content;max-width:min(16rem,var(--available-width,16rem));border:1px solid var(--border,#ddd);border-radius:.35rem;background:var(--card,#fff);color:var(--foreground,#222);padding:.5rem .625rem;font-size:.75rem;box-shadow:0 .5rem 1.5rem #0003;transform-origin:var(--transform-origin);}.entry-tooltip strong{font-size:.875rem;overflow-wrap:anywhere;}
  .tooltip-arrow{position:absolute;display:flex;width:20px;height:10px;}.entry-tooltip[data-side=top] .tooltip-arrow{bottom:-8px;transform:rotate(180deg);}.entry-tooltip[data-side=bottom] .tooltip-arrow{top:-8px;}.entry-tooltip[data-side=left] .tooltip-arrow{right:-13px;transform:rotate(90deg);}.entry-tooltip[data-side=right] .tooltip-arrow{left:-13px;transform:rotate(-90deg);}
</style>
