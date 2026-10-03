<script lang="ts">
 import Settings from './CommentSettings.svelte';
 import type { CommentSettingsCollection,CommentSettingsInput } from './settings-types.ts';
 let {data}:{data:{collection:CommentSettingsCollection;basePath:string;mutationsEnabled:boolean}}=$props();
 async function save(input:CommentSettingsInput,expected:{version:number;updatedAt:string}){
  const response=await fetch(`${data.basePath}/api/admin/comments/settings/${encodeURIComponent(data.collection.slug)}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({input,expected})});
  const payload=await response.json();if(!response.ok||!payload.success)throw new Error(payload.error?.message??'Comment settings could not be saved.');return payload.data as CommentSettingsCollection;
 }
</script>
{#key data.collection.slug}<Settings collection={data.collection} onSave={save} disabled={!data.mutationsEnabled}/>{/key}
