<script lang="ts">
 import { onMount } from 'svelte';
 import type { PublicComment } from '../server/comments/upstream/database/repositories/comment.ts';
 import { formatBody } from './body.ts';
 let {collection,contentId,comments=[],total=0,enabled=false,threaded=false,reactions=false,basePath=''}:{collection:string;contentId:string;comments?:PublicComment[];total?:number;enabled?:boolean;threaded?:boolean;reactions?:boolean;basePath?:string}=$props();
 let viewer=$state<Record<string,string[]>>({});
 let counts=$state<Record<string,Record<string,number>>>({});
 let pending=$state(new Set<string>());
 const endpoint=$derived(`${basePath}/api/comments/${encodeURIComponent(collection)}/${encodeURIComponent(contentId)}/reactions`);
 onMount(()=>{if(!enabled||!reactions)return;void fetch(endpoint,{headers:{'X-EmDash-Request':'1'}}).then(response=>response.ok?response.json():null).then(payload=>{if(payload?.data?.viewer){for(const [id,active] of Object.entries(payload.data.viewer as Record<string,string[]>)){viewer={...viewer,[id]:[...new Set([...(viewer[id]??[]),...active])]};}}}).catch(()=>{});});
 async function react(id:string){pending=new Set([...pending,id]);try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-EmDash-Request':'1'},body:JSON.stringify({commentId:id,reaction:'like'})});const payload=response.ok?await response.json():null;if(!payload?.data)return;viewer={...viewer,[id]:payload.data.reacted?['like']:[]};counts={...counts,[id]:payload.data.counts??{}};}catch{/* Source reaction script leaves its state unchanged on transport failure. */}finally{const next=new Set(pending);next.delete(id);pending=next;}}
 function date(value:string){return new Date(value).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'});}
</script>
{#snippet article(comment:PublicComment,reply=false)}
 <article class="ec-comment" class:ec-comment-reply={reply} id={`comment-${comment.id}`} data-comment-id={comment.id}>
  <header class="ec-comment-header"><span class="ec-comment-author">{comment.authorName}{#if comment.isRegisteredUser}<span class="ec-comment-badge" aria-label="Site member">✓</span>{/if}</span><time class="ec-comment-date" datetime={comment.createdAt}>{date(comment.createdAt)}</time></header>
  <div class="ec-comment-body">{@html formatBody(comment.body)}</div>
  {#if reactions}<div class="ec-comment-actions"><button type="button" class="ec-reaction" data-ec-reaction="like" data-comment-id={comment.id} aria-pressed={viewer[comment.id]?.includes('like')??false} disabled={pending.has(comment.id)} onclick={()=>react(comment.id)}><span class="ec-reaction-icon" aria-hidden="true">♡</span><span class="ec-reaction-label">Like</span><span class="ec-reaction-count" data-ec-reaction-count>{counts[comment.id]?.like??comment.reactions?.like??0}</span></button></div>{/if}
  {#if threaded&&!reply&&comment.replies?.length}<ol class="ec-comment-replies">{#each comment.replies as child (child.id)}<li>{@render article(child,true)}</li>{/each}</ol>{/if}
 </article>
{/snippet}
{#if enabled}<section class="ec-comments" aria-label="Comments" data-ec-comments data-collection={collection} data-content-id={contentId} data-ec-reactions={reactions?'':undefined}><h3 class="ec-comments-heading">{total===0?'No comments yet':total===1?'1 Comment':`${total} Comments`}</h3>{#if comments.length>0}<ol class="ec-comments-list">{#each comments as comment (comment.id)}<li>{@render article(comment)}</li>{/each}</ol>{/if}</section>{/if}

<style>
	.ec-comments {
		--ec-comment-gap: 1.5rem;
		--ec-comment-indent: 2rem;
		--ec-comment-border: 1px solid #e5e7eb;
	}

	.ec-comments-list,
	.ec-comment-replies {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.ec-comments-list > li + li {
		margin-top: var(--ec-comment-gap);
	}

	.ec-comment {
		padding-bottom: var(--ec-comment-gap);
		border-bottom: var(--ec-comment-border);
	}

	.ec-comment-replies {
		margin-top: var(--ec-comment-gap);
		padding-left: var(--ec-comment-indent);
	}

	.ec-comment-replies > li + li {
		margin-top: var(--ec-comment-gap);
	}

	.ec-comment-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.ec-comment-author {
		font-weight: 600;
	}

	:global(.ec-comment-author a) {
		color: inherit;
	}

	.ec-comment-badge {
		font-size: 0.75em;
		vertical-align: super;
	}

	.ec-comment-date {
		font-size: 0.875em;
		opacity: 0.6;
	}

	.ec-comment-body {
		margin-top: 0.5rem;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.ec-comment-actions {
		margin-top: 0.5rem;
	}

	.ec-reaction {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font: inherit;
		font-size: 0.875em;
		color: inherit;
		background: none;
		border: var(--ec-comment-border);
		border-radius: 999px;
		padding: 0.15rem 0.6rem;
		cursor: pointer;
	}

	.ec-reaction[aria-pressed="true"] {
		border-color: currentColor;
		font-weight: 600;
	}

	.ec-reaction[aria-pressed="true"] .ec-reaction-icon {
		color: #e0245e;
	}

	.ec-reaction:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.ec-reaction-count {
		font-variant-numeric: tabular-nums;
	}

</style>
