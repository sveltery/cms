<script lang="ts">
  import { getSchemaCollection, updateSchemaCollection, addSchemaField } from '$lib/schema.remote';
  import SchemaFieldLabel from './SchemaFieldLabel.svelte';
  const controlsId = $props.id();
  let { definition, collectionsHref = '/schema', disabled = true }: {
    definition: Awaited<ReturnType<typeof getSchemaCollection>>;
    collectionsHref?: string;
    disabled?: boolean;
  } = $props();
  const metadataForm = $derived(updateSchemaCollection.for(definition.slug));
  const fieldForm = $derived(addSchemaField.for(definition.slug));
  let supportsMode = $state('keep');
  let drafts = $state(false);
  let revisions = $state(false);
  let setSingular = $state(false);
  let setDescription = $state(false);
  let setDefault = $state(false);
  $effect(() => {
    if (supportsMode === 'keep') {
      drafts = definition.supports.includes('drafts');
      revisions = definition.supports.includes('revisions');
    }
  });
  const supports = $derived(JSON.stringify([...(drafts ? ['drafts'] : []), ...(revisions ? ['revisions'] : [])]));
</script>

<a href={collectionsHref}>Schema collections</a>
<h1>{definition.label}</h1>
<p><code>{definition.slug}</code> · Schema version {definition.version}</p>
<form {...metadataForm}>
  <fieldset {disabled}>
    <legend>Collection metadata</legend>
    <input {...metadataForm.fields.collection.as('hidden', definition.slug)} />
    <input {...metadataForm.fields.version.as('hidden', String(definition.version))} />
    <input {...metadataForm.fields.updatedAt.as('hidden', definition.updatedAt)} />
    <label>Collection label <input {...metadataForm.fields.label.as('text', definition.label)} required maxlength="200" /></label>
    <label class="toggle"><input type="checkbox" bind:checked={setSingular} /> Set singular label</label>
    <label>Singular label <input {...metadataForm.fields.labelSingular.as('text', definition.labelSingular ?? '')} disabled={!setSingular} required={setSingular} maxlength="200" /></label>
    <label class="toggle"><input type="checkbox" bind:checked={setDescription} /> Set description</label>
    <label>Description <textarea {...metadataForm.fields.description.as('text', definition.description ?? '')} disabled={!setDescription} maxlength="2000"></textarea></label>
    <label for={`${controlsId}-supports`}>Supports</label>
    <select id={`${controlsId}-supports`} bind:value={supportsMode}>
      <option value="keep">Keep existing supports</option>
      <option value="set">Set supports</option>
    </select>
    <p>Current supports: {definition.supports.join(', ') || 'none'}.</p>
    {#if supportsMode === 'set'}
      <input {...metadataForm.fields.supports.as('hidden', supports)} />
      <label class="toggle"><input type="checkbox" bind:checked={drafts} /> Drafts</label>
      <label class="toggle"><input type="checkbox" bind:checked={revisions} /> Revisions</label>
      <p>Leaving both unchecked stores an empty supports list.</p>
    {/if}
    <button type="submit" disabled={metadataForm.pending > 0}>Save metadata</button>
  </fieldset>
  {#if metadataForm.fields.allIssues()?.length}
    <ul aria-label="Metadata validation errors">{#each metadataForm.fields.allIssues() ?? [] as issue}<li>{issue.message}</li>{/each}</ul>
  {/if}
  {#if metadataForm.result}<p role="status">Collection metadata saved.</p>{/if}
</form>

<h2>Fields</h2>
<ul aria-label="Collection fields">
  {#each definition.fields as field (field.id)}
    <li>{field.label} <code>{field.slug}</code> · {field.type}{field.required ? ' · required' : ''}{field.unique ? ' · unique' : ''}
      <SchemaFieldLabel collection={definition.slug} {field} {disabled} />
    </li>
  {:else}<li>No fields yet.</li>{/each}
</ul>
<form {...fieldForm}>
  <fieldset {disabled}>
    <legend>Add field</legend>
    <input {...fieldForm.fields.collection.as('hidden', definition.slug)} />
    <input {...fieldForm.fields.expectedSchemaVersion.as('hidden', String(definition.version))} />
    <label>Field slug <input {...fieldForm.fields.slug.as('text')} required maxlength="63" pattern="[a-z][a-z0-9_]*" /></label>
    <label>Field label <input {...fieldForm.fields.label.as('text')} required maxlength="200" /></label>
    <label for={`${controlsId}-field-type`}>Field type</label>
    <select id={`${controlsId}-field-type`} {...fieldForm.fields.type.as('select', 'string')}><option value="string">String</option><option value="text">Text</option></select>
    <label class="toggle"><input {...fieldForm.fields.required.as('checkbox')} /> Required</label>
    <label class="toggle"><input {...fieldForm.fields.unique.as('checkbox')} /> Unique</label>
    <label class="toggle"><input type="checkbox" bind:checked={setDefault} /> Set default value</label>
    <label>Default value <textarea {...fieldForm.fields.defaultValue.as('text')} disabled={!setDefault} maxlength="100000"></textarea></label>
    <label>Minimum length <input {...fieldForm.fields.minLength.as('text')} inputmode="numeric" pattern="[0-9]*" /></label>
    <label>Maximum length <input {...fieldForm.fields.maxLength.as('text')} inputmode="numeric" pattern="[0-9]*" /></label>
    <button type="submit" disabled={fieldForm.pending > 0}>Add field</button>
  </fieldset>
  {#if fieldForm.fields.allIssues()?.length}
    <ul aria-label="Field validation errors">{#each fieldForm.fields.allIssues() ?? [] as issue}<li>{issue.message}</li>{/each}</ul>
  {/if}
  {#if fieldForm.result}<p role="status">Field added: {fieldForm.result.slug}.</p>{/if}
</form>
{#if disabled}<p>Writes will be available after authentication and persistence are configured.</p>{/if}

<style>
  h1 { margin-bottom: 12px; }
  fieldset { border: 1px solid #d9e0eb; border-radius: 12px; padding: 24px; margin-block: 24px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 12px; }
  input, textarea, select { display: block; inline-size: 100%; margin-block-start: 8px; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  .toggle input { display: inline; inline-size: auto; margin-inline-end: 8px; }
  textarea { min-block-size: 100px; }
  button { padding: 10px 18px; }
  p { color: #526079; font-size: 14px; }
  code { margin-inline: 8px; }
</style>
