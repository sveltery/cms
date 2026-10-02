<script lang="ts">
  import { updateSchemaFieldOptions } from '$lib/schema.remote';
  import type { Field } from '$lib/server/database/contract';

  const controlsId = $props.id();
  let { collection, field, disabled = true }: { collection: string; field: Field; disabled?: boolean } = $props();
  const optionsForm = $derived(updateSchemaFieldOptions.for(`${collection}/${field.slug}`));
</script>

<form {...optionsForm}>
  <fieldset disabled={disabled || optionsForm.pending > 0}>
    <legend>Edit {field.slug} options</legend>
    <input {...optionsForm.fields.collection.as('hidden', collection)} />
    <input {...optionsForm.fields.field.as('hidden', field.slug)} />
    <label for={`${controlsId}-label-mode`}>Label update</label>
    <select id={`${controlsId}-label-mode`} {...optionsForm.fields.labelMode.as('select', 'keep')}>
      <option value="keep">Keep label</option><option value="set">Set label</option>
    </select>
    <label>Metadata label <input {...optionsForm.fields.label.as('text', field.label)} /></label>
    <label for={`${controlsId}-sort-mode`}>Sort order update</label>
    <select id={`${controlsId}-sort-mode`} {...optionsForm.fields.sortOrderMode.as('select', 'keep')}>
      <option value="keep">Keep sort order</option><option value="set">Set sort order</option>
    </select>
    <label>Sort order <input {...optionsForm.fields.sortOrder.as('text', String(field.sortOrder))} inputmode="numeric" /></label>
    <label for={`${controlsId}-default-mode`}>Default metadata update</label>
    <select id={`${controlsId}-default-mode`} {...optionsForm.fields.defaultValueMode.as('select', 'keep')}>
      <option value="keep">Keep default metadata</option><option value="set">Set default metadata</option>
    </select>
    <label for={`${controlsId}-default-value`}>Metadata default value</label>
    <textarea id={`${controlsId}-default-value`} {...optionsForm.fields.defaultValue.as('text', String(field.defaultValue ?? ''))}
      value={optionsForm.fields.defaultValue.value() ?? String(field.defaultValue ?? '')}></textarea>
    <p>Setting an empty default saves an empty string. Changing this default leaves existing content unchanged.</p>
    <label for={`${controlsId}-validation-mode`}>Validation update</label>
    <select id={`${controlsId}-validation-mode`} {...optionsForm.fields.validationMode.as('select', 'keep')}>
      <option value="keep">Keep validation</option><option value="set">Replace validation</option><option value="clear">Clear validation</option>
    </select>
    <label>Validation minimum length <input {...optionsForm.fields.minLength.as('text', field.validation?.minLength === undefined ? '' : String(field.validation.minLength))} inputmode="numeric" /></label>
    <label>Validation maximum length <input {...optionsForm.fields.maxLength.as('text', field.validation?.maxLength === undefined ? '' : String(field.validation.maxLength))} inputmode="numeric" /></label>
    <label for={`${controlsId}-pattern-mode`}>Replacement pattern metadata</label>
    <select id={`${controlsId}-pattern-mode`} {...optionsForm.fields.patternMode.as('select', field.validation?.pattern === undefined ? 'omit' : 'set')}>
      <option value="omit">Omit pattern</option><option value="set">Save pattern</option>
    </select>
    <label for={`${controlsId}-pattern`}>Validation pattern</label>
    <input {...optionsForm.fields.patternOriginal.as('hidden', JSON.stringify(field.validation?.pattern ?? ''))} />
    <textarea id={`${controlsId}-pattern`} {...optionsForm.fields.pattern.as('text', field.validation?.pattern ?? '')}
      value={optionsForm.fields.pattern.value() ?? field.validation?.pattern ?? ''}></textarea>
    <p>Replace saves the displayed bounds and the selected pattern source. An unchanged source preserves its original line endings; new text uses the browser's submitted line endings. Omit pattern removes its key; Save pattern preserves an empty string. Clear removes validation. Existing content remains readable.</p>
    <p>The server uses JavaScript regular expressions without flags; matching is case sensitive and unanchored unless you include anchors.</p>
    <button type="submit" disabled={optionsForm.pending > 0}>Save field options</button>
  </fieldset>
  {#if optionsForm.fields.allIssues()?.length}
    <ul aria-label={`${field.slug} options validation errors`}>{#each optionsForm.fields.allIssues() ?? [] as issue}<li>{issue.message}</li>{/each}</ul>
  {/if}
  {#if optionsForm.result}<p role="status">Field options saved.</p>{/if}
</form>

<style>
  fieldset { border: 1px solid #d9e0eb; border-radius: 12px; padding: 16px; margin-block: 16px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 12px; }
  input, textarea, select { display: block; inline-size: 100%; margin-block-start: 8px; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  textarea { min-block-size: 80px; }
  button { padding: 10px 18px; }
  p { color: #526079; font-size: 14px; }
</style>
