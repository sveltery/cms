<script lang="ts">
  import { onMount } from 'svelte';
  import { getSchemaCollection, updateSchemaCollection, addSchemaField, reorderSchemaFields, deleteSchemaCollection } from '$lib/schema.remote';
  import SchemaFieldLabel from './SchemaFieldLabel.svelte';
  import SchemaFieldOptions from './SchemaFieldOptions.svelte';
  import SchemaFieldMetadata from './SchemaFieldMetadata.svelte';
  import { schemaFieldTypes } from './schema-field-types';
  const controlsId = $props.id();
  let { definition, collectionsHref = '/schema', disabled = true }: {
    definition: Awaited<ReturnType<typeof getSchemaCollection>>;
    collectionsHref?: string;
    disabled?: boolean;
  } = $props();
  const metadataForm = $derived(updateSchemaCollection.for(definition.slug));
  const fieldForm = $derived(addSchemaField.for(definition.slug));
  const scalarField = $derived(['string','text','slug'].includes(fieldForm.fields.type.value() ?? 'string'));
  const orderForm = $derived(reorderSchemaFields.for(definition.slug));
  const deleteForm = $derived(deleteSchemaCollection.for(definition.slug));
  const supportsMode = $derived(metadataForm.fields.supportsMode.value() ?? 'keep');
  const singularMode = $derived(metadataForm.fields.labelSingularMode.value() ?? 'keep');
  const descriptionMode = $derived(metadataForm.fields.descriptionMode.value() ?? 'keep');
  let hydrated = $state(false);
  onMount(() => { hydrated = true; });
  const defaultFormat = $derived(fieldForm.fields.defaultValueFormat.value() ?? 'omit');
  const validationFormat = $derived(fieldForm.fields.validationFormat.value() ?? 'omit');
  const optionsMode = $derived(fieldForm.fields.optionsMode.value() ?? 'keep');
</script>

<a href={collectionsHref}>Schema collections</a>
<h1>{definition.label}</h1>
<p><code>{definition.slug}</code> · Schema version {definition.version}</p>
<form {...metadataForm}>
  <fieldset disabled={disabled || metadataForm.pending > 0}>
    <legend>Collection metadata</legend>
    <input {...metadataForm.fields.collection.as('hidden', definition.slug)} />
    <input {...metadataForm.fields.version.as('hidden', String(definition.version))} />
    <input {...metadataForm.fields.updatedAt.as('hidden', definition.updatedAt)} />
    <label>Collection label <input {...metadataForm.fields.label.as('text', definition.label)} required maxlength="200" /></label>
    <label>Singular label update <select aria-label="Singular label update" {...metadataForm.fields.labelSingularMode.as('select','keep')}><option value="keep">Keep singular label</option><option value="set">Set singular label</option></select></label>
    <label>Singular label <input {...metadataForm.fields.labelSingular.as('text', definition.labelSingular ?? '')} disabled={hydrated && singularMode!=='set'} required={singularMode==='set'} maxlength="200" /></label>
    <label>Description update <select aria-label="Description update" {...metadataForm.fields.descriptionMode.as('select','keep')}><option value="keep">Keep description</option><option value="set">Set description</option></select></label>
    <label>Description <textarea aria-label="Description" {...metadataForm.fields.description.as('text', definition.description ?? '')} value={metadataForm.fields.description.value()??definition.description??''} disabled={hydrated && descriptionMode!=='set'} maxlength="2000"></textarea></label>
    <label for={`${controlsId}-supports`}>Supports</label>
    <select id={`${controlsId}-supports`} {...metadataForm.fields.supportsMode.as('select','keep')}>
      <option value="keep">Keep existing supports</option>
      <option value="set">Set supports</option>
    </select>
    <p>Current supports: {definition.supports.join(', ') || 'none'}.</p>
    <label class="toggle"><input {...metadataForm.fields.supportDrafts.as('checkbox',definition.supports.includes('drafts'))} disabled={hydrated && supportsMode!=='set'} /> Drafts</label>
    <label class="toggle"><input {...metadataForm.fields.supportRevisions.as('checkbox',definition.supports.includes('revisions'))} disabled={hydrated && supportsMode!=='set'} /> Revisions</label>
    <label class="toggle"><input {...metadataForm.fields.supportPreview.as('checkbox',definition.supports.includes('preview'))} disabled={hydrated && supportsMode!=='set'} /> Preview</label>
    <label class="toggle"><input {...metadataForm.fields.supportScheduling.as('checkbox',definition.supports.includes('scheduling'))} disabled={hydrated && supportsMode!=='set'} /> Scheduling</label>
    <label class="toggle"><input {...metadataForm.fields.supportSearch.as('checkbox',definition.supports.includes('search'))} disabled={hydrated && supportsMode!=='set'} /> Search</label>
    <label class="toggle"><input {...metadataForm.fields.supportSeo.as('checkbox',definition.supports.includes('seo'))} disabled={hydrated && supportsMode!=='set'} /> SEO</label>
    <p>Choose Set supports to save these choices. Leaving all unchecked stores an empty supports list.</p>
    <label>Collection settings update <select aria-label="Collection settings update" {...metadataForm.fields.settingsMode.as('select','keep')}><option value="keep">Keep collection settings</option><option value="set">Set collection settings</option></select></label>
    <label>Icon <input {...metadataForm.fields.icon.as('text',definition.icon??'')} /></label>
    <label>Navigation group <input {...metadataForm.fields.group.as('text',definition.group??'')} /></label>
    <label>URL pattern <input {...metadataForm.fields.urlPattern.as('text',definition.urlPattern??'')} /></label>
    <label>Routable <select aria-label="Routable" {...metadataForm.fields.routable.as('select',String(definition.routable))}><option value="true">Yes</option><option value="false">No</option></select></label>
    <label>SEO settings <select aria-label="SEO settings" {...metadataForm.fields.hasSeo.as('select',String(definition.hasSeo))}><option value="true">Yes</option><option value="false">No</option></select></label>
    <label>Hidden from navigation <select aria-label="Hidden from navigation" {...metadataForm.fields.hidden.as('select',String(definition.hidden))}><option value="true">Yes</option><option value="false">No</option></select></label>
    <label>Edit locking <select aria-label="Edit locking" {...metadataForm.fields.editLocking.as('select',String(definition.editLocking))}><option value="true">Yes</option><option value="false">No</option></select></label>
    <label>Enable comments <select aria-label="Enable comments" {...metadataForm.fields.commentsEnabled.as('select',String(definition.commentsEnabled))}><option value="true">Yes</option><option value="false">No</option></select></label>
    <label>Comment moderation <select aria-label="Comment moderation" {...metadataForm.fields.commentsModeration.as('select',definition.commentsModeration)}><option value="all">All comments</option><option value="first_time">First comment</option><option value="none">No moderation</option></select></label>
    <label>Close comments after days <input {...metadataForm.fields.commentsClosedAfterDays.as('text',String(definition.commentsClosedAfterDays))} inputmode="numeric" /></label>
    <label>Auto approve signed-in comments <select aria-label="Auto approve signed-in comments" {...metadataForm.fields.commentsAutoApproveUsers.as('select',String(definition.commentsAutoApproveUsers))}><option value="true">Yes</option><option value="false">No</option></select></label>
    <label>Display fields update <select aria-label="Display fields update" {...metadataForm.fields.displayMode.as('select','keep')}><option value="keep">Keep display fields</option><option value="set">Set display fields</option></select></label>
    <label>Title field <select aria-label="Title field" {...metadataForm.fields.titleField.as('select',definition.titleField??'')}><option value="">Default title</option>{#each definition.fields.filter(field=>!field.unsupportedType && ['string','text','slug'].includes(field.type)) as field}<option value={field.slug}>{field.label}</option>{/each}</select></label>
    <label>Date field <select aria-label="Date field" {...metadataForm.fields.dateField.as('select',definition.dateField??'')}><option value="">Default date</option>{#each definition.fields.filter(field=>!field.unsupportedType && field.type==='datetime') as field}<option value={field.slug}>{field.label}</option>{/each}</select></label>
    <label>List display update <select aria-label="List display update" {...metadataForm.fields.adminMode.as('select','keep')}><option value="keep">Keep list display</option><option value="set">Set list display</option></select></label>
    <label>List columns <textarea aria-label="List columns" {...metadataForm.fields.listColumns.as('text',JSON.stringify(definition.admin?.listColumns??[]))} value={metadataForm.fields.listColumns.value()??JSON.stringify(definition.admin?.listColumns??[])}></textarea></label>
    <label>Quick create <select aria-label="Quick create" {...metadataForm.fields.quickCreate.as('select',String(definition.admin?.quickCreate??true))}><option value="true">Yes</option><option value="false">No</option></select></label>
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
      <SchemaFieldOptions collection={definition.slug} {field} {disabled} />
      <SchemaFieldMetadata collection={definition.slug} {field} expected={definition} {disabled} />
    </li>
  {:else}<li>No fields yet.</li>{/each}
</ul>
{#if definition.fields.length>1}
<form {...orderForm}>
  <fieldset disabled={disabled || orderForm.pending>0}>
    <legend>Field order</legend>
    <input {...orderForm.fields.collection.as('hidden',definition.slug)} />
    <input {...orderForm.fields.version.as('hidden',String(definition.version))} />
    <input {...orderForm.fields.updatedAt.as('hidden',definition.updatedAt)} />
    <label>Ordered field slugs <textarea aria-label="Ordered field slugs" {...orderForm.fields.fields.as('text',JSON.stringify(definition.fields.map(field=>field.slug)))} value={orderForm.fields.fields.value()??JSON.stringify(definition.fields.map(field=>field.slug))}></textarea></label>
    <button type="submit">Save field order</button>
  </fieldset>
  {#if orderForm.fields.allIssues()?.length}<ul aria-label="Field order errors">{#each orderForm.fields.allIssues()??[] as issue}<li>{issue.message}</li>{/each}</ul>{/if}
  {#if orderForm.result}<p role="status">Field order saved.</p>{/if}
</form>
{/if}
<form {...fieldForm}>
  <fieldset disabled={disabled || fieldForm.pending > 0}>
    <legend>Add field</legend>
    <input {...fieldForm.fields.collection.as('hidden', definition.slug)} />
    <input {...fieldForm.fields.expectedSchemaVersion.as('hidden', String(definition.version))} />
    <label>Field slug <input {...fieldForm.fields.slug.as('text')} required maxlength="63" pattern="[a-z][a-z0-9_]*" /></label>
    <label>Field label <input {...fieldForm.fields.label.as('text')} required maxlength="200" /></label>
    <label for={`${controlsId}-field-type`}>Field type</label>
    <select id={`${controlsId}-field-type`} {...fieldForm.fields.type.as('select', 'string')}>{#each schemaFieldTypes as [value,label]}<option {value}>{label}</option>{/each}</select>
    <label class="toggle"><input {...fieldForm.fields.required.as('checkbox')} /> Required</label>
    <label class="toggle"><input {...fieldForm.fields.unique.as('checkbox')} /> Unique</label>
    <label>Default format <select aria-label="Default format" {...fieldForm.fields.defaultValueFormat.as('select','omit')}><option value="omit">No default</option>{#if scalarField}<option value="text">Text default</option>{/if}<option value="json">JSON default</option></select></label>
    {#if scalarField}
    <label>Default value <textarea aria-label="Default value" {...fieldForm.fields.defaultValue.as('text')} value={fieldForm.fields.defaultValue.value() ?? ''} disabled={hydrated && defaultFormat !== 'text'} maxlength="100000"></textarea></label>
    {/if}
    <label>Typed default value (JSON) <textarea aria-label="Typed default value (JSON)" {...fieldForm.fields.defaultValueJson.as('text')} value={fieldForm.fields.defaultValueJson.value() ?? ''} disabled={hydrated && defaultFormat !== 'json'}></textarea></label>
    <label>Validation format <select aria-label="Validation format" {...fieldForm.fields.validationFormat.as('select','omit')}><option value="omit">No validation</option>{#if scalarField}<option value="text">Text rules</option>{/if}<option value="json">JSON rules</option></select></label>
    <label>Validation rules (JSON) <textarea aria-label="Validation rules (JSON)" {...fieldForm.fields.validationJson.as('text')} value={fieldForm.fields.validationJson.value() ?? ''} disabled={hydrated && validationFormat !== 'json'}></textarea></label>
    <label>Field options update <select aria-label="Field options update" {...fieldForm.fields.optionsMode.as('select','keep')}><option value="keep">No options</option><option value="set">Set options</option></select></label>
    <label>Field options (JSON) <textarea aria-label="Field options (JSON)" {...fieldForm.fields.optionsJson.as('text')} value={fieldForm.fields.optionsJson.value() ?? ''} disabled={hydrated && optionsMode !== 'set'}></textarea></label>
    <label>Widget <input {...fieldForm.fields.widget.as('text')} /></label>
    <label class="toggle"><input {...fieldForm.fields.indexed.as('checkbox')} /> Indexed</label>
    <label class="toggle"><input {...fieldForm.fields.searchable.as('checkbox')} /> Searchable</label>
    <label>Translatable <select aria-label="Translatable" {...fieldForm.fields.translatable.as('select','true')}><option value="true">Yes</option><option value="false">No</option></select></label>
    {#if scalarField && (!hydrated || validationFormat === 'text')}
    <label>Minimum length <input {...fieldForm.fields.minLength.as('text')} inputmode="numeric" pattern="[0-9]*" /></label>
    <label>Maximum length <input {...fieldForm.fields.maxLength.as('text')} inputmode="numeric" pattern="[0-9]*" /></label>
    <label for={`${controlsId}-pattern-mode`}>Pattern metadata</label>
    <select id={`${controlsId}-pattern-mode`} {...fieldForm.fields.patternMode.as('select', 'omit')}>
      <option value="omit">Omit pattern</option><option value="set">Save pattern</option>
    </select>
    <label for={`${controlsId}-pattern`}>Validation pattern</label>
    <textarea id={`${controlsId}-pattern`} {...fieldForm.fields.pattern.as('text')}
      value={fieldForm.fields.pattern.value() ?? ''}></textarea>
    <p>Save pattern stores the exact source, including an empty string. The server uses JavaScript regular expressions without flags; matching is case sensitive and unanchored unless you include anchors.</p>
    {/if}
    <p>Only the selected default, validation and options formats are saved.</p>
    <button type="submit" disabled={fieldForm.pending > 0}>Add field</button>
  </fieldset>
  {#if fieldForm.fields.allIssues()?.length}
    <ul aria-label="Field validation errors">{#each fieldForm.fields.allIssues() ?? [] as issue}<li>{issue.message}</li>{/each}</ul>
  {/if}
  {#if fieldForm.result}<p role="status">Field added: {fieldForm.result.slug}.</p>{/if}
</form>
<form {...deleteForm}>
  <fieldset disabled={disabled || deleteForm.pending>0}>
    <legend>Delete collection</legend>
    <input {...deleteForm.fields.collection.as('hidden',definition.slug)} />
    <input {...deleteForm.fields.version.as('hidden',String(definition.version))} />
    <input {...deleteForm.fields.updatedAt.as('hidden',definition.updatedAt)} />
    <p>Collection deletion removes its schema and stored content.</p>
    <label class="toggle"><input {...deleteForm.fields.force.as('checkbox')} /> Also delete existing content</label>
    <label class="toggle"><input type="checkbox" required /> Confirm deleting this collection</label>
    <button type="submit">Delete collection</button>
  </fieldset>
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
