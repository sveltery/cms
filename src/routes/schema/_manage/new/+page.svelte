<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import ContentTypeEditor from '$lib/schema-admin/ContentTypeEditor.svelte';
  import { adminClient } from '$lib/schema-admin/runtime-client';
  let { data } = $props();
  let pending=$state(false),error=$state('');
  async function save(input:unknown) { if(pending)return; pending=true;error='';try {const collection=await adminClient.createCollection(input);await goto(resolve('/schema/_manage/[collection]',{collection:collection.slug}));}catch(cause){error=cause instanceof Error?cause.message:'Content type could not be created';}finally{pending=false;} }
</script>
<svelte:head><title>New Content Type · Sveltery CMS</title></svelte:head>
<a href={resolve('/schema/_manage')}>Content Types</a>{#if error}<p role="alert">{error}</p>{/if}
<ContentTypeEditor isNew isSaving={pending} disabled={!data.canMutateSchema} relationsAvailable={false} onSave={save} />
