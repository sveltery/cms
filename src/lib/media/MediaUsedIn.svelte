<script lang="ts">
 // Native port of EmDash 1.1.0 MediaUsedIn; MIT notice: notices/emdash-MIT.txt.
 import {onDestroy,untrack} from 'svelte';
 import {InfiniteQueryObserver,QueryObserver,QueryClient,type InfiniteData,type InfiniteQueryObserverResult} from '@tanstack/react-query';
 import {MediaUsageAccessDeniedError,fetchManifest,fetchMediaUsageDetails,type MediaManifest,type MediaUsageDetailsResponse,type MediaUsageCoverageStatus,type MediaUsageEntryDetail} from './detail-api';
 let {mediaId,open,navigationBlocked=false,onEntryClick,queryClient:suppliedClient,locale='en'}:{
  mediaId:string;open:boolean;navigationBlocked?:boolean;onEntryClick?:(event:MouseEvent,entry:MediaUsageEntryDetail)=>void;queryClient?:QueryClient;locale?:string;
 }=$props();
 const ownClient=new QueryClient({defaultOptions:{queries:{staleTime:60000,retry:1}}});
 const queryClient=$derived(suppliedClient??ownClient),headingId=$props.id();
 let manifest=$state.raw<MediaManifest|undefined>(),usage=$state.raw<InfiniteQueryObserverResult<InfiniteData<MediaUsageDetailsResponse>,Error>>();
 type UsageObserver=InfiniteQueryObserver<MediaUsageDetailsResponse,Error,InfiniteData<MediaUsageDetailsResponse>,readonly ['media-usage',string],string|undefined>;
 let observer=$state.raw<UsageObserver>(),manifestObserver=$state.raw<QueryObserver<MediaManifest>>();
 function usageOptions(id:string,enabled:boolean):Parameters<UsageObserver['setOptions']>[0]{
  return{queryKey:['media-usage',id] as const,queryFn:({pageParam,signal})=>fetchMediaUsageDetails(id,{cursor:pageParam,limit:50,signal}),
   initialPageParam:undefined as string|undefined,getNextPageParam:page=>page.nextCursor,enabled,retry:false,
   refetchOnWindowFocus:false,refetchOnReconnect:false,refetchOnMount:'always',gcTime:0};
 }
 $effect(()=>{const client=queryClient;client.mount();return()=>client.unmount();});
 onDestroy(()=>ownClient.clear());
 $effect(()=>{
  const client=queryClient;
  const current=new QueryObserver<MediaManifest>(client,{queryKey:['manifest'],queryFn:fetchManifest,enabled:untrack(()=>open)});
  manifestObserver=current;const stop=current.subscribe(result=>manifest=result.data);manifest=current.getCurrentResult().data;
  return()=>{stop();current.destroy();};
 });
 $effect(()=>{
  const client=queryClient,id=mediaId;
  const current:UsageObserver=new InfiniteQueryObserver(client,usageOptions(id,untrack(()=>open)));
  observer=current;const stop=current.subscribe(result=>usage=result);usage=current.getCurrentResult();
  return()=>{stop();current.destroy();};
 });
 $effect(()=>{const enabled=open;if(observer)observer.setOptions(usageOptions(observer.options.queryKey[1],enabled));if(manifestObserver)manifestObserver.setOptions({...manifestObserver.options,enabled});});
 const pages=$derived(usage?.data?.pages??[]),entries=$derived(pages.flatMap(page=>page.items)),settings=$derived(pages[0]?.siteSettings??[]);
 const denied=$derived(usage?.error instanceof MediaUsageAccessDeniedError);
 function aggregate(statuses:readonly MediaUsageCoverageStatus[]):MediaUsageCoverageStatus|undefined{
  if(!statuses.length)return undefined;if(statuses.every(value=>value==='complete'))return'complete';
  for(const value of ['unknown','running','stale','partial'] as const)if(statuses.includes(value))return value;
  if(statuses.every(value=>value==='never'))return'never';if(statuses.every(value=>value==='failed'))return'failed';return'partial';
 }
 const coverage=$derived(aggregate(pages.map(page=>page.coverage.status)));
 const messages:Record<Exclude<MediaUsageCoverageStatus,'complete'>,string>={running:'Usage is updating. Some content may not appear here yet.',never:'Usage indexing hasn’t started.',stale:'Usage may be out of date.',partial:'Some content may not appear here yet.',failed:'Usage indexing couldn’t finish.',unknown:'Usage completeness couldn’t be verified.'};
 const coverageMessage=$derived(coverage&&coverage!=='complete'?messages[coverage]:'');
 const statusMessage=$derived(denied?'Usage details unavailable':usage?.isFetching?(pages.length?'Updating usage':'Loading usage'):pages.length?(coverageMessage||'Usage loaded'):'');
 const refreshError=$derived(usage?.isError&&pages.length>0&&!usage.isFetchNextPageError);
 const settingLabels={logo:'Logo',favicon:'Favicon','seo.defaultOgImage':'Default Social Image'};
 let tooltip=$state(false);
 function metadata(entry:MediaUsageEntryDetail){
  const label=manifest?.collections[entry.collection]?.label;
  const fields=[...new Set(entry.sources.flatMap(source=>source.occurrences.map(occurrence=>occurrence.fieldSlug)))].map(field=>manifest?.collections[entry.collection]?.fields[field]?.label||field);
  return{title:entry.title||entry.slug||'Untitled',titleDir:entry.title?'auto':entry.slug?'ltr':'auto',label:label||entry.collection,labelDir:label?'auto':'ltr',location:fields.length?new Intl.ListFormat(locale,{style:'short',type:'conjunction'}).format(fields):entry.slug||entry.contentId,locationDir:fields.length?'auto':'ltr',showLocale:Boolean(manifest?.i18n&&entry.locale)} as const;
 }
 function click(event:MouseEvent,entry:MediaUsageEntryDetail){if(navigationBlocked){event.preventDefault();return;}onEntryClick?.(event,entry);}
</script>
<section aria-labelledby={headingId} aria-busy={usage?.isFetching||undefined} data-testid="media-used-in">
 <div class="usage-heading"><h3 id={headingId}>Used in</h3>{#if coverageMessage}<span class="tooltip-owner"><button type="button" aria-label={coverageMessage} onmouseenter={()=>tooltip=true} onmouseleave={()=>tooltip=false} onfocus={()=>tooltip=true} onblur={()=>tooltip=false}>ⓘ</button>{#if tooltip}<span role="tooltip">{coverageMessage}</span>{/if}</span>{/if}</div>
 <p>See where this file is used.</p><span class="sr-only" role="status">{statusMessage}</span>
 {#if denied}<p>Usage details aren’t available for your account.</p>
 {:else if usage?.isLoading}<div class="usage-skeleton" aria-hidden="true"><div></div><div></div><div></div></div>
 {:else if usage?.isError&&pages.length===0}<div role="alert">Couldn’t load usage.<button onclick={()=>void observer?.refetch()}>Try again</button></div>
 {:else if pages.length}
  {#if refreshError}<div role="alert">Couldn’t load usage.<button onclick={()=>void observer?.refetch()}>Try again</button></div>{/if}
  {#if entries.length||settings.length}
   <ul class="p-0.5 usage-list">
    {#if settings.length}<li><div class="usage-row"><span><span>Site settings</span><span class="usage-meta" title={settings.map(setting=>settingLabels[setting.setting]).join(', ')}>{settings.map(setting=>settingLabels[setting.setting]).join(', ')}</span></span></div></li>{/if}
    {#each entries as entry (`${entry.collection}:${entry.contentId}`)}{@const meta=metadata(entry)}
     <li>{#snippet contents()}<span class="usage-copy"><span class="usage-title"><span dir={meta.titleDir}>{meta.title}</span>{#if entry.deletedAt}<span>In trash</span>{/if}</span><span class="usage-meta"><span dir={meta.labelDir}>{meta.label}</span><span aria-hidden="true"> · </span><span dir={meta.locationDir} translate={meta.locationDir==='ltr'?'no':undefined} title={meta.location}>{meta.location}</span>{#if meta.showLocale}<span aria-hidden="true"> · </span><span dir="ltr" translate="no">{entry.locale}</span>{/if}</span></span>{#if !entry.deletedAt}<span class="open-label">Open<svg class="rtl:-scale-x-100" aria-hidden="true" viewBox="0 0 16 16"><path d="M4 12 12 4M4 4h8v8" /></svg></span>{/if}{/snippet}
      {#if entry.deletedAt}<div class="usage-row">{@render contents()}</div>{:else}<a class="usage-row" href={`/content/${encodeURIComponent(entry.collection)}/${encodeURIComponent(entry.contentId)}${entry.locale?`?locale=${encodeURIComponent(entry.locale)}`:''}`} aria-disabled={navigationBlocked||undefined} onclick={event=>click(event,entry)} onauxclick={event=>{if(navigationBlocked)event.preventDefault();}} onkeydown={event=>{if(navigationBlocked&&event.key==='Enter')event.preventDefault();}}>{@render contents()}</a>{/if}
     </li>
    {/each}
   </ul>
  {:else if usage?.isSuccess&&!usage.isFetching}<div class="usage-empty"><p>{coverage==='complete'?'No tracked references found':'No usage to show yet'}</p><p>{coverage==='complete'?'Only image and file fields, images in rich text, and site settings are tracked. Custom rich text blocks and template code aren’t checked.':'Some content may not appear here yet.'}</p>{#if coverage==='complete'}<a href="https://docs.emdashcms.com/guides/media-library/#see-where-a-file-is-used" target="_blank" rel="noreferrer">What’s tracked</a>{/if}</div>{/if}
  {#if usage?.hasNextPage}<div>{#if usage.isFetchNextPageError}<p>Couldn’t load more usage.</p>{/if}<button disabled={usage.isFetchingNextPage} onclick={()=>void observer?.fetchNextPage()}>{usage.isFetchingNextPage?'Loading...':usage.isFetchNextPageError?'Try again':'Load more'}</button></div>{/if}
 {/if}
</section>
<style>
 section{display:flex;flex-direction:column;height:100%;min-height:0;gap:1rem}h3,p{margin:0}.usage-heading{display:flex;align-items:center;gap:.5rem}.usage-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:.75rem;overflow-y:auto;overscroll-behavior:contain;padding:.125rem;list-style:none;min-height:0;flex:1;margin:0}.usage-row{display:flex;align-items:center;gap:.75rem;padding:.75rem;text-decoration:none;color:inherit;border-radius:.5rem;background:white;box-shadow:0 0 0 1px #dfe3e9;min-width:0}.usage-copy{min-width:0;flex:1}.usage-title{display:flex;gap:.5rem;align-items:center}.usage-meta{display:block;font-size:.875rem;color:#596374}.usage-row[aria-disabled=true]{opacity:.6;cursor:not-allowed}.open-label{margin-inline-start:auto;display:flex;gap:.25rem;align-items:center}svg{width:1rem;height:1rem;fill:none;stroke:currentColor;stroke-width:1.5}:global([dir=rtl]) .open-label svg{transform:scaleX(-1)}.usage-empty{display:grid;text-align:center;justify-items:center;gap:.4rem;padding:3.5rem 1.5rem}.usage-skeleton{display:grid;gap:.5rem}.usage-skeleton>div{height:40px;background:#eef0f4;border-radius:.3rem}.tooltip-owner{position:relative;display:inline-flex}.tooltip-owner>[role=tooltip]{position:absolute;z-index:10;width:14rem;inset-block-start:100%;background:#172032;color:white;padding:.5rem;border-radius:.4rem}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}button{font:inherit;padding:.4rem .6rem;border:1px solid #c8ced8;border-radius:.4rem;background:white;color:inherit}
</style>
