<script lang="ts">
  // PublishingScheduleDialog context/submission behavior, EmDash1.1.0
  // pin913cb1bb; MIT notices/emdash-MIT.txt. Native browser dialog transport.
  import { untrack } from 'svelte';
  import Fields from '../ui/PublishingDateTimeFields.svelte';
  import { publishingInstantToLocalFields,publishingFieldsMatchInstant,serializeFuturePublishingDateTime } from '../ui/publishing-datetime.ts';
  let { open,entryKey,scheduledAt=null,isLive=false,isPending=false,locale='en',onOpenChange,onSchedule }: {
    open:boolean;entryKey:string;scheduledAt?:string|null;isLive?:boolean;isPending?:boolean;locale?:string;
    onOpenChange:(open:boolean)=>void;onSchedule:(at:string)=>void|Promise<void>;
  }=$props();
  let date=$state<Date>(),time=$state(''),validationError=$state<string>(),mutationError=$state<string>(),submitting=$state(false),dialog=$state<HTMLDialogElement>();
  let generation=0,activeSubmission:{entryKey:string;generation:number}|null=null,returnFocus:HTMLElement|null=null;
  const pending=$derived(isPending||submitting),isEditing=$derived(Boolean(scheduledAt));
  // Parent entry objects can refresh without changing the schedule context.
  // Only changed primitive entry/date values reset an in-progress form.
  const resetContext=$derived(JSON.stringify([entryKey,scheduledAt]));
  const title=$derived(isEditing?'Change schedule':isLive?'Schedule changes':'Schedule publication');
  const description=$derived(isLive?'Choose when these changes replace the live version.':isEditing?'Choose a new publication time for this draft.':'Choose when this draft becomes public.');
  const submitLabel=$derived(isEditing?'Save schedule':isLive?'Schedule changes':'Schedule');
  function clearError(){validationError=undefined;mutationError=undefined;}
  function reset(){const fields=publishingInstantToLocalFields(scheduledAt);date=fields.date;time=fields.time;clearError();}
  $effect(()=>{resetContext;generation++;activeSubmission=null;submitting=false;untrack(reset);});
  $effect(()=>{const node=dialog;if(open&&node&&!node.open){returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;node.showModal();}else if(!open&&node?.open){node.close();if(returnFocus?.isConnected)returnFocus.focus();}});
  function changeOpen(next:boolean){if(!next&&!pending)reset();onOpenChange(next);}
  async function submit(){
    if(pending||activeSubmission?.entryKey===entryKey)return;
    const result=serializeFuturePublishingDateTime(date,time);
    if(!result.success){validationError=result.error==='missing-date'?'Choose a date':result.error==='missing-time'?'Choose a time':result.error==='past'?'Choose a time in the future':result.error==='nonexistent-time'?'That time does not exist in your time zone':'Choose a valid date and time';return;}
    if(isEditing&&publishingFieldsMatchInstant(scheduledAt,date,time))return;
    clearError();const submission={entryKey,generation:++generation};activeSubmission=submission;submitting=true;
    try{await onSchedule(result.value);if(entryKey===submission.entryKey&&generation===submission.generation){reset();onOpenChange(false);}}
    catch(error){if(entryKey===submission.entryKey&&generation===submission.generation)mutationError=error instanceof Error?error.message:'Request failed';}
    finally{if(activeSubmission===submission)activeSubmission=null;if(entryKey===submission.entryKey&&generation===submission.generation)submitting=false;}
  }
</script>
<dialog bind:this={dialog} closedby="any" aria-labelledby="calendar-schedule-title" aria-describedby="calendar-schedule-description" oncancel={event=>{event.preventDefault();changeOpen(false);}}>
  <div class="heading"><h2 id="calendar-schedule-title">{title}</h2><button type="button" aria-label="Close" onclick={()=>changeOpen(false)}>×</button></div>
  <p id="calendar-schedule-description">{description}</p>
  <form novalidate onsubmit={event=>{event.preventDefault();event.stopPropagation();void submit();}}>
    <Fields {date} {time} {locale} disabled={pending} restrictToFuture dateAriaLabel="Schedule date" onDateChange={value=>{date=value;clearError();}} onTimeChange={value=>{time=value;clearError();}}/>
    {#if validationError||mutationError}<p role="alert">{validationError??mutationError}</p>{/if}
    <footer><button type="button" onclick={()=>changeOpen(false)}>Cancel</button><button type="submit" disabled={pending||(isEditing&&publishingFieldsMatchInstant(scheduledAt,date,time))}>{pending?'Saving…':submitLabel}</button></footer>
  </form>
</dialog>
<style>
  dialog{box-sizing:border-box;border:1px solid var(--border,#ddd);border-radius:.75rem;background:var(--card,#fff);color:inherit;padding:1.5rem;width:29rem;max-width:calc(100vw - 2rem);max-height:90dvh;overflow:auto;box-shadow:0 1rem 4rem #0003;}dialog::backdrop{background:#0006;}.heading,footer{display:flex;justify-content:space-between;align-items:center;gap:1rem;}h2{font-size:1.25rem;margin:0;}p{font-size:.875rem;}form{display:grid;gap:1rem;}button{font:inherit;padding:.5rem .75rem;border:1px solid var(--border,#ccc);border-radius:.35rem;background:var(--background,#fff);color:inherit;cursor:pointer;}button:disabled{opacity:.5;cursor:default;}button:focus-visible{outline:2px solid var(--ring,#165ccc);outline-offset:2px;}[role="alert"]{color:var(--destructive,#b32929);}
</style>
