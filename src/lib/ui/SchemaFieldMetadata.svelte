<script lang="ts">
  import { updateSchemaFieldMetadata, deleteSchemaField, getSchemaCollection } from '$lib/schema.remote';
  import { schemaFieldTypes } from './schema-field-types';
  let { collection, field, expected, disabled=true }: {
    collection:string;
    field:Awaited<ReturnType<typeof getSchemaCollection>>['fields'][number];
    expected:{version:number;updatedAt:string}; disabled?:boolean;
  }=$props();
  const edit=$derived(updateSchemaFieldMetadata.for(`${collection}/${field.slug}`));
  const remove=$derived(deleteSchemaField.for(`${collection}/${field.slug}`));
  let setType=$state(false); let setWidget=$state(false);
  let setDefault=$state(false); let setValidation=$state(false); let setOptions=$state(false);
  let setSearchable=$state(false); let setIndexed=$state(false); let setTranslatable=$state(false);
  let confirmDelete=$state(false);
</script>

<details>
  <summary>Field settings for {field.label}</summary>
  <form {...edit}>
    <fieldset disabled={disabled || edit.pending>0 || !!field.unsupportedType}>
      <legend>Settings for {field.label}</legend>
      <input {...edit.fields.collection.as('hidden',collection)} />
      <input {...edit.fields.field.as('hidden',field.slug)} />
      <label><input type="checkbox" bind:checked={setType} /> Change field type</label>
      <label>New field type
        <select {...edit.fields.type.as('select',field.type)} disabled={!setType}>
          {#each schemaFieldTypes as [value,label]}<option {value}>{label}</option>{/each}
        </select>
      </label>
      <p>Short text, long text and slug can change between one another. Other type changes require a content migration.</p>
      <label><input type="checkbox" bind:checked={setWidget} /> Set widget</label>
      <label>Widget <input {...edit.fields.widget.as('text',field.widget??'')} disabled={!setWidget} /></label>
      <label><input type="checkbox" bind:checked={setSearchable} /> Set searchable</label>
      <label>Searchable <select {...edit.fields.searchable.as('select',String(field.searchable))} disabled={!setSearchable}><option value="true">Yes</option><option value="false">No</option></select></label>
      <label><input type="checkbox" bind:checked={setIndexed} /> Set indexed</label>
      <label>Indexed <select {...edit.fields.indexed.as('select',String(field.indexed))} disabled={!setIndexed}><option value="true">Yes</option><option value="false">No</option></select></label>
      <label><input type="checkbox" bind:checked={setTranslatable} /> Set translatable</label>
      <label>Translatable <select {...edit.fields.translatable.as('select',String(field.translatable))} disabled={!setTranslatable}><option value="true">Yes</option><option value="false">No</option></select></label>
      <p>Making an existing field non-translatable requires a content migration.</p>
      <label><input type="checkbox" bind:checked={setDefault} /> Replace default value</label>
      <label>Default value (JSON) <textarea {...edit.fields.defaultValueJson.as('text',JSON.stringify(field.defaultValue??null))} disabled={!setDefault}></textarea></label>
      <label><input type="checkbox" bind:checked={setValidation} /> Replace validation rules</label>
      <label>Validation rules (JSON) <textarea {...edit.fields.validationJson.as('text',JSON.stringify(field.validation??null,null,2))} disabled={!setValidation}></textarea></label>
      <label><input type="checkbox" bind:checked={setOptions} /> Replace field options</label>
      <label>Field options (JSON) <textarea {...edit.fields.optionsJson.as('text',JSON.stringify(field.options??{},null,2))} disabled={!setOptions}></textarea></label>
      <p>Rules and options use the selected field's schema. Unselected settings keep their stored values.</p>
      <button type="submit">Save field settings</button>
    </fieldset>
    {#if edit.fields.allIssues()?.length}<ul aria-label="Field settings errors">{#each edit.fields.allIssues()??[] as issue}<li>{issue.message}</li>{/each}</ul>{/if}
    {#if edit.result}<p role="status">Field settings saved.</p>{/if}
  </form>
  {#if field.unsupportedType}<p>This field uses an unsupported stored type. Its data is preserved.</p>{/if}
  <form {...remove}>
    <fieldset disabled={disabled || remove.pending>0}>
      <legend>Delete {field.label}</legend>
      <input {...remove.fields.collection.as('hidden',collection)} />
      <input {...remove.fields.field.as('hidden',field.slug)} />
      <input {...remove.fields.version.as('hidden',String(expected.version))} />
      <input {...remove.fields.updatedAt.as('hidden',expected.updatedAt)} />
      <p>Deleting this field removes its values from this collection.</p>
      <label><input type="checkbox" bind:checked={confirmDelete} /> Confirm deleting {field.label}</label>
      <button type="submit" disabled={!confirmDelete}>Delete field {field.label}</button>
    </fieldset>
    {#if remove.fields.allIssues()?.length}<ul>{#each remove.fields.allIssues()??[] as issue}<li>{issue.message}</li>{/each}</ul>{/if}
  </form>
</details>

<style>
  details { margin-block:16px; } fieldset { padding:16px; border:1px solid #d9e0eb; border-radius:8px; }
  label { display:block; margin-block:12px; } select, textarea, input:not([type=checkbox]) { display:block; padding:8px; width:100%; margin-top:6px; }
  textarea { min-height:80px; } button { padding:8px 14px; } p { color:#526079; }
</style>
