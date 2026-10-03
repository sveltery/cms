<script lang="ts">
 import {base} from '$app/paths';
 import {invalidateAll} from '$app/navigation';
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 import BlockTypeList from '$lib/ui/BlockTypeList.svelte';
 import BlockTypeEditor from '$lib/ui/BlockTypeEditor.svelte';
 import BlockSchemaFieldEditor from '$lib/ui/BlockSchemaFieldEditor.svelte';
 import {addBlockSchemaField} from '$lib/blocks.remote';
 import type {BlockType} from '$lib/server/schema/block-types';
 let {data}=$props();
 let editing=$state<BlockType>(),collection=$state(''),message=$state('');
 const definition=$derived(data.collections.find(item=>item.slug===collection));
 async function activate(type:BlockType,version:number){message='';try{const response=await fetch(`${base}/_emdash/api/schema/block-types/${type.slug}/versions/${version}/activate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedFingerprint:type.versions.find(item=>item.version===type.currentVersion)!.fingerprint})}),result=await response.json();if(!response.ok||!result.success)throw new Error(result.error?.message??'Version could not activate');await invalidateAll();}catch(cause){message=cause instanceof Error?cause.message:'Version could not activate';}}
</script>
<svelte:head><title>Block types · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={`${base}/`} activePage="blocks">
 <BlockTypeList blockTypes={data.blockTypes}/>
 {#if data.canManage}
  {#each data.blockTypes as type(type.slug)}<section><h3>{type.label}</h3><button type="button" onclick={()=>editing=type}>Edit {type.label}</button>{#each type.versions.filter(item=>!item.active) as version(version.version)}<button type="button" onclick={()=>void activate(type,version.version)}>Activate {type.label} version {version.version}</button>{/each}</section>{/each}
  {#key editing?.slug??'new'}<BlockTypeEditor type={editing} oncomplete={()=>editing=undefined}/>{/key}
  {#if editing}<button type="button" onclick={()=>editing=undefined}>Cancel edit</button>{/if}
  <BlockSchemaFieldEditor blockTypes={data.blockTypes} labelCaption="Block field label" formAttributes={addBlockSchemaField.enhance(async form=>{message='';try{await form.submit();await invalidateAll();message='Block field added';}catch(cause){message=cause instanceof Error?cause.message:'Block field could not save';}})}>
   {#snippet context()}
    <label>Collection<select name="collection" bind:value={collection} required><option value="">Choose a collection</option>{#each data.collections as item}<option value={item.slug}>{item.label}</option>{/each}</select></label>
    <input type="hidden" name="expectedSchemaVersion" value={definition?.version??1}/>
   {/snippet}
  </BlockSchemaFieldEditor>
  {#each addBlockSchemaField.fields.allIssues()??[] as issue}<p role="alert">{issue.message}</p>{/each}
 {/if}
 {#if message}<p role="status">{message}</p>{/if}
</WorkspaceShell>
<style>section{margin-block:24px}label{display:grid;gap:6px}input:not([type=checkbox]),select{padding:9px;font:inherit;border:1px solid #c4cedd;border-radius:6px}button{padding:9px 14px;margin-inline-end:8px;justify-self:start}</style>
