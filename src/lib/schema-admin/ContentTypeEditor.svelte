<script lang="ts">
  import { untrack } from 'svelte';
  import FieldEditor from './FieldEditor.svelte';
  import RelationForm from './RelationForm.svelte';
  import RelationImpact from './RelationImpact.svelte';
  import { moveCollection } from './order';
  import { modal } from './modal';
  import * as defaultClient from './client';
  let { collection, isNew = false, isSaving = false, onSave, onAddField, onUpdateField, onDeleteField, onReorderFields,
    onCreateRelation, onUpdateRelation, onDeleteRelation, fieldEditor, client = defaultClient, disabled = false }: any = $props();
  const formId = $props.id();
  let label = $state(untrack(() => (collection?.label ?? ''))), labelSingular = $state(untrack(() => (collection?.labelSingular ?? ''))), slug = $state(untrack(() => (collection?.slug ?? ''))), description = $state(untrack(() => (collection?.description ?? ''))), urlPattern = $state(untrack(() => (collection?.urlPattern ?? '')));
  let routable = $state(untrack(() => (collection?.routable ?? true))), editLocking = $state(untrack(() => (collection?.editLocking ?? true))), hidden = $state(untrack(() => (collection?.hidden ?? false))), quickCreate = $state(untrack(() => (collection?.admin?.quickCreate ?? true)));
  let icon = $state(untrack(() => (collection?.icon ?? ''))), group = $state(untrack(() => (collection?.group ?? ''))), supports = $state<string[]>(untrack(() => ((collection?.supports ?? ['drafts','revisions']).filter((value: string) => value !== 'seo')))), hasSeo = $state(untrack(() => (collection?.hasSeo ?? false)));
  let commentsEnabled = $state(untrack(() => (collection?.commentsEnabled ?? false))), commentsModeration = $state(untrack(() => (collection?.commentsModeration ?? 'first_time'))), commentsClosedAfterDays = $state(untrack(() => (collection?.commentsClosedAfterDays ?? 90))), commentsAutoApproveUsers = $state(untrack(() => (collection?.commentsAutoApproveUsers ?? true)));
  let titleField = $state(untrack(() => collection?.titleField ?? '')), dateField = $state(untrack(() => collection?.dateField ?? ''));
  let listColumns = $state(untrack(() => collection?.admin?.listColumns?.join(',') ?? ''));
  let deleting = $state(false), deleteError = $state('');
  let saving = $state(false), saveError = $state('');
  const pending = $derived(isSaving || saving);
  let fieldOpen = $state(untrack(() => (false))), editingField = $state<any>(untrack(() => (undefined))), deleteTarget = $state<any>(untrack(() => (null))), deleteRelation = $state(untrack(() => (true))), relations = $state<any[]>(untrack(() => ([]))), collections = $state<any[]>(untrack(() => ([]))), relationDialog = $state<any>(untrack(() => (undefined))), relationDelete = $state<any>(untrack(() => (null))), relationError = $state(untrack(() => (''))), dragging = $state(untrack(() => ('')));
  const code = $derived(collection?.source === 'code'), locked = $derived(code || disabled);
  const fields = $derived(collection?.fields ?? []);
  const currentRelations = $derived(relations.filter(value => value.parentCollection === collection?.slug || value.childCollection === collection?.slug));
  const targetRelation = $derived(relations.find(value => value.slug === deleteTarget?.validation?.relation));
  const changes = $derived(isNew ? Boolean(label && slug) : Boolean(collection && (
    label !== collection.label || labelSingular !== (collection.labelSingular ?? '') || description !== (collection.description ?? '') || urlPattern !== (collection.urlPattern ?? '') || routable !== (collection.routable ?? true) || editLocking !== (collection.editLocking ?? true) || icon !== (collection.icon ?? '') || group !== (collection.group ?? '') || hidden !== (collection.hidden ?? false) || quickCreate !== (collection.admin?.quickCreate ?? true) || JSON.stringify([...supports].sort()) !== JSON.stringify(collection.supports.filter((value: string) => value !== 'seo').toSorted()) || hasSeo !== collection.hasSeo || commentsEnabled !== collection.commentsEnabled || commentsModeration !== collection.commentsModeration || commentsClosedAfterDays !== collection.commentsClosedAfterDays || commentsAutoApproveUsers !== collection.commentsAutoApproveUsers)));
  const displayChanged = $derived(titleField !== (collection?.titleField ?? '') || dateField !== (collection?.dateField ?? '') || listColumns !== (collection?.admin?.listColumns?.join(',') ?? ''));
  const patternValid = $derived(!urlPattern || (!isNew && urlPattern === collection?.urlPattern) || (urlPattern.includes('{slug}') && !/\{\w+\}[^/]*\{\w+\}/.test(urlPattern)));
  const saveLabel = $derived(pending ? 'Saving...' : changes || displayChanged ? 'Save' : 'Saved');
  $effect(() => {
    let active = true;
    void client.fetchRelations().then((value: any[]) => { if (active) relations = value; }).catch((cause: Error) => { if (active) relationError = cause.message; });
    void client.fetchCollections().then((value: any[]) => { if (active) collections = value; }).catch((cause: Error) => { if (active) relationError = cause.message; });
    return () => { active = false; };
  });
  function labelChange(value: string) { label = value; if (isNew) slug = value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
  async function submit(event: SubmitEvent) {
    event.preventDefault(); if (locked || pending || (!changes && !displayChanged) || !patternValid) return;
    saving = true; saveError = '';
    try {
    const common: any = {label,labelSingular:labelSingular || undefined,description:description || undefined,urlPattern:urlPattern || undefined,routable,editLocking,hidden,supports,hasSeo};
    if (isNew) await onSave({...common,slug,icon:icon.trim() || undefined,group:group.trim() || undefined,admin:quickCreate ? undefined : {quickCreate:false}});
    else await onSave({...common,icon:icon.trim(),group:group.trim() || null,
      admin:quickCreate !== (collection?.admin?.quickCreate ?? true) || listColumns !== (collection?.admin?.listColumns?.join(',') ?? '') ? {...collection?.admin,quickCreate:quickCreate ? undefined : false,...(listColumns !== (collection?.admin?.listColumns?.join(',') ?? '') ? {listColumns:listColumns.split(',').map((value: string) => value.trim()).filter(Boolean)} : {})} : undefined,
      ...(titleField !== (collection?.titleField ?? '') ? {titleField:titleField || null} : {}), ...(dateField !== (collection?.dateField ?? '') ? {dateField:dateField || null} : {}),
      commentsEnabled,commentsModeration,commentsClosedAfterDays,commentsAutoApproveUsers});
    } catch (cause) { saveError = cause instanceof Error ? cause.message : 'Content type could not be saved'; }
    finally { saving = false; }
  }
  function reorder(active: string, over: string) { const next = moveCollection(fields.map((value: any) => value.slug),active,over); onReorderFields?.(next); }
  async function fieldSave(input: any) { await (editingField ? onUpdateField?.(editingField.slug,input) : onAddField?.(input)); fieldOpen = false; editingField = undefined; }
  async function confirmFieldDelete() {
    if (!deleteTarget || deleting || locked) return;
    deleting = true; deleteError = '';
    try { await onDeleteField?.(deleteTarget.slug,targetRelation ? {deleteRelation} : undefined); deleteTarget = null; }
    catch (cause) { deleteError = cause instanceof Error ? cause.message : 'Field could not be deleted'; }
    finally { deleting = false; }
  }
  async function confirmRelationDelete() {
    if (!relationDelete || deleting || locked) return;
    deleting = true; deleteError = '';
    try { await onDeleteRelation?.(relationDelete.id); relationDelete = null; }
    catch (cause) { deleteError = cause instanceof Error ? cause.message : 'Relationship could not be deleted'; }
    finally { deleting = false; }
  }
  const systems = [['ID','id','Unique identifier (ULID)'],['Slug','slug','URL-friendly identifier'],['Status','status','draft, published, or archived'],['Created At','created_at','When the entry was created'],['Updated At','updated_at','When the entry was last modified'],['Published At','published_at','When the entry was published']];
</script>
<header class="sticky"><h1>{isNew ? 'New Content Type' : collection?.label}</h1>{#if !code && !isNew}<button type="submit" form={formId} disabled={disabled || pending || (!changes && !displayChanged) || !patternValid}>{saveLabel}</button>{/if}</header>
{#if !isNew}<p><code>{collection?.slug}</code></p>{/if}
{#if code}<p>This collection is defined in code. Some settings cannot be changed here. Edit your live.config.ts file to modify the schema.</p>{/if}
<form id={formId} onsubmit={submit}>
  <fieldset disabled={locked}>
    <legend>Settings</legend>
    <label>Label (Singular)<input value={labelSingular} oninput={event => { labelSingular = event.currentTarget.value; if (isNew) labelChange(labelSingular ? `${labelSingular}s` : ''); }} /></label>
    <label>Label (Plural)<input value={label} oninput={event => labelChange(event.currentTarget.value)} /></label>
    {#if isNew}<label>Slug<input bind:value={slug} /></label>{/if}
    <label>Description<textarea bind:value={description} placeholder="A brief description of this content type"></textarea></label>
    <label>URL Pattern<input bind:value={urlPattern} /></label>
    {#if !patternValid}<p role="alert">{urlPattern.includes('{slug}') ? 'Each path segment can contain at most one placeholder' : 'URL pattern must include {slug}'}</p>{/if}
    <label><input type="checkbox" bind:checked={routable} />Routable</label>
    <label><input type="checkbox" bind:checked={editLocking} />Edit locking</label>
    <label>Group<input bind:value={group} /></label><label>Icon<input bind:value={icon} /></label>
    <label><input type="checkbox" bind:checked={hidden} />Hide from navigation</label>
    <label><input role="switch" type="checkbox" bind:checked={quickCreate} />Quick action on the dashboard</label>
    {#each ['drafts','revisions','preview','search'] as support}<label><input type="checkbox" checked={supports.includes(support)} onchange={event => supports = event.currentTarget.checked ? [...supports,support] : supports.filter(value => value !== support)} />{support[0].toUpperCase() + support.slice(1)}</label>{/each}
    <label><input type="checkbox" bind:checked={hasSeo} />SEO</label>
    {#if !isNew}
      <label>Title field<select name="titleField" bind:value={titleField}><option value="">Default</option>{#each fields.filter((field: any) => ['string','text','slug'].includes(field.type)) as field}<option value={field.slug}>{field.label}</option>{/each}</select></label>
      <label>Date field<select name="dateField" bind:value={dateField}><option value="">Default</option>{#each fields.filter((field: any) => field.type === 'datetime') as field}<option value={field.slug}>{field.label}</option>{/each}</select></label>
      <label>List columns<input name="listColumns" bind:value={listColumns} placeholder="title, event" /></label>
      <label><input type="checkbox" bind:checked={commentsEnabled} />Enable comments</label>
      <label>Comment moderation<select bind:value={commentsModeration}><option value="all">All comments require approval</option><option value="first_time">First-time commenters only</option><option value="none">No moderation (auto-approve all)</option></select></label>
      <label>Close comments after days<input type="number" min="0" bind:value={commentsClosedAfterDays} /></label>
      <label><input type="checkbox" bind:checked={commentsAutoApproveUsers} />Auto-approve users</label>
    {/if}
  </fieldset>
  {#if saveError}<p role="alert">{saveError}</p>{/if}
  {#if !code}<button type="submit" disabled={disabled || pending || (!changes && !displayChanged) || !patternValid}>{isNew ? pending ? 'Saving...' : 'Create Content Type' : saveLabel}</button>{/if}
  {#if !isNew && !changes && !displayChanged}<span role="status">{pending ? 'Saving...' : 'Saved'}</span>{/if}
</form>
{#if !isNew}
<section><h2>Fields</h2><p>6 system + {fields.length} custom fields</p>{#if !locked}<button type="button" onclick={() => { editingField = undefined; fieldOpen = true; }}>Add Field</button>{/if}
  {#each fields as field (field.id)}<div role="group" aria-label={`Field ${field.label}`} class="field" ondragover={event => event.preventDefault()} ondrop={event => { event.preventDefault(); reorder(dragging,field.slug); dragging = ''; }}>
    {#if !locked}<button type="button" draggable="true" aria-label={`Reorder ${field.label} field`} ondragstart={() => dragging = field.slug}>↕</button>{/if}
    <span>{field.label}</span><code>{field.slug}</code><span>{field.unsupportedType?.type ?? field.type}</span>
    {#if field.unsupportedType}<span>Unsupported</span>{/if}{#if field.required}<span>Required</span>{/if}{#if field.unique}<span>Unique</span>{/if}{#if field.searchable}<span>Searchable</span>{/if}
    {#if !locked}<button type="button" disabled={Boolean(field.unsupportedType)} aria-label={`Edit ${field.label} field`} onclick={() => { editingField = field; fieldOpen = true; }}>Edit</button><button type="button" aria-label={`Delete ${field.label} field`} onclick={() => { deleteError = ''; deleteTarget = field; deleteRelation = true; }}>Delete</button>{/if}
  </div>{:else}<p>No custom fields yet</p><p>Add fields to define the structure of your content</p>{/each}
  <h3>System Fields</h3>{#each systems as system}<p>{system[0]} <code>{system[1]}</code> · <span>{system[2]}</span></p>{/each}
</section>
<section><h2>Relations</h2>{#if onCreateRelation && !locked}<button type="button" onclick={() => relationDialog = null}>New Relation</button>{/if}
  {#if relationError}<p role="alert">{relationError}</p>{/if}
  {#each currentRelations as relation}<article><code>{relation.slug}</code><p>{relation.parentCollection === collection.slug ? `Links to ${relation.childLabel}` : `Linked from ${relation.parentLabel}`}</p>
    {#if !relation.boundFields.some((value: any) => value.collectionSlug === collection.slug)}<p>No field on this content type uses it yet</p>{/if}
    {#if onUpdateRelation && !locked}<button type="button" onclick={() => relationDialog = relation}>Edit {relation.slug}</button>{/if}{#if onDeleteRelation && !locked}<button type="button" onclick={() => { deleteError = ''; relationDelete = relation; }}>Delete {relation.slug}</button>{/if}
  </article>{/each}
</section>
{/if}
{#if fieldOpen}{#if fieldEditor}{@render fieldEditor({open:fieldOpen,field:editingField,onOpenChange:(value: boolean) => fieldOpen = value,onSave:fieldSave,onCreateRelation,collectionSlug:collection?.slug})}{:else}<FieldEditor open={fieldOpen} field={editingField} onOpenChange={(value: boolean) => fieldOpen = value} onSave={fieldSave} {onCreateRelation} collectionSlug={collection?.slug} {client} />{/if}{/if}
{#if deleteTarget}<dialog open use:modal={() => { if (!deleting) deleteTarget = null; }} aria-label="Delete Field?"><h2>Delete Field?</h2><p>Delete {deleteTarget.label}?</p>{#if targetRelation}<label><input type="checkbox" disabled={deleting} bind:checked={deleteRelation} />Also delete the relationship this field uses</label><RelationImpact relations={[targetRelation]} excludeField={{collection:collection.slug,slug:deleteTarget.slug}} />{/if}{#if deleteError}<p role="alert">{deleteError}</p>{/if}<button type="button" disabled={deleting} onclick={() => deleteTarget = null}>Cancel</button><button type="button" disabled={deleting || locked} onclick={confirmFieldDelete}>{deleting ? 'Deleting...' : 'Delete'}</button></dialog>{/if}
{#if relationDialog !== undefined}<dialog open use:modal={() => relationDialog = undefined}><RelationForm {collections} relation={relationDialog} defaultParentCollection={collection?.slug} onCancel={() => relationDialog = undefined} onSubmit={async (input: any) => { if (relationDialog) await onUpdateRelation(relationDialog.id,input); else await onCreateRelation(input); relationDialog = undefined; }} /></dialog>{/if}
{#if relationDelete}<dialog open use:modal={() => { if (!deleting) relationDelete = null; }} aria-label="Delete Relation?"><h2>Delete Relation?</h2><RelationImpact relations={[relationDelete]} />{#if deleteError}<p role="alert">{deleteError}</p>{/if}<button type="button" disabled={deleting} onclick={() => relationDelete = null}>Cancel</button><button type="button" disabled={deleting || locked} onclick={confirmRelationDelete}>{deleting ? 'Deleting...' : 'Delete'}</button></dialog>{/if}
<style>header { display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:white;padding:12px; } form { max-inline-size:700px; } fieldset { border:1px solid #ddd;border-radius:12px;padding:20px; } label {display:block;margin-block:12px;} input:not([type='checkbox']),textarea,select {display:block;inline-size:100%;padding:8px;} .field {display:flex;align-items:center;gap:12px;padding:12px;border-block-end:1px solid #ddd;} dialog { border:1px solid #aaa;border-radius:12px;padding:24px;max-block-size:90vh;overflow-y:auto; } code {margin-inline:8px;} section {margin-block:24px;}</style>
