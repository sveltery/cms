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
</script>

<details>
  <summary>Field settings for {field.label}</summary>
  <form {...edit}>
    <fieldset disabled={disabled || edit.pending>0 || !!field.unsupportedType}>
      <legend>Settings for {field.label}</legend>
      <input {...edit.fields.collection.as('hidden',collection)} />
      <input {...edit.fields.field.as('hidden',field.slug)} />
      <label>Field type update <select aria-label="Field type update" {...edit.fields.typeMode.as('select','keep')}><option value="keep">Keep field type</option><option value="set">Change field type</option></select></label>
      <label>New field type
        <select {...edit.fields.type.as('select',field.type)}>
          {#each schemaFieldTypes as [value,label]}<option {value}>{label}</option>{/each}
        </select>
      </label>
      <p>Short text, long text and slug can change between one another. Other type changes require a content migration.</p>
      <p>Required: {field.required?'Yes':'No'}. Unique: {field.unique?'Yes':'No'}. Changing these settings requires a content migration.</p>
      <label>Widget update <select aria-label="Widget update" {...edit.fields.widgetMode.as('select','keep')}><option value="keep">Keep widget</option><option value="set">Set widget</option></select></label>
      <label>Widget <input {...edit.fields.widget.as('text',field.widget??'')} /></label>
      <label>Searchable update <select aria-label="Searchable update" {...edit.fields.searchableMode.as('select','keep')}><option value="keep">Keep searchable</option><option value="set">Set searchable</option></select></label>
      <label>Searchable <select aria-label="Searchable" {...edit.fields.searchable.as('select',String(field.searchable))}><option value="true">Yes</option><option value="false">No</option></select></label>
      <label>Index update <select aria-label="Index update" {...edit.fields.indexedMode.as('select','keep')}><option value="keep">Keep index</option><option value="set">Set indexed</option></select></label>
      <label>Indexed <select aria-label="Indexed" {...edit.fields.indexed.as('select',String(field.indexed))}><option value="true">Yes</option><option value="false">No</option></select></label>
      <label>Translation update <select aria-label="Translation update" {...edit.fields.translatableMode.as('select','keep')}><option value="keep">Keep translatable</option><option value="set">Set translatable</option></select></label>
      <label>Translatable <select aria-label="Translatable" {...edit.fields.translatable.as('select',String(field.translatable))}><option value="true">Yes</option><option value="false">No</option></select></label>
      <p>Making an existing field non-translatable requires a content migration.</p>
      <label>Default update <select aria-label="Default update" {...edit.fields.defaultValueMode.as('select','keep')}><option value="keep">Keep default value</option><option value="set">Replace default value</option></select></label>
      <label>Default value (JSON) <textarea aria-label="Default value (JSON)" {...edit.fields.defaultValueJson.as('text',JSON.stringify(field.defaultValue??null))} value={edit.fields.defaultValueJson.value()??JSON.stringify(field.defaultValue??null)}></textarea></label>
      <label>Validation update <select aria-label="Validation update" {...edit.fields.validationMode.as('select','keep')}><option value="keep">Keep validation rules</option><option value="set">Replace validation rules</option></select></label>
      <label>Validation rules (JSON) <textarea aria-label="Validation rules (JSON)" {...edit.fields.validationJson.as('text',JSON.stringify(field.validation??null,null,2))} value={edit.fields.validationJson.value()??JSON.stringify(field.validation??null,null,2)}></textarea></label>
      <label>Options update <select aria-label="Options update" {...edit.fields.optionsMode.as('select','keep')}><option value="keep">Keep field options</option><option value="set">Replace field options</option></select></label>
      <label>Field options (JSON) <textarea aria-label="Field options (JSON)" {...edit.fields.optionsJson.as('text',JSON.stringify(field.options??{},null,2))} value={edit.fields.optionsJson.value()??JSON.stringify(field.options??{},null,2)}></textarea></label>
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
      <label><input type="checkbox" required /> Confirm deleting {field.label}</label>
      <button type="submit">Delete field {field.label}</button>
    </fieldset>
    {#if remove.fields.allIssues()?.length}<ul>{#each remove.fields.allIssues()??[] as issue}<li>{issue.message}</li>{/each}</ul>{/if}
  </form>
</details>

<style>
  details { margin-block:16px; } fieldset { padding:16px; border:1px solid #d9e0eb; border-radius:8px; }
  label { display:block; margin-block:12px; } select, textarea, input:not([type=checkbox]) { display:block; padding:8px; width:100%; margin-top:6px; }
  textarea { min-height:80px; } button { padding:8px 14px; } p { color:#526079; }
</style>
