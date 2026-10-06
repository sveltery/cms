<script lang="ts">
  import type {EntryLockState} from './controller.ts';
  import {translateEntryLock as t,translateEntryLockRich} from './messages.ts';
  let {state,onTakeOver,onReadInstead,isTakingOver}:{state:EntryLockState;onTakeOver:()=>void;onReadInstead:()=>void;isTakingOver:boolean}=$props();
  let dialog=$state<HTMLDialogElement>();
  const holder=$derived(state.status==='blocked'||state.status==='reading'||state.status==='taken'?state.holder:null);
  const name=$derived(holder?.userName?.trim()?holder.userName:t('Another editor'));
  const explanation=$derived(translateEntryLockRich(state.status==='blocked'?'<0>{name}</0> is editing this entry. Open it read-only, or take over; they will be told the entry moved on.':state.status==='taken'?'<0>{name}</0> now holds this entry, so your changes are no longer being saved. Take it back to carry on.':'<0>{name}</0> is editing this entry. Nothing you change here will be saved.'));
  $effect(()=>{if(state.status==='blocked'&&dialog&&!dialog.open)dialog.showModal();});
</script>

{#if state.status==='blocked'}
  <dialog bind:this={dialog} role="alertdialog" aria-labelledby="entry-lock-title" aria-describedby="entry-lock-description"
    oncancel={event=>{event.preventDefault();onReadInstead();}}
    onclick={event=>{if(event.target===dialog)onReadInstead();}}>
    <h2 id="entry-lock-title" dir="auto">{t('This entry is open somewhere else')}</h2>
    <p id="entry-lock-description" dir="auto">{#each explanation as part}{#if typeof part==='string'}{part}{:else}<strong dir="auto">{name}</strong>{/if}{/each}</p>
    <div class="actions">
      <button type="button" onclick={onReadInstead}>{t('Open read-only')}</button>
      <button type="button" disabled={isTakingOver} onclick={onTakeOver}>{isTakingOver?t('Taking over...'):t('Take over')}</button>
    </div>
  </dialog>
{:else if state.status==='reading'||state.status==='taken'}
  <div role="alert" class="entry-lock-notice">
    <p dir="auto"><strong>{state.status==='taken'?t('You no longer hold this entry'):t('Read-only')}</strong></p>
    <p dir="auto">{#each explanation as part}{#if typeof part==='string'}{part}{:else}<strong dir="auto">{name}</strong>{/if}{/each}</p>
    <button type="button" disabled={isTakingOver} onclick={onTakeOver}>{isTakingOver?t('Taking over...'):t('Take over')}</button>
  </div>
{/if}

<style>
  dialog {max-width:30rem;border:1px solid var(--ui-line,#bbb);border-radius:.5rem;padding:1.5rem;color:inherit;background:var(--ui-surface,#fff);}
  dialog::backdrop {background:rgb(0 0 0 / .35);}
  .actions {display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.5rem;}
  .entry-lock-notice {border:1px solid var(--ui-line,#bbb);border-radius:.5rem;padding:1rem;background:var(--ui-warning,#fff7dc);}
</style>
