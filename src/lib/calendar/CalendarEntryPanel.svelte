<script lang="ts">
  import { useCalendarMessages } from './message-context.svelte.ts';
  const t = useCalendarMessages();
  // EmDash1.1.0 CalendarEntryPanel behavior, pin913cb1bb; MIT.
  import { untrack } from 'svelte';
  import ScheduleDialog from './CalendarScheduleDialog.svelte';
  import { contentUrl } from './url.ts';
  import { base } from '$app/paths';
  import { QueryObserver, type QueryClient } from '@tanstack/react-query';
  import { formatTimeAgo,formatTimeUntil,type CalendarDisplay,type CalendarItem } from './calendar.ts';
  import { stateLabels } from './entry.ts';
  import type { CalendarClient,CalendarContent,CalendarManifest,CalendarUser,CalendarNotice } from './ui-types.ts';
  let { item,display,now,compact, i18n,urlPatterns={},user,onClose,onRescheduled,onNotice,returnFocus,client,queryClient }: {
    item:CalendarItem|undefined;display:CalendarDisplay;now:number;compact:boolean;
    i18n?:CalendarManifest['i18n'];urlPatterns?:Readonly<Record<string,string|undefined>>;user?:CalendarUser;
    onClose:()=>void;onRescheduled:(item:CalendarItem,scheduledAt:string)=>void;onNotice?:(notice:CalendarNotice)=>void;returnFocus?:{current:HTMLElement|null};
    client:CalendarClient;queryClient?:QueryClient;
  }=$props();
  let entry=$state<CalendarContent>(),error=$state<string>(),pending=$state(false),scheduleOpen=$state(false),previewing=$state(false),translations=$state<{id:string;locale:string;status:string}[]>([]),dialog=$state<HTMLDialogElement>();
  const selectedKey=$derived(item?.key);
  $effect(()=>{selectedKey;scheduleOpen=false;pending=false;previewing=false;});
  $effect(()=>{
    selectedKey;const selected=untrack(()=>item);if(!selected){entry=undefined;return;}
    entry=undefined;error=undefined;let active=true;
    const options={queryKey:['content',selected.collection,selected.id,{locale:i18n?selected.locale:undefined}],queryFn:()=>client.fetchContent(selected.collection,selected.id,{locale:i18n?selected.locale:undefined}),staleTime:0};
    if(queryClient){const observer=new QueryObserver(queryClient,options);const unsubscribe=observer.subscribe(result=>{entry=result.data;error=result.isError?t("Could not load this entry's details."):undefined;});return()=>{active=false;unsubscribe();observer.destroy();};}
    void options.queryFn().then(value=>{if(active)entry=value;},()=>{if(active)error=t("Could not load this entry's details.");});return()=>{active=false;};
  });
  $effect(()=>{
    selectedKey;const selected=untrack(()=>item),fetch=client.fetchTranslations;translations=[];
    if(!selected||!display.showLocale||!fetch)return;
    const options={queryKey:['translations',selected.collection,selected.id],queryFn:()=>fetch(selected.collection,selected.id)};
    if(queryClient){const observer=new QueryObserver(queryClient,options);const unsubscribe=observer.subscribe(result=>{translations=result.data?.translations??[];});return()=>{unsubscribe();observer.destroy();};}
    let active=true;void options.queryFn().then(result=>{if(active)translations=result.translations;},()=>{});return()=>{active=false;};
  });
  $effect(()=>{
    const selected=selectedKey,node=dialog,isCompact=compact;
    if(selected&&node){
      if(node.open&&isCompact!==node.matches(':modal')){
        // Native dialog modality changes require reopening. Preserve a nested
        // schedule's top-layer ordering and fields without action/history callbacks.
        const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
        const child=node.querySelector<HTMLDialogElement>('dialog[open]');
        child?.close();node.close();isCompact?node.showModal():node.show();child?.showModal();
        if(focused&&node.contains(focused))focused.focus();
      }else if(!node.open){isCompact?node.showModal():node.show();}
    }else if(node?.open){node.close();returnFocus?.current?.isConnected&&returnFocus.current.focus();}
  });
  const canPublish=$derived(Boolean(user&&entry&&(user.role>=40||(user.role>=30&&entry.authorId===user.id))));
  const bylines=$derived(new Intl.ListFormat(display.locale,{type:'conjunction'}).format((entry?.bylines??[]).toSorted((a,b)=>a.sortOrder-b.sortOrder).map(c=>c.byline.displayName)));
  const others=$derived(translations.filter(translation=>translation.locale!==item?.locale));
  const edited=$derived(entry&&!Number.isNaN(Date.parse(entry.updatedAt))?formatTimeAgo(now-Date.parse(entry.updatedAt),display.locale):'—');
  const liveSince=$derived(entry?.publishedAt&&!Number.isNaN(Date.parse(entry.publishedAt))?display.formatDateTime(Date.parse(entry.publishedAt)):undefined);
  const liveUrl=$derived(item?.state==='published'&&entry?.slug?contentUrl(item.collection,entry.slug,urlPatterns[item.collection],{locale:item.locale,i18n,id:item.id,date:entry.publishedAt}):undefined);
  function refresh(selected:CalendarItem){
    void queryClient?.invalidateQueries({queryKey:['calendar']});
    void queryClient?.invalidateQueries({queryKey:['content',selected.collection]});
    void queryClient?.invalidateQueries({queryKey:['dashboard-stats']});
  }
  async function mutate(action:'publish'|'unschedule') {
    if(!item||pending)return;const selected=item;pending=true;error=undefined;
    try{
      if(action==='publish')await client.publishContent(selected.collection,selected.id,{locale:selected.locale,_rev:entry?._rev});
      else await client.unscheduleContent(selected.collection,selected.id,{locale:selected.locale});
      refresh(selected);
      onNotice?.(action==='publish'?{title:t("Published"),description:t("{title} is now live.",{title:selected.title})}:{title:t("Schedule removed"),description:selected.status==='published'?t("The scheduled changes to {title} stay as a draft.",{title:selected.title}):t("{title} is a draft again.",{title:selected.title})});
      if(item?.key===selected.key)onClose();
    }catch(cause){const description=cause instanceof Error?cause.message:t("An error occurred");if(item?.key===selected.key)error=description;onNotice?.({title:action==='publish'?t("Could not publish"):t("Could not remove the schedule"),description,type:'error'});}
    finally{if(item?.key===selected.key)pending=false;}
  }
  async function reschedule(at:string){
    if(!item)return;const selected=item;
    await client.scheduleContent(selected.collection,selected.id,at,{locale:selected.locale});
    refresh(selected);
    onNotice?.({title:t("Rescheduled"),description:t("{title} now goes live {when}.",{title:selected.title,when:display.formatDateTime(Date.parse(at))})});
    if(item?.key===selected.key)onRescheduled(selected,at);
  }
  async function openPreview(){
    if(!item||previewing)return;const selected=item;previewing=true;
    try{
      const result=await client.getPreviewUrl?.(selected.collection,selected.id);
      const fallback=contentUrl(selected.collection,entry?.slug||selected.id,urlPatterns[selected.collection],{locale:selected.locale,i18n,id:selected.id,date:entry?.publishedAt});
      window.open(result?.url??fallback,'_blank','noopener,noreferrer');
    }finally{if(item?.key===selected.key)previewing=false;}
  }
</script>
<dialog bind:this={dialog} closedby={compact?'any':'closerequest'} aria-label={item?.title} data-open={item?'':undefined} class:compact oncancel={event=>{event.preventDefault();onClose();}}>
{#if item}<div class="top"><span>{display.collection(item.collection).label}</span><button type="button" aria-label={t("Close")} onclick={onClose}>×</button></div>
<h2 dir="auto">{item.title}</h2><dl><dt>{t("State")}</dt><dd>{t(stateLabels[item.state])}</dd><dt>{item.kind==='scheduled'?item.state==='overdue'?t("Was due"):t("Goes live"):t("Published")}</dt><dd>{display.formatDateTime(item.time)}{#if display.viewerZoneDiffers}<small>{t("Your time: {viewerTime}",{viewerTime:display.formatViewerTime(item.time)})}</small>{/if}</dd>
{#if display.showLocale}<dt>{t("Locale")}</dt><dd>{new Intl.DisplayNames([display.locale],{type:'language'}).of(item.locale)} <small>{item.locale.toUpperCase()}</small>{#if others.length}<span class="translations">{t("Translations:")} {#each others as translation(translation.id)}<span title={new Intl.DisplayNames([display.locale],{type:'language'}).of(translation.locale)}>{translation.locale.toUpperCase()}</span>{/each}</span>{/if}</dd>{/if}
{#if bylines}<dt>{t("Bylines")}</dt><dd>{bylines}</dd>{/if}<dt>{t("Last edited")}</dt><dd>{edited}</dd></dl>
{#if item.kind==='scheduled'}<h3>{t("Publishing")}</h3>
  {#if item.state==='overdue'}<p class="overdue">{t("This entry was due {lateness} but hasn't published. Scheduled publishing may not be running.",{lateness:formatTimeAgo(now-item.time,display.locale)})}</p>
  {:else if item.state==='scheduled'}<ol class="timeline"><li>{t("Draft")}</li><li><strong>{t("Scheduled")}</strong><p>{t("Goes live {countdown}",{countdown:formatTimeUntil(item.time-now,display.locale)})}</p></li></ol>{:else if item.state==='update'}<ol class="timeline"><li><strong>{t("Live version")}</strong>{#if liveSince}<p>{t("Published {liveSince}",{liveSince})}</p>{/if}</li><li><strong>{t("Scheduled changes")}</strong><p>{t("Go live {countdown}",{countdown:formatTimeUntil(item.time-now,display.locale)})}</p></li></ol>{/if}
  {#if canPublish}<div class="actions">{#if item.state==='overdue'}<button type="button" disabled={pending} onclick={()=>void mutate('publish')}>{t("Publish now")}</button>{/if}<button type="button" disabled={pending} onclick={()=>scheduleOpen=true}>{t("Reschedule")}</button><button type="button" disabled={pending} onclick={()=>void mutate('unschedule')}>{t("Remove schedule")}</button></div>{/if}
{/if}
{#if error}<p role="alert">{error}</p>{/if}
<footer><a href={`${base}/content/${encodeURIComponent(item.collection)}/${encodeURIComponent(item.id)}?locale=${encodeURIComponent(item.locale)}`}>{t("Open in editor")}</a>{#if item.kind==='scheduled'}<button type="button" disabled={previewing} onclick={()=>void openPreview()}>{item.state==='update'?t("Preview changes"):t("Preview")}</button>{/if}{#if liveUrl}<a href={liveUrl} target="_blank" rel="noopener noreferrer">{t("View live")}</a>{/if}</footer>
{#if item.kind==='scheduled'&&canPublish}<ScheduleDialog open={scheduleOpen} entryKey={item.key} scheduledAt={item.at} isLive={item.status==='published'} locale={display.locale} onOpenChange={value=>scheduleOpen=value} onSchedule={reschedule}/>{/if}
{/if}</dialog>
<style>dialog{box-sizing:border-box;position:fixed;inset-block:0;inset-inline:auto 0;margin:0;border:0;border-left:1px solid var(--border,#ddd);width:27rem;max-width:100vw;height:100dvh;max-height:100dvh;background:var(--card,#fff);color:inherit;padding:1.5rem;box-shadow:-8px 0 24px #0002;z-index:50;}dialog:not([open]){display:none;}.compact{inset:auto 0 0;width:100%;height:auto;max-height:85dvh;border-radius:1rem 1rem 0 0;}dialog::backdrop{background:#0006;}.top{display:flex;justify-content:space-between;align-items:center;}h2{font-size:1.6rem;}dl{display:grid;grid-template-columns:8rem 1fr;gap:.9rem;}dt{color:var(--muted-foreground,#666);}dd{margin:0;}small{display:block;}button{font:inherit;padding:.5rem;border:1px solid var(--border,#ccc);border-radius:.35rem;background:var(--background,#fff);color:inherit;}button{cursor:pointer;}.actions{display:flex;flex-wrap:wrap;gap:.5rem;}.overdue{padding:.75rem;background:#fff0d6;}footer{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border,#ddd);}[role="alert"]{color:#b32929;}.timeline{padding-left:1.5rem;display:grid;gap:1rem;}.timeline p{margin:.35rem 0 0;}.translations{display:flex;gap:.5rem;flex-wrap:wrap;font-size:.75rem;margin-top:.25rem;}button:focus-visible,a:focus-visible{outline:2px solid var(--ring,#165ccc);outline-offset:2px;}</style>
