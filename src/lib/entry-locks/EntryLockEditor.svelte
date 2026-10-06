<script lang="ts">
  import {onMount} from 'svelte';
  import type {EditorCollection} from '../server/content/manifest.ts';
  import type {EditorRecord} from '../editor/session.ts';
  import EditorForm from '../editor/EditorForm.svelte';
  import EntryLockNotice from './EntryLockNotice.svelte';
  import {createEntryLockController,type EntryLockSnapshot} from './controller.ts';
  import {acquireEntryLock,releaseEntryLock,entryLockRefusal} from './client.ts';
  import {nativeEntryLockWriteError} from './editor-error.ts';
  let {collection,definition,entry,canWrite,canTrash=false,isNew=false}:{
    collection:string;definition:EditorCollection;entry:EditorRecord;
    canWrite:boolean;canTrash?:boolean;isNew?:boolean;
  }=$props();
  let controller=$state<ReturnType<typeof createEntryLockController>>();
  let view=$state<EntryLockSnapshot>({state:{status:'pending'},readOnly:false,isTakingOver:false});
  const input=$derived({collection,entryId:entry.id,locale:entry.locale,ready:!isNew});
  onMount(()=>{
    const owned=createEntryLockController(input,{acquire:acquireEntryLock,release:releaseEntryLock,refusal:entryLockRefusal});
    const unsubscribe=owned.subscribe(()=>{view=owned.snapshot();});
    controller=owned;
    return()=>{owned.stop();unsubscribe();};
  });
  $effect(()=>{controller?.replace(input);});
  function reportWriteError(cause:unknown,writtenEntryId:string):boolean {
    return controller?.reportWriteError(nativeEntryLockWriteError(cause),writtenEntryId)??false;
  }
</script>

<EntryLockNotice state={view.state} isTakingOver={view.isTakingOver}
  onTakeOver={()=>controller?.takeOver()} onReadInstead={()=>controller?.readInstead()}/>
<EditorForm {collection} {definition} {entry} {isNew}
  canWrite={canWrite&&!view.readOnly} canTrash={canTrash&&!view.readOnly}
  onWriteError={reportWriteError}/>
