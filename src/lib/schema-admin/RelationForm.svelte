<script lang="ts">
  import { untrack } from 'svelte';
  import Choice from './Choice.svelte';
  import { singularize } from './singularize';
  let { collections = [], relation, defaultParentCollection = '', onSubmit, onCancel }: any = $props();
  let parentCollection = $state(untrack(() => (relation?.parentCollection ?? defaultParentCollection))), childCollection = $state(untrack(() => (relation?.childCollection ?? '')));
  let parentLabel = $state(untrack(() => (relation?.parentLabel ?? collections.find((value: any) => value.slug === defaultParentCollection)?.label ?? '')));
  let parentLabelSingular = $state(untrack(() => (relation?.parentLabelSingular ?? collections.find((value: any) => value.slug === defaultParentCollection)?.labelSingular ?? singularize(parentLabel))));
  let childLabel = $state(untrack(() => (relation?.childLabel ?? ''))), childLabelSingular = $state(untrack(() => (relation?.childLabelSingular ?? ''))), slug = $state(untrack(() => (relation?.slug ?? '')));
  let slugEdited = $state(untrack(() => (false))), edited = $state<Record<string,boolean>>(untrack(() => ({}))), pending = $state(untrack(() => (false))), error = $state(untrack(() => ('')));
  let maxChildren = $state(untrack(() => (String(relation?.maxChildrenPerParent ?? '')))), maxParents = $state(untrack(() => (String(relation?.maxParentsPerChild ?? ''))));
  function deriveSlug() { if (!relation && !slugEdited && parentLabel && childLabel) slug = `${parentLabel}_${childLabel}`.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
  function end(side: string, value: string) {
    const collection = collections.find((item: any) => item.slug === value), plural = collection?.label ?? value, singular = collection?.labelSingular || singularize(plural);
    if (side === 'parent') { parentCollection = value; if (!edited.parentLabel) parentLabel = plural; if (!edited.parentLabelSingular) parentLabelSingular = singular; }
    else { childCollection = value; if (!edited.childLabel) childLabel = plural; if (!edited.childLabelSingular) childLabelSingular = singular; }
    deriveSlug();
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault(); if (pending || !slug || !parentCollection || !childCollection || !parentLabel || !childLabel) return;
    pending = true; error = '';
    try { await onSubmit({slug,parentCollection,childCollection,parentLabel,parentLabelSingular,childLabel,childLabelSingular,maxChildrenPerParent:maxChildren ? Number(maxChildren) : null,maxParentsPerChild:maxParents ? Number(maxParents) : null}); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Relation could not be saved'; }
    finally { pending = false; }
  }
</script>
<h2>{relation ? `Edit ${relation.slug}` : 'New Relation'}</h2>
<form onsubmit={submit}>
  <Choice label="Links from" value={parentCollection} options={collections.map((value: any) => ({value:value.slug,label:value.label}))} disabled={Boolean(relation)} onchange={value => end('parent',value)} />
  <Choice label="Links to" value={childCollection} options={collections.map((value: any) => ({value:value.slug,label:value.label}))} disabled={Boolean(relation)} onchange={value => end('child',value)} />
  <label>Linking side (plural)<input bind:value={parentLabel} oninput={() => { edited.parentLabel = true; deriveSlug(); }} /></label>
  <label>Linking side (singular)<input bind:value={parentLabelSingular} oninput={() => edited.parentLabelSingular = true} /></label>
  <label>Linked side (plural)<input bind:value={childLabel} oninput={() => { edited.childLabel = true; deriveSlug(); }} /></label>
  <label>Linked side (singular)<input bind:value={childLabelSingular} oninput={() => edited.childLabelSingular = true} /></label>
  <label>Slug<input bind:value={slug} disabled={Boolean(relation)} oninput={() => slugEdited = true} /></label>
  <label>Maximum linked entries<input type="number" min="1" bind:value={maxChildren} /></label>
  <label>Maximum linking entries<input type="number" min="1" bind:value={maxParents} /></label>
  {#if error}<p role="alert">{error}</p>{/if}
  <button type="button" onclick={onCancel} disabled={pending}>Cancel</button>
  <button type="submit" disabled={pending || !slug || !parentCollection || !childCollection || !parentLabel || !childLabel}>{pending ? 'Saving...' : relation ? 'Save Relation' : 'Create Relation'}</button>
</form>
<style>label { display:block;margin-block:12px; } input { display:block;inline-size:100%;padding:8px; }</style>
