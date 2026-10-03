<script lang="ts">
  import type { PreviewField } from '../ui/preview-fields';
  let { fields = [], values = $bindable({}), canWrite = false, pending = false, issues = [], dirty = true, onValuesChange }: {
    fields?: PreviewField[]; values?: Record<string, unknown>; canWrite?: boolean;
    pending?: boolean; issues?: string[]; dirty?: boolean;
    onValuesChange?: (values: Record<string, unknown>) => void;
  } = $props();
  function change(slug: string, value: string) {
    values = { ...values, [slug]: value };
    onValuesChange?.(values);
  }
</script>

<input type="hidden" name="data" value={JSON.stringify(values)} disabled={!canWrite} />
<fieldset disabled={!canWrite}>
  <legend>Draft</legend>
  {#each fields as field (field.id)}
    {@const displayed = Object.hasOwn(values, field.slug) ? String(values[field.slug] ?? '') : String(field.defaultValue ?? '')}
    <label for={`field-${field.slug}`}>{field.label}{field.required ? ' *' : ''}</label>
    {#if field.type === 'text'}
      <textarea id={`field-${field.slug}`} data-field={field.slug} value={displayed}
        oninput={event => change(field.slug, event.currentTarget.value)} required={field.required}
        maxlength={field.validation?.maxLength}></textarea>
    {:else}
      <input id={`field-${field.slug}`} data-field={field.slug} value={displayed}
        oninput={event => change(field.slug, event.currentTarget.value)} required={field.required}
        minlength={field.validation?.minLength} maxlength={field.validation?.maxLength} />
    {/if}
  {/each}
  <button type="submit" disabled={pending || !dirty} aria-busy={pending}>{pending ? 'Saving...' : dirty ? 'Save' : 'Saved'}</button>
</fieldset>
{#if issues.length}<ul role="alert" aria-label="Save errors">{#each issues as issue}<li>{issue}</li>{/each}</ul>{/if}
{#if !canWrite}<p>Editing is unavailable for this session or configuration.</p>{/if}

<style>
  fieldset { border: 1px solid #d9e0eb; border-radius: 12px; padding: 24px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 12px 8px; }
  input, textarea { display: block; box-sizing: border-box; inline-size: 100%; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  textarea { min-block-size: 140px; }
  button { margin-block-start: 16px; padding: 10px 18px; }
</style>
