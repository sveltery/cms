<script lang="ts">
  import { useCalendarMessages } from './message-context.svelte.ts';
  const t = useCalendarMessages();
  // PublishingScheduleDialog context/submission behavior, EmDash1.1.0
  // pin913cb1bb; MIT notices/emdash-MIT.txt. Native browser dialog transport.
  import { untrack } from 'svelte';
  import { calendarMutationError, type CalendarInlineError } from './mutation-error.ts';
  import DialogError from './CalendarDialogError.svelte';
  import Fields from '../ui/PublishingDateTimeFields.svelte';
  import { publishingInstantToLocalFields,publishingFieldsMatchInstant,serializeFuturePublishingDateTime,type PublishingDateTimeError } from '../ui/publishing-datetime.ts';
  let { open,entryKey,scheduledAt=null,isLive=false,isPending=false,locale='en',onOpenChange,onSchedule }: {
    open:boolean;entryKey:string;scheduledAt?:string|null;isLive?:boolean;isPending?:boolean;locale?:string;
    onOpenChange:(open:boolean)=>void;onSchedule:(at:string)=>void|Promise<void>;
  }=$props();
  let date=$state<Date>(),time=$state(''),validationError=$state<string>(),mutationError=$state<CalendarInlineError|null>(),submitting=$state(false),dialog=$state<HTMLDialogElement>();
  let generation=0,activeSubmission:{entryKey:string;generation:number}|null=null,returnFocus:HTMLElement|null=null;
  const pending=$derived(isPending||submitting),isEditing=$derived(Boolean(scheduledAt));
  // Parent entry objects can refresh without changing the schedule context.
  // Only changed primitive entry/date values reset an in-progress form.
  const resetContext=$derived(JSON.stringify([entryKey,scheduledAt]));
  const title=$derived(isEditing?t("Change schedule"):isLive?t("Schedule changes"):t("Schedule publication"));
  const description=$derived(isLive?t("Choose when these changes replace the live version."):isEditing?t("Choose a new publication time for this draft."):t("Choose when this draft becomes public."));
  const submitLabel=$derived(isEditing?t("Save schedule"):isLive?t("Schedule changes"):t("Schedule"));
  function clearError(){validationError=undefined;mutationError=undefined;}
  function reset(){const fields=publishingInstantToLocalFields(scheduledAt);date=fields.date;time=fields.time;clearError();}
  $effect(()=>{resetContext;generation++;activeSubmission=null;submitting=false;untrack(reset);});
  $effect(()=>{const node=dialog;if(open&&node&&!node.open){returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;node.showModal();}else if(!open&&node?.open){node.close();if(returnFocus?.isConnected)returnFocus.focus();}});
  function changeOpen(next:boolean){if(!next&&!pending)reset();onOpenChange(next);}
  // Source translates once at submission; the rendered error retains its result.
  function validationMessage(error:PublishingDateTimeError){
    switch(error){
      case 'missing-date':return t('Choose a date');
      case 'missing-time':return t('Choose a time');
      case 'past':return t('Choose a time in the future');
      case 'nonexistent-time':return t('That time does not exist in your time zone');
      case 'invalid-date':case 'invalid-time':return t('Choose a valid date and time');
    }
  }
  async function submit(){
    if(pending||activeSubmission?.entryKey===entryKey)return;
    const result=serializeFuturePublishingDateTime(date,time);
    if(!result.success){validationError=validationMessage(result.error);return;}
    if(isEditing&&publishingFieldsMatchInstant(scheduledAt,date,time))return;
    clearError();const submission={entryKey,generation:++generation};activeSubmission=submission;submitting=true;
    try{await onSchedule(result.value);if(entryKey===submission.entryKey&&generation===submission.generation){reset();onOpenChange(false);}}
    catch(error){if(entryKey===submission.entryKey&&generation===submission.generation)mutationError=calendarMutationError(error);}
    finally{if(activeSubmission===submission)activeSubmission=null;if(entryKey===submission.entryKey&&generation===submission.generation)submitting=false;}
  }
</script>
<dialog bind:this={dialog} closedby="any" aria-labelledby="calendar-schedule-title" aria-describedby="calendar-schedule-description" oncancel={event=>{event.preventDefault();changeOpen(false);}}>
  <div class="heading"><h2 id="calendar-schedule-title">{title}</h2><button type="button" aria-label={t("Close")} onclick={()=>changeOpen(false)}>×</button></div>
  <p id="calendar-schedule-description">{description}</p>
  <form novalidate onsubmit={event=>{event.preventDefault();event.stopPropagation();void submit();}}>
    <Fields {date} {time} {locale} translate={t} disabled={pending} restrictToFuture dateAriaLabel={t("Schedule date")} onDateChange={value=>{date=value;clearError();}} onTimeChange={value=>{time=value;clearError();}}/>
    <DialogError message={validationError??(typeof mutationError==='string'?mutationError:mutationError?t(mutationError.message):undefined)}/>
    <footer><button type="button" onclick={()=>changeOpen(false)}>{t("Cancel")}</button><button type="submit" disabled={pending||(isEditing&&publishingFieldsMatchInstant(scheduledAt,date,time))}>{submitLabel}</button></footer>
  </form>
</dialog>
<style>
  dialog{box-sizing:border-box;border:1px solid var(--border,#ddd);border-radius:.75rem;background:var(--card,#fff);color:inherit;padding:1.5rem;width:29rem;max-width:calc(100vw - 2rem);max-height:90dvh;overflow:auto;box-shadow:0 1rem 4rem #0003;}dialog::backdrop{background:#0006;}.heading,footer{display:flex;justify-content:space-between;align-items:center;gap:1rem;}h2{font-size:1.25rem;margin:0;}p{font-size:.875rem;}form{display:grid;gap:1rem;}button{font:inherit;padding:.5rem .75rem;border:1px solid var(--border,#ccc);border-radius:.35rem;background:var(--background,#fff);color:inherit;cursor:pointer;}button:disabled{opacity:.5;cursor:default;}button:focus-visible{outline:2px solid var(--ring,#165ccc);outline-offset:2px;}
</style>
