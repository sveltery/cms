<script lang="ts">
  // EmDash1.1.0 CalendarEntryPanel behavior, pin913cb1bb; MIT.
  import { tick } from 'svelte';
  import { base } from '$app/paths';
  import { QueryObserver, type QueryClient } from '@tanstack/react-query';
  import { formatTimeAgo,formatTimeUntil,type CalendarDisplay,type CalendarItem } from './calendar.ts';
  import { stateLabels } from './entry.ts';
  import type { CalendarClient,CalendarContent,CalendarUser } from './ui-types.ts';
  let { item,display,now,compact, i18n, user,onClose,onRescheduled,returnFocus,client,queryClient }: {
    item:CalendarItem|undefined;display:CalendarDisplay;now:number;compact:boolean;
    i18n?:{locales:string[]};urlPatterns?:Readonly<Record<string,string|undefined>>;user?:CalendarUser;
    onClose:()=>void;onRescheduled:(item:CalendarItem,scheduledAt:string)=>void;returnFocus?:{current:HTMLElement|null};
    client:CalendarClient;queryClient?:QueryClient;
  }=$props();
  let entry=$state<CalendarContent>(),error=$state<string>(),pending=$state(false),scheduleOpen=$state(false),scheduledAt=$state(''),dialog=$state<HTMLDialogElement>();
  $effect(()=>{
    const selected=item;if(!selected){entry=undefined;return;}
    entry=undefined;error=undefined;let active=true;
    const options={queryKey:['content',selected.collection,selected.id,{locale:i18n?selected.locale:undefined}],queryFn:()=>client.fetchContent(selected.collection,selected.id,{locale:i18n?selected.locale:undefined}),staleTime:0};
    if(queryClient){const observer=new QueryObserver(queryClient,options);const unsubscribe=observer.subscribe(result=>{entry=result.data;error=result.isError?"Could not load this entry's details.":undefined;});return()=>{active=false;unsubscribe();observer.destroy();};}
    void options.queryFn().then(value=>{if(active)entry=value;},()=>{if(active)error="Could not load this entry's details.";});return()=>{active=false;};
  });
  $effect(()=>{const selected=item;const node=dialog;if(selected&&node){if(compact&&!node.open)node.showModal();else if(!compact&&!node.open)node.show();}else if(node?.open){node.close();returnFocus?.current?.isConnected&&returnFocus.current.focus();}});
  const canPublish=$derived(Boolean(user&&entry&&(user.role>=40||(user.role>=30&&entry.authorId===user.id))));
  const bylines=$derived(new Intl.ListFormat(display.locale,{type:'conjunction'}).format((entry?.bylines??[]).toSorted((a,b)=>a.sortOrder-b.sortOrder).map(c=>c.byline.displayName)));
  async function mutate(action:'publish'|'unschedule'|'schedule') {
    if(!item||pending)return;const selected=item;pending=true;error=undefined;
    try{
      if(action==='publish')await client.publishContent(selected.collection,selected.id,{locale:selected.locale,_rev:entry?._rev});
      else if(action==='unschedule')await client.unscheduleContent(selected.collection,selected.id,{locale:selected.locale});
      else await client.scheduleContent(selected.collection,selected.id,new Date(scheduledAt).toISOString(),{locale:selected.locale});
      await Promise.all([queryClient?.invalidateQueries({queryKey:['calendar']}),queryClient?.invalidateQueries({queryKey:['content',selected.collection]}),queryClient?.invalidateQueries({queryKey:['dashboard-stats']})]);
      if(action==='schedule'){scheduleOpen=false;onRescheduled(selected,new Date(scheduledAt).toISOString());}else onClose();
    }catch(cause){error=cause instanceof Error?cause.message:'Request failed';}finally{pending=false;}
  }
</script>
<dialog bind:this={dialog} aria-label={item?.title} data-open={item?'':undefined} class:compact oncancel={event=>{event.preventDefault();onClose();}}>
{#if item}<div class="top"><span>{display.collection(item.collection).label}</span><button type="button" aria-label="Close" onclick={onClose}>×</button></div>
<h2 dir="auto">{item.title}</h2><dl><dt>State</dt><dd>{stateLabels[item.state]}</dd><dt>{item.kind==='scheduled'?item.state==='overdue'?'Was due':'Goes live':'Published'}</dt><dd>{display.formatDateTime(item.time)}{#if display.viewerZoneDiffers}<small>Your time: {display.formatViewerTime(item.time)}</small>{/if}</dd>
{#if display.showLocale}<dt>Locale</dt><dd>{new Intl.DisplayNames([display.locale],{type:'language'}).of(item.locale)}</dd>{/if}
{#if bylines}<dt>Bylines</dt><dd>{bylines}</dd>{/if}<dt>Last edited</dt><dd>{entry?formatTimeAgo(now-Date.parse(entry.updatedAt),display.locale):'—'}</dd></dl>
{#if item.kind==='scheduled'}<h3>Publishing</h3>
  {#if item.state==='overdue'}<p class="overdue">This entry was due {formatTimeAgo(now-item.time,display.locale)} but hasn't published. Scheduled publishing may not be running.</p>
  {:else if item.state==='scheduled'}<p>Goes live {formatTimeUntil(item.time-now,display.locale)}</p>{:else if item.state==='update'}<p>Scheduled changes · Go live {formatTimeUntil(item.time-now,display.locale)}</p>{/if}
  {#if canPublish}<div class="actions">{#if item.state==='overdue'}<button type="button" disabled={pending} onclick={()=>void mutate('publish')}>Publish now</button>{/if}<button type="button" disabled={pending} onclick={()=>{scheduleOpen=true;scheduledAt='';void tick();}}>Reschedule</button><button type="button" disabled={pending} onclick={()=>void mutate('unschedule')}>Remove schedule</button></div>{/if}
{/if}
{#if error}<p role="alert">{error}</p>{/if}
<footer><a href={`${base}/content/${encodeURIComponent(item.collection)}/${encodeURIComponent(item.id)}?locale=${encodeURIComponent(item.locale)}`}>Open in editor</a></footer>
{#if scheduleOpen}<form onsubmit={event=>{event.preventDefault();void mutate('schedule');}}><h3>Reschedule</h3><label>Scheduled time <input type="datetime-local" bind:value={scheduledAt} required /></label><button type="submit" disabled={pending}>Save schedule</button><button type="button" onclick={()=>scheduleOpen=false}>Cancel</button></form>{/if}
{/if}</dialog>
<style>dialog{position:fixed;inset:0 0 0 auto;margin:0;border:0;border-left:1px solid var(--border,#ddd);width:27rem;max-width:100vw;height:100dvh;max-height:100dvh;background:var(--card,#fff);color:inherit;padding:1.5rem;box-shadow:-8px 0 24px #0002;z-index:50;}dialog:not([open]){display:none;}.compact{inset:auto 0 0;width:100%;height:auto;max-height:85dvh;border-radius:1rem 1rem 0 0;}dialog::backdrop{background:#0006;}.top{display:flex;justify-content:space-between;align-items:center;}h2{font-size:1.6rem;}dl{display:grid;grid-template-columns:8rem 1fr;gap:.9rem;}dt{color:var(--muted-foreground,#666);}dd{margin:0;}small{display:block;}button,input{font:inherit;padding:.5rem;border:1px solid var(--border,#ccc);border-radius:.35rem;background:var(--background,#fff);color:inherit;}button{cursor:pointer;}.actions{display:flex;flex-wrap:wrap;gap:.5rem;}.overdue{padding:.75rem;background:#fff0d6;}footer{margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border,#ddd);}[role="alert"]{color:#b32929;}form{display:grid;gap:.75rem;}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--ring,#165ccc);outline-offset:2px;}</style>
