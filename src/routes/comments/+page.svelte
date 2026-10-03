<script lang="ts">
 import { untrack } from 'svelte';
 import { replaceState } from '$app/navigation';
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 import Inbox from '$lib/comments/CommentInbox.svelte';
 import type { AdminComment, CommentCounts, CommentStatus, BulkAction } from '$lib/comments/types.ts';
 let {data}=$props();
 let comments=$state<AdminComment[]>(untrack(()=>data.comments));
 let counts=$state<CommentCounts>(untrack(()=>data.counts));
 let nextCursor=$state<string|undefined>(untrack(()=>data.nextCursor));
 let activeStatus=$state<CommentStatus>(untrack(()=>data.activeStatus));
 let collectionFilter=$state(untrack(()=>data.collectionFilter));
 let searchQuery=$state(untrack(()=>data.searchQuery));
 let isLoading=$state(false),isStatusPending=$state(false),deleteError=$state<unknown>(null),loadError=$state<unknown>(null);
 let generation=0;
 const api=$derived(`${data.basePath}/api/admin/comments`);
 async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{const response=await fetch(api+path,{method,headers:body===undefined?{}:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error?.message??'The operation could not be completed.');return result.data;}
 async function reload(append=false){const current=++generation;isLoading=true;loadError=null;try{const query=new URLSearchParams({status:activeStatus,limit:'50'});if(collectionFilter)query.set('collection',collectionFilter);if(searchQuery)query.set('search',searchQuery);if(append&&nextCursor)query.set('cursor',nextCursor);const [items,totals]=await Promise.all([request<{items:AdminComment[];nextCursor?:string}>('?'+query),request<CommentCounts>('/counts')]);if(current!==generation)return;comments=append?[...comments,...items.items]:items.items;nextCursor=items.nextCursor;counts=totals;}catch(error){if(current===generation)loadError=error;}finally{if(current===generation)isLoading=false;}}
 function filter(){const query=new URLSearchParams({status:activeStatus});if(collectionFilter)query.set('collection',collectionFilter);if(searchQuery)query.set('search',searchQuery);replaceState('?' + query,{});void reload();}
 async function mutate(path:string,method:string,body?:unknown){isStatusPending=true;try{const result=await request(path,method,body);await reload();return result;}catch(error){deleteError=error;throw error;}finally{isStatusPending=false;}}
 function onStatusChange(status:CommentStatus){activeStatus=status;filter();}
 function onCollectionFilterChange(collection:string){collectionFilter=collection;filter();}
 function onSearchChange(search:string){searchQuery=search;filter();}
 function onCommentStatusChange(id:string,status:CommentStatus){return mutate(`/${encodeURIComponent(id)}/status`,'PUT',{status});}
 function onCommentDelete(id:string){return mutate(`/${encodeURIComponent(id)}`,'DELETE');}
 function onBulkAction(ids:string[],action:BulkAction){return mutate('/bulk','POST',{ids,action});}
</script>
<svelte:head><title>Comments · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={`${data.basePath}/`} activePage="settings">
 {#snippet additionalNavigation()}<a href={`${data.basePath}/comments`} aria-current="page">Comments</a>{/snippet}
 {#if !data.available}<h1>Comments</h1><p role="status">Comments are unavailable.</p>{:else}
 {#if loadError}<p role="alert">{loadError instanceof Error?loadError.message:'Comments could not be loaded.'}</p><button onclick={()=>reload()}>Try again</button>{/if}
 <Inbox {comments} {counts} {nextCursor} collections={data.collections} {activeStatus} {collectionFilter} {searchQuery} {isLoading} {isStatusPending} {deleteError} isAdmin={data.isAdmin} {onStatusChange} {onCollectionFilterChange} {onSearchChange} {onCommentStatusChange} {onCommentDelete} {onBulkAction} onLoadMore={()=>{void reload(true);}} onDeleteErrorReset={()=>deleteError=null}/>
 {/if}
</WorkspaceShell>
