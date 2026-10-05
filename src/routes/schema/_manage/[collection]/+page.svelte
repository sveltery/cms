<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import ContentTypeEditor from '$lib/schema-admin/ContentTypeEditor.svelte';
  import { adminClient, type CollectionWithFields } from '$lib/schema-admin/runtime-client';
  let { data } = $props();
  let collection=$state<CollectionWithFields | null>(null), pending=$state(false), error=$state('');
  async function refresh() { collection=await adminClient.getCollection(page.params.collection ?? ''); }
  async function mutate(run:()=>Promise<unknown>) { if(pending)return; pending=true;error='';try{await run();await refresh();}catch(cause){error=cause instanceof Error?cause.message:'Schema could not be saved';throw cause;}finally{pending=false;} }
  $effect(()=>{
    const slug=page.params.collection ?? '';let active=true;collection=null;error='';
    void adminClient.getCollection(slug).then(value=>{if(active)collection=value;}).catch(cause=>{if(active)error=cause instanceof Error?cause.message:'Schema unavailable';});
    return()=>{active=false;};
  });
</script>
<svelte:head><title>{collection?.label ?? 'Content Type'} · Sveltery CMS</title></svelte:head>
<a href={resolve('/schema/_manage')}>Content Types</a>{#if error}<p role="alert">{error}</p>{/if}
{#if collection}{#key collection.slug}
<ContentTypeEditor {collection} isSaving={pending} disabled={!data.canMutateSchema}
  onSave={(input:unknown)=>mutate(()=>adminClient.updateCollection(collection!,input))}
  onAddField={(input:unknown)=>mutate(()=>adminClient.addField(collection!,input))}
  onUpdateField={(field:string,input:{slug?:string})=>mutate(()=>adminClient.updateField(collection!.slug,field,input))}
  onDeleteField={(field:string,options?:{deleteRelation?:boolean})=>mutate(()=>adminClient.deleteField(collection!.slug,field,options))}
  onReorderFields={(fields:string[])=>mutate(()=>adminClient.reorderFields(collection!.slug,fields))} />
{/key}{:else}<p role="status">Loading schema…</p>{/if}
