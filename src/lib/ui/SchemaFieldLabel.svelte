<script lang="ts">
  import { updateSchemaFieldLabel } from '$lib/schema.remote';
  import type { Field } from '$lib/server/database/contract';

  let { collection, field, disabled = true }: { collection: string; field: Field; disabled?: boolean } = $props();
  const labelForm = $derived(updateSchemaFieldLabel.for(`${collection}/${field.slug}`));
</script>

<form {...labelForm}>
  <fieldset {disabled}>
    <legend>Edit {field.slug} label</legend>
    <input {...labelForm.fields.collection.as('hidden', collection)} />
    <input {...labelForm.fields.field.as('hidden', field.slug)} />
    <label>Field slug <input type="text" value={field.slug} disabled /></label>
    <label>Label <input {...labelForm.fields.label.as('text', field.label)} required /></label>
    <button type="submit" disabled={labelForm.pending > 0}>Save label</button>
  </fieldset>
  {#if labelForm.fields.allIssues()?.length}
    <ul aria-label={`${field.slug} label validation errors`}>{#each labelForm.fields.allIssues() ?? [] as issue}<li>{issue.message}</li>{/each}</ul>
  {/if}
  {#if labelForm.result}<p role="status">Field label saved.</p>{/if}
</form>

<style>
  fieldset { border: 1px solid #d9e0eb; border-radius: 12px; padding: 16px; margin-block: 16px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 12px; }
  input { display: block; inline-size: 100%; margin-block-start: 8px; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  button { padding: 10px 18px; }
  p { color: #526079; font-size: 14px; }
</style>
