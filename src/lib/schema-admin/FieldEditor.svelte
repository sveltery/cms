<script lang="ts">
  import { untrack } from 'svelte';
  import { base } from '$app/paths';
  // EmDash 1.1.0 FieldEditor behavior; Copyright 2026 Cloudflare Inc. MIT.
  import Choice from './Choice.svelte';
  import RelationForm from './RelationForm.svelte';
  import { singularize } from './singularize';
  import * as defaultClient from './client';
  import { modal } from './modal';
  let { open = false, onOpenChange, onSave, field, isSaving = false, collectionSlug, onCreateRelation,
    client = defaultClient, relationsHref = `${base}/schema/relations`, relationsAvailable = true }: any = $props();
  const types = [
    ['string','Short Text','Single line text input'],['text','Long Text','Multi-line plain text'],
    ['number','Number','Decimal number'],['integer','Integer','Whole number'],['boolean','Boolean','True/false toggle'],
    ['datetime','Date & Time','Date and time picker'],['select','Select','Single choice from options'],
    ['multiSelect','Multi Select','Multiple choices from options'],['portableText','Rich Text','Rich text editor'],
    ['image','Image','Image from media library'],['file','File','File from media library'],
    ['reference','Reference','Link to another content item'],['json','JSON','Arbitrary JSON data'],
    ['slug','Slug','URL-friendly identifier'],['url','URL','Web address'],['repeater','Repeater','Repeating group of fields'],['blocks','Blocks','Ordered content blocks']
  ];
  // Pinned FieldEditor UI menu; importing $lib/server metadata into the browser is forbidden.
  const repeaterTypes = ['string','text','number','integer','boolean','datetime','select','url','image'].map(value => types.find(type => type[0] === value)!);
  const searchableTypes = new Set(['string','text','portableText','slug','url']);
  const indexedTypes = new Set(['string','url','number','integer','boolean','datetime','select','slug']);
  let step = $state(untrack(() => (field ? 'config' : 'type'))), selectedType = $state(untrack(() => (field?.type ?? '')));
  let label = $state(untrack(() => (field?.label ?? ''))), slug = $state(untrack(() => (field?.slug ?? ''))), labelEdited = $state(untrack(() => (Boolean(field))));
  let required = $state(untrack(() => (field?.required ?? false))), unique = $state(untrack(() => (field?.unique ?? false))), searchable = $state(untrack(() => (field?.searchable ?? false))), indexed = $state(untrack(() => (field?.indexed ?? false)));
  let minLength = $state(untrack(() => (String(field?.validation?.minLength ?? '')))), maxLength = $state(untrack(() => (String(field?.validation?.maxLength ?? ''))));
  let min = $state(untrack(() => (String(field?.validation?.min ?? '')))), max = $state(untrack(() => (String(field?.validation?.max ?? '')))), pattern = $state(untrack(() => (field?.validation?.pattern ?? '')));
  let options = $state(untrack(() => (field?.validation?.options?.join('\n') ?? ''))), subFields = $state<any[]>(untrack(() => (field?.validation?.subFields?.map((value: any) => ({ ...value, ...(value.options ? { options: [...value.options] } : {}) })) ?? [])));
  let minItems = $state(untrack(() => (String(field?.validation?.minItems ?? '')))), maxItems = $state(untrack(() => (String(field?.validation?.maxItems ?? ''))));
  let allowedMimeTypes = $state<string[]>(untrack(() => (field?.validation?.allowedMimeTypes ?? []))), darkVariant = $state(untrack(() => (field?.options?.darkVariant === true)));
  let targetCollection = $state(untrack(() => (field?.validation?.targetCollection ?? field?.options?.collection ?? ''))), multiple = $state(untrack(() => (field?.validation?.multiple ?? false)));
  let relation = $state(untrack(() => (field?.validation?.relation ?? ''))), relationSide = $state(untrack(() => (field?.validation?.relationSide ?? 'parent')));
  let allowedTypes = $state<string[]>(untrack(() => (field?.validation?.allowedTypes ?? []))), relations = $state<any[]>(untrack(() => ([]))), collections = $state<any[]>(untrack(() => ([]))), blockTypes = $state<any[]>(untrack(() => ([]))), error = $state(untrack(() => ('')));
  $effect(() => {
    if (!open || selectedType !== 'reference') return;
    let active = true;
    void client.fetchCollections().then((value: any[]) => { if (active) collections = value; }).catch((cause: Error) => { if (active) error = cause.message; });
    void client.fetchRelations().then((value: any[]) => { if (active) relations = value; }).catch((cause: Error) => { if (active) error = cause.message; });
    return () => { active = false; };
  });
  $effect(() => {
    if (!open || selectedType !== 'blocks') return;
    let active = true; void client.fetchBlockTypes().then((value: any[]) => { if (active) blockTypes = value; }).catch((cause: Error) => { if (active) error = cause.message; });
    return () => { active = false; };
  });
  function sides(rel: any): string[] {
    const taken = new Set(rel.boundFields.map((item: any) => item.side));
    return [...(rel.parentCollection === collectionSlug && !taken.has('parent') ? ['parent'] : []), ...(rel.childCollection === collectionSlug && !taken.has('child') ? ['child'] : [])];
  }
  const candidates = $derived(relations.filter(rel => sides(rel).length));
  const selectedRelation = $derived(candidates.find(rel => rel.slug === relation));
  const effectiveSide = $derived(selectedRelation && sides(selectedRelation).length === 1 ? sides(selectedRelation)[0] : relationSide);
  const boundTarget = $derived(selectedRelation ? (effectiveSide === 'parent' ? selectedRelation.childCollection : selectedRelation.parentCollection) : '');
  const bound = $derived(typeof field?.validation?.relation === 'string');
  const showDetails = $derived(selectedType !== 'reference' || Boolean(field) || Boolean(selectedRelation));
  const typeInfo = $derived(types.find(type => type[0] === selectedType));
  function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
  function updateSubFieldLabel(index: number, value: string) {
    // Pinned FieldEditor.tsx:1208–1219 derives the slug on every label edit.
    subFields[index] = {...subFields[index],label:value,slug:slugify(value)};
  }
  function nameRelation(rel: any, side: string) {
    if (!rel || labelEdited) return;
    label = side === 'parent' ? rel.childLabel : rel.parentLabel; slug = slugify(label);
  }
  function chooseRelation(value: string) { relation = value; relationSide = sides(candidates.find(rel => rel.slug === value) ?? {boundFields:[]})[0] ?? 'parent'; nameRelation(candidates.find(rel => rel.slug === value), relationSide); }
  async function save() {
    if (!selectedType || !label || !slug || (selectedType === 'repeater' && !subFields.length)) return;
    if (selectedType === 'reference' && !relation && !targetCollection) { error = 'A referenced collection is required'; return; }
    const validation: Record<string, unknown> = {};
    if (['string','text','slug'].includes(selectedType)) { if (minLength) validation.minLength = parseInt(minLength,10); if (maxLength) validation.maxLength = parseInt(maxLength,10); if (pattern) validation.pattern = pattern; }
    if (['number','integer'].includes(selectedType)) { if (min) validation.min = parseFloat(min); if (max) validation.max = parseFloat(max); }
    if (['select','multiSelect'].includes(selectedType)) { const values = options.split('\n').map((value: string) => value.trim()).filter(Boolean); if (values.length) validation.options = values; }
    if (selectedType === 'repeater') { if (subFields.length) validation.subFields = subFields.map(value => ({...value,required:value.required || undefined})); if (minItems) validation.minItems = parseInt(minItems,10); if (maxItems) validation.maxItems = parseInt(maxItems,10); }
    if (selectedType === 'blocks') { validation.allowedTypes = allowedTypes; if (minItems) validation.minItems = parseInt(minItems,10); if (maxItems) validation.maxItems = parseInt(maxItems,10); }
    if (['file','image'].includes(selectedType) && allowedMimeTypes.length) validation.allowedMimeTypes = allowedMimeTypes;
    if (selectedType === 'reference') { if (relation && relation !== 'create:relation') { validation.relation = relation; validation.relationSide = effectiveSide; } else { validation.targetCollection = targetCollection; validation.multiple = multiple; } }
    const input: any = {slug,label,type:selectedType,required,unique,searchable:searchableTypes.has(selectedType) ? searchable : undefined,indexed:indexedTypes.has(selectedType) ? indexed : false,validation:Object.keys(validation).length ? validation : null};
    if (selectedType === 'image') { input.options = {...field?.options}; delete input.options.darkVariant; if (darkVariant) input.options.darkVariant = true; }
    try { await onSave(input); } catch(cause) { error = cause instanceof Error ? cause.message : 'Field could not be saved'; }
  }
</script>
{#if open}
<dialog open use:modal={() => { if(!isSaving)onOpenChange(false); }} aria-label={step === 'type' ? 'Add Field' : 'Configure Field'}>
  {#if step === 'relation'}
    <RelationForm {collections} defaultParentCollection={collectionSlug} onCancel={() => step = 'config'} onSubmit={async (input: any) => {
      const created = await onCreateRelation(input); const value = {...created,boundFields:[],linkCount:0}; relations = [...relations,value]; relation = value.slug; relationSide = sides(value)[0] ?? 'parent'; nameRelation(value,relationSide); step = 'config';
    }} />
  {:else}
    <h2>{step === 'type' ? 'Add Field' : field ? 'Edit Field' : 'Configure Field'}</h2>
    {#if !relationsAvailable && (step === 'type' || selectedType === 'reference')}<p role="status">Reference fields require available relationship management</p>{/if}
    {#if step === 'type'}
      <div class="types">{#each types as type}<button type="button" disabled={type[0] === 'reference' && !relationsAvailable} onclick={() => { selectedType = type[0]; step = 'config'; }}>{type[1]} {type[2]}</button>{/each}</div>
    {:else}
      <div data-testid="field-editor-config-content" class="max-h-[60vh] overflow-y-auto">
        <p>{typeInfo?.[1]}</p><p>{typeInfo?.[2]}</p>{#if !field}<button type="button" onclick={() => step = 'type'}>Change</button>{/if}
        {#if selectedType === 'reference'}
          <Choice label="Relationship" value={relation} options={[
            ...candidates.map(rel => ({value:rel.slug,label:rel.slug})),
            ...(field ? [{value:'',label:'Quick create a relationship'}] : onCreateRelation ? [{value:'create:relation',label:'Create relation'}] : [])
          ]} disabled={bound} onchange={chooseRelation} />
          {#if selectedRelation || field}
            <Choice label="Referenced collection" value={boundTarget || targetCollection} options={collections.map(value => ({value:value.slug,label:value.label}))} disabled={bound || Boolean(selectedRelation)} onchange={value => targetCollection = value} />
          {/if}
          {#if selectedRelation && sides(selectedRelation).length > 1}
            <Choice label="This field picks" value={effectiveSide} options={[{value:'parent',label:'Entries this one links to'},{value:'child',label:'Entries that link to this one'}]} onchange={value => { relationSide = value; nameRelation(selectedRelation,value); }} />
          {/if}
          {#if selectedRelation}
            <p>{effectiveSide === 'parent' ? `This field will show the ${selectedRelation.childLabel} this ${selectedRelation.parentLabelSingular || singularize(selectedRelation.parentLabel)} links to` : `This field will show the ${selectedRelation.parentLabelSingular || singularize(selectedRelation.parentLabel)} linking to this ${selectedRelation.childLabelSingular || singularize(selectedRelation.childLabel)}`}</p>
          {/if}
          <a href={relationsHref}>Create the relationship yourself</a>
          {#if field}<p>{bound ? 'The relationship and the referenced collection cannot be changed' : 'Saving a collection here turns this field into an entry picker'}</p>{/if}
        {/if}
        {#if showDetails}
          <label>Label<input value={label} oninput={event => { label = event.currentTarget.value; labelEdited = true; if (!field) slug = slugify(label); }} /></label>
          <label>Slug<input bind:value={slug} disabled={Boolean(field)} /></label>
          {#if field}<p>Field slugs cannot be changed after creation</p>{/if}
          {#if selectedType !== 'blocks'}<label><input type="checkbox" bind:checked={required} />Required</label><label><input type="checkbox" bind:checked={unique} />Unique</label>{/if}
          {#if searchableTypes.has(selectedType)}<label><input type="checkbox" bind:checked={searchable} />Searchable</label>{/if}
          {#if indexedTypes.has(selectedType)}<label><input type="checkbox" bind:checked={indexed} />Indexed</label>{/if}
          {#if ['string','text','slug','number','integer'].includes(selectedType)}<h3>Validation</h3>{/if}
          {#if ['string','text','slug'].includes(selectedType)}<label>Min Length<input value={minLength} oninput={event => minLength = event.currentTarget.value} type="number" /></label><label>Max Length<input value={maxLength} oninput={event => maxLength = event.currentTarget.value} type="number" /></label>{/if}
          {#if ['string','slug'].includes(selectedType)}<label>Pattern (Regex)<input bind:value={pattern} /></label>{/if}
          {#if ['number','integer'].includes(selectedType)}<label>Min Value<input value={min} oninput={event => min = event.currentTarget.value} type="number" /></label><label>Max Value<input value={max} oninput={event => max = event.currentTarget.value} type="number" /></label>{/if}
          {#if ['select','multiSelect'].includes(selectedType)}<label>Options (one per line)<textarea bind:value={options} placeholder="Option 1"></textarea></label>{/if}
          {#if selectedType === 'reference' && !selectedRelation}<label><input type="checkbox" bind:checked={multiple} />Allow multiple</label>{/if}
          {#if ['file','image'].includes(selectedType)}<h3>Allowed types</h3><label>MIME types<textarea value={allowedMimeTypes.join('\n')} oninput={event => allowedMimeTypes = event.currentTarget.value.split('\n').map(value => value.trim()).filter(Boolean)}></textarea></label>{#each allowedMimeTypes as mime}<span>{mime}</span>{/each}{/if}
          {#if selectedType === 'image'}<label><input role="switch" type="checkbox" bind:checked={darkVariant} />Dark mode variant</label>{/if}
          {#if selectedType === 'repeater'}
            {#each subFields as subField,index}<fieldset><label>Sub-field label<input value={subField.label} oninput={event => updateSubFieldLabel(index,event.currentTarget.value)} /></label><label>Sub-field slug<input bind:value={subField.slug} /></label><label>Sub-field type<select bind:value={subField.type}>{#each repeaterTypes as type}<option value={type[0]}>{type[1]}</option>{/each}</select></label><label><input type="checkbox" bind:checked={subField.required} />Required</label><button type="button" onclick={() => subFields = subFields.filter((_,i) => i !== index)}>Remove sub-field</button></fieldset>{/each}
            <button type="button" onclick={() => subFields = [...subFields,{slug:'',label:'',type:'string',required:false}]}>Add sub-field</button>
          {/if}
          {#if ['repeater','blocks'].includes(selectedType)}<label>Minimum {selectedType === 'blocks' ? 'blocks' : 'items'}<input value={minItems} oninput={event => minItems = event.currentTarget.value} type="number" /></label><label>Maximum {selectedType === 'blocks' ? 'blocks' : 'items'}<input value={maxItems} oninput={event => maxItems = event.currentTarget.value} type="number" /></label>{/if}
          {#if selectedType === 'blocks'}
            {#each blockTypes as block}<fieldset><label><input type="checkbox" checked={allowedTypes.includes(block.slug)} onchange={event => allowedTypes = event.currentTarget.checked ? [...allowedTypes,block.slug] : allowedTypes.filter(value => value !== block.slug)} />{block.label}</label>{#each block.versions as version}<p>{version.active ? `Active v${version.version}` : `v${version.version}`}</p><span>{version.fingerprint.split(':').at(-1).slice(0,8)}</span>{/each}</fieldset>{/each}
          {/if}
        {/if}
      </div>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
    <footer><button type="button" disabled={isSaving} onclick={() => onOpenChange(false)}>Cancel</button>
      {#if relation === 'create:relation' && selectedType === 'reference'}<button type="button" onclick={() => step = 'relation'}>Next</button>
      {:else if step === 'config'}<button type="button" disabled={isSaving || !label || !slug || (selectedType === 'repeater' && !subFields.length) || (selectedType === 'reference' && !relationsAvailable)} onclick={save}>{isSaving ? 'Saving...' : field ? 'Update Field' : 'Add Field'}</button>{/if}
    </footer>
  {/if}
</dialog>
{/if}
<style>dialog { position: fixed; inset: 5vh auto auto; inline-size: min(680px,90vw); max-block-size: 90vh; border: 1px solid #aab; border-radius: 12px; padding: 24px; z-index: 20; } .overflow-y-auto { overflow-y: auto; max-block-size: 60vh; } label { display: block; margin-block: 12px; } input:not([type='checkbox']),textarea { display:block;inline-size:100%;padding:8px; } .types { display: grid; grid-template-columns: repeat(2,1fr); gap:8px; } footer { display:flex;gap:12px;margin-block-start:20px; }</style>
