<script lang="ts">
 import type { CommentInboxProps, AdminComment, CommentStatus, BulkAction } from './types.ts';
 const props: CommentInboxProps = $props();
 let selected = $state(new Set<string>());
 let page = $state(0);
 let detail = $state<AdminComment|null>(null);
 let deleteId = $state<string|null>(null);
 let operationError = $state<unknown>(null);
 const labels:Record<CommentStatus,string>={pending:'Pending',approved:'Approved',spam:'Spam',trash:'Trash'};
 const empty:Record<CommentStatus,string>={pending:'No comments awaiting moderation.',approved:'No approved comments yet.',spam:'No spam comments.',trash:'Trash is empty.'};
 const pages=$derived(Math.max(1,Math.ceil(props.comments.length/20)));
 const rows=$derived(props.comments.slice(page*20,(page+1)*20));
 const all=$derived(rows.length>0&&rows.every(row=>selected.has(row.id)));
 $effect(()=>{props.activeStatus;props.collectionFilter;props.searchQuery;selected=new Set();page=0;});
 function toggle(id:string){const next=new Set(selected);if(next.has(id))next.delete(id);else next.add(id);selected=next;}
 function toggleAll(){const next=new Set(selected);for(const row of rows){if(all)next.delete(row.id);else next.add(row.id);}selected=next;}
 async function bulk(action:BulkAction){if(selected.size===0)return;try{await props.onBulkAction([...selected],action);selected=new Set();operationError=null;}catch(error){operationError=error;}}
 async function status(id:string,value:CommentStatus){detail=null;try{await props.onCommentStatusChange(id,value);selected=new Set();operationError=null;}catch(error){operationError=error;}}
 function askDelete(id:string){deleteId=id;detail=null;operationError=null;props.onDeleteErrorReset();}
 function closeDelete(){deleteId=null;operationError=null;props.onDeleteErrorReset();}
 async function remove(){if(!deleteId)return;try{await props.onCommentDelete(deleteId);deleteId=null;operationError=null;}catch(error){operationError=error;}}
 function describeError(error:unknown){return error instanceof Error?error.message:typeof error==='string'?error:'The operation could not be completed.';}
 function escape(event:KeyboardEvent){if(event.key==='Escape'&&!event.defaultPrevented){if(detail){event.preventDefault();detail=null;}else if(deleteId){event.preventDefault();closeDelete();}}}
</script>
<svelte:document onkeydown={escape}/>
<section aria-label="Comments" class="inbox">
 <header><h1>Comments</h1><p>Review and moderate comments across your content.</p></header>
 <div role="tablist" aria-label="Comment status" class="tabs">
  {#each Object.entries(labels) as [value,label]}
   <button type="button" role="tab" aria-selected={props.activeStatus===value} onclick={()=>props.onStatusChange(value as CommentStatus)}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d={value==='approved'?'m5 12 4 4 10-10':value==='pending'?'M12 4v8l5 3':value==='spam'?'M12 6v8m0 3v1':'M6 7h12m-10 0v13h8V7m-6-3h4'} fill="none" stroke="currentColor" stroke-width="2"/></svg>
    {label}{#if value!=='approved'&&props.counts[value as CommentStatus]>0}<span>{props.counts[value as CommentStatus]}</span>{/if}
   </button>
  {/each}
 </div>
 <div class="filters"><input type="search" aria-label="Search comments" placeholder="Search comments..." value={props.searchQuery} oninput={event=>props.onSearchChange(event.currentTarget.value)}/>
  {#if Object.keys(props.collections).length>1}<select aria-label="Filter by collection" value={props.collectionFilter} onchange={event=>props.onCollectionFilterChange(event.currentTarget.value)}><option value="">All collections</option>{#each Object.entries(props.collections) as [slug,collection]}<option value={slug}>{collection.label}</option>{/each}</select>{/if}
 </div>
 {#if selected.size>0}<div class="bulk"><strong>{selected.size} selected</strong><div>
  {#if props.activeStatus!=='approved'}<button onclick={()=>bulk('approve')}>Approve</button>{/if}
  {#if props.activeStatus!=='spam'}<button onclick={()=>bulk('spam')}>Spam</button>{/if}
  {#if props.activeStatus!=='trash'}<button onclick={()=>bulk('trash')}>Trash</button>{/if}
  {#if props.isAdmin}<button class="danger" onclick={()=>bulk('delete')}>Delete</button>{/if}
 </div></div>{/if}
 {#if operationError&&!deleteId}<p role="alert">{describeError(operationError)}</p>{/if}
 {#if props.isLoading&&props.comments.length===0}<p class="empty">Loading comments...</p>
 {:else if rows.length===0}<div class="empty"><p>{props.searchQuery||props.collectionFilter?'No comments match your filters.':empty[props.activeStatus]}</p><p>{props.searchQuery||props.collectionFilter?'Try a different search or collection filter.':'Comments with this status will appear here.'}</p></div>
 {:else}<div class="table-wrap"><table><thead><tr><th scope="col"><input type="checkbox" aria-label="Select all" checked={all} onchange={toggleAll}/></th><th scope="col">Author</th><th scope="col">Comment</th><th scope="col">Content</th><th scope="col">Date</th><th scope="col">Actions</th></tr></thead><tbody>
  {#each rows as comment (comment.id)}<tr class:selected={selected.has(comment.id)}>
   <td><input type="checkbox" aria-label={`Select comment by ${comment.authorName}`} checked={selected.has(comment.id)} onchange={()=>toggle(comment.id)}/></td>
   <td><button class="text" onclick={()=>detail=comment}><strong>{comment.authorName}</strong><small>{comment.authorEmail}</small></button></td>
   <td><button class="text" onclick={()=>detail=comment}>{comment.body.length>120?comment.body.slice(0,120)+'...':comment.body}</button></td>
   <td>{comment.collection}</td><td>{new Date(comment.createdAt).toLocaleDateString()}</td>
   <td><div class="actions">{#if comment.status!=='approved'}<button aria-label="Approve" disabled={props.isStatusPending} onclick={()=>status(comment.id,'approved')}>✓</button>{/if}{#if comment.status!=='spam'}<button aria-label="Mark as spam" disabled={props.isStatusPending} onclick={()=>status(comment.id,'spam')}>!</button>{/if}{#if comment.status!=='trash'}<button aria-label="Trash" disabled={props.isStatusPending} onclick={()=>status(comment.id,'trash')}>⌫</button>{/if}{#if props.isAdmin}<button aria-label="Delete permanently" class="danger" disabled={props.isStatusPending} onclick={()=>askDelete(comment.id)}>×</button>{/if}</div></td>
  </tr>{/each}
 </tbody></table></div>{/if}
 {#if pages>1||props.nextCursor}<footer><span>{props.comments.length} {props.comments.length===1?'comment':'comments'}</span><div><button aria-label="Previous page" disabled={page===0} onclick={()=>page--}>←</button><span>{page+1} / {pages}</span><button aria-label="Next page" disabled={page>=pages-1&&!props.nextCursor} onclick={()=>{if(page>=pages-1&&props.nextCursor)props.onLoadMore();page++;}}>→</button></div></footer>{/if}
</section>
{#if detail}<div class="overlay"><div class="detail" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="comment-detail-title"><header><h2 id="comment-detail-title">Comment Detail</h2><button aria-label="Close" onclick={()=>detail=null}>×</button></header><p>{detail.status} · {new Date(detail.createdAt).toLocaleString()}</p><h3>Author</h3><p>{detail.authorName}{#if detail.authorUserId} · Registered user{/if}</p><p>{detail.authorEmail}</p><h3>Comment</h3><p class="body">{detail.body}</p><h3>Content</h3><p>Collection: {detail.collection}</p><p>Content ID: {detail.contentId}</p>{#if detail.parentId}<p>Reply to: {detail.parentId}</p>{/if}{#if detail.moderationMetadata&&Object.keys(detail.moderationMetadata).length}<h3>Moderation Signals</h3><pre>{JSON.stringify(detail.moderationMetadata,null,2)}</pre>{/if}<div class="actions">{#if detail.status!=='approved'}<button disabled={props.isStatusPending} onclick={()=>status(detail!.id,'approved')}>Approve</button>{/if}{#if detail.status!=='spam'}<button disabled={props.isStatusPending} onclick={()=>status(detail!.id,'spam')}>Spam</button>{/if}{#if detail.status!=='trash'}<button disabled={props.isStatusPending} onclick={()=>status(detail!.id,'trash')}>Trash</button>{/if}{#if props.isAdmin}<button disabled={props.isStatusPending} class="danger" onclick={()=>askDelete(detail!.id)}>Delete Permanently</button>{/if}</div></div></div>{/if}
{#if deleteId}<div class="overlay"><div class="confirm" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="delete-comment-title"><h2 id="delete-comment-title">Delete Comment?</h2><p>This will permanently delete this comment. This action cannot be undone.</p>{#if props.deleteError||operationError}<p role="alert">{describeError(props.deleteError||operationError)}</p>{/if}<div class="actions"><button disabled={props.isStatusPending} onclick={closeDelete}>Cancel</button><button disabled={props.isStatusPending} class="danger" onclick={remove}>{props.isStatusPending?'Deleting...':'Delete'}</button></div></div></div>{/if}
<style>
 .inbox{display:grid;gap:1.25rem;color:var(--foreground,#17212e)}h1,h2,h3,p{margin:0}header p,.empty,small{color:var(--muted-foreground,#667085)}header p{margin-top:.45rem}.tabs,.filters,.actions,.bulk,.bulk>div,footer,footer>div{display:flex;align-items:center;gap:.5rem}.tabs{border-bottom:1px solid #d7dde5;flex-wrap:wrap}.tabs button{display:flex;gap:.4rem;align-items:center;border:0;border-bottom:2px solid transparent;border-radius:0}.tabs button[aria-selected=true]{border-color:#3b66cf;color:#315bbd}.tabs span{background:#e8edf5;border-radius:1rem;padding:.1rem .4rem}.filters input{flex:1}.bulk{justify-content:space-between;background:#f4f6fa;padding:.75rem;border-radius:.5rem}button,input,select{font:inherit}button{padding:.45rem .7rem;background:white;border:1px solid #d7dde5;border-radius:.35rem;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:hover:enabled{background:#f2f5fa}.text{display:block;text-align:start;border:0;background:none;padding:0}.text small{display:block;margin-top:.25rem}.danger{color:#a21c2e}.table-wrap{overflow:auto;border:1px solid #d7dde5;border-radius:.5rem}table{border-collapse:collapse;width:100%;text-align:start}td,th{padding:.8rem;border-bottom:1px solid #e4e8ed}th{text-align:start;font-weight:600;background:#f6f8fb}tr.selected{background:#edf3ff}.empty{text-align:center;padding:2.5rem}.empty p+p{margin-top:.5rem}footer{justify-content:space-between}.overlay{position:fixed;inset:0;background:#0005;z-index:40;display:flex;align-items:center;justify-content:center}.detail,.confirm{background:white;padding:1.5rem;border-radius:.6rem;box-shadow:0 8px 30px #0003;max-height:90vh;overflow:auto}.detail{margin-inline-start:auto;height:100%;width:min(32rem,100%);border-radius:0;display:grid;gap:1rem}.detail header{display:flex;justify-content:space-between;align-items:center}.confirm{max-width:28rem;display:grid;gap:1rem}.body{white-space:pre-wrap;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}.confirm .actions{justify-content:flex-end}input[type=search],select{padding:.5rem;border:1px solid #d7dde5;border-radius:.35rem}
</style>
