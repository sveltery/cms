<script lang="ts">
 import { untrack } from 'svelte';
 import type { RevisionPrecondition } from '../server/database/contract.ts';
 import type { CommentSettingsCollection,CommentSettingsInput } from './settings-types.ts';
 let {collection,onSave,disabled=false}:{collection:CommentSettingsCollection;onSave:(input:CommentSettingsInput,expected:RevisionPrecondition)=>Promise<CommentSettingsCollection>;disabled?:boolean}=$props();
 let saved=$state(untrack(()=>collection));
 let enabled=$state(untrack(()=>collection.commentsEnabled)),moderation=$state(untrack(()=>collection.commentsModeration)),days=$state(untrack(()=>collection.commentsClosedAfterDays)),autoApprove=$state(untrack(()=>collection.commentsAutoApproveUsers));
 let pending=$state(false),failure=$state<string|null>(null);
 const changed=$derived(enabled!==saved.commentsEnabled||moderation!==saved.commentsModeration||days!==saved.commentsClosedAfterDays||autoApprove!==saved.commentsAutoApproveUsers);
 const readonly=$derived(disabled||saved.source==='code');
 async function submit(event:SubmitEvent){event.preventDefault();if(readonly||pending||!changed)return;pending=true;failure=null;try{saved=await onSave({commentsEnabled:enabled,commentsModeration:moderation,commentsClosedAfterDays:days,commentsAutoApproveUsers:autoApprove},{version:saved.version,updatedAt:saved.updatedAt});}catch(error){failure=error instanceof Error?error.message:'Comment settings could not be saved.';}finally{pending=false;}}
 function setDays(event:Event){const parsed=Number.parseInt((event.currentTarget as HTMLInputElement).value,10);days=Number.isNaN(parsed)?0:Math.max(0,parsed);}
</script>
<h1>Comment settings · {collection.label}</h1>
{#if saved.source==='code'}<p>This collection is defined in code.</p>{/if}
{#if disabled}<p role="status">Settings changes are unavailable.</p>{/if}
<form onsubmit={submit} aria-label="Comment settings">
 <fieldset disabled={readonly||pending}><legend>Comments</legend>
  <label><input type="checkbox" bind:checked={enabled}/> Enable comments</label><p>Allow visitors to leave comments on this collection's content</p>
  {#if enabled}
   <label>Moderation<select bind:value={moderation}><option value="all">All comments require approval</option><option value="first_time">First-time commenters only</option><option value="none">No moderation (auto-approve all)</option></select></label>
   <label>Close comments after (days)<input type="number" min="0" value={days} oninput={setDays}/></label><p>Set to 0 to never close comments automatically.</p>
   <label><input type="checkbox" bind:checked={autoApprove}/> Auto-approve authenticated users</label><p>Comments from logged-in CMS users are approved automatically</p>
  {/if}
  {#if saved.source!=='code'}<button type="submit" disabled={!changed||pending}>{pending?'Saving...':changed?'Save':'Saved'}</button>{/if}
 </fieldset>
 {#if failure}<p role="alert">{failure}</p>{/if}
</form>
<style>fieldset{display:grid;gap:1rem;border:1px solid var(--border);border-radius:.5rem;padding:1.5rem;max-width:44rem}label{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}select,input[type="number"]{font:inherit;padding:.5rem;border:1px solid var(--border);border-radius:.35rem;background:var(--background);color:inherit}p{margin:0;color:var(--muted-foreground)}button{justify-self:start;padding:.6rem 1rem;font:inherit}[role="alert"]{margin-top:1rem;color:var(--destructive)}</style>
