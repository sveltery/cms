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
  // Derived from the complete pinned ContentEditor scalar bounds contract.
  // English message presentation is recorded separately from Lingui parity.
  function bound(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
  function lengthHint(count: number, min?: number, max?: number) {
    const number = (value: number) => new Intl.NumberFormat('en').format(value);
    if (max !== undefined) return `${number(count)} of ${number(max)} ${max === 1 ? 'character' : 'characters'}${min !== undefined ? `, at least ${number(min)}` : ''}`;
    if (min !== undefined) return `At least ${number(min)} ${min === 1 ? 'character' : 'characters'}`;
    return undefined;
  }
</script>

<input type="hidden" name="data" value={JSON.stringify(values)} disabled={!canWrite} />
<fieldset disabled={!canWrite}>
  <legend>Draft</legend>
  {#each fields as field (field.id)}
    {@const value = Object.hasOwn(values, field.slug) ? values[field.slug] : field.defaultValue}
    {@const displayed = typeof value === 'string' ? value : ''}
    {@const min = bound(field.validation?.minLength)}
    {@const max = bound(field.validation?.maxLength)}
    {@const invalid = (max !== undefined && displayed.length > max) || (typeof value === 'string' && min !== undefined && displayed.length < min)}
    {@const hint = lengthHint(displayed.length, min, max)}
    <label for={`field-${field.slug}`}>{field.label}{field.required ? ' *' : ''}</label>
    {#if field.type === 'text'}
      <textarea id={`field-${field.slug}`} data-field={field.slug} value={displayed}
        oninput={event => change(field.slug, event.currentTarget.value)} rows={10}
        maxlength={max} dir="auto" placeholder="Enter markdown content..."
        aria-invalid={invalid || undefined} aria-describedby={hint ? `field-${field.slug}-hint` : undefined}></textarea>
    {:else}
      <input id={`field-${field.slug}`} data-field={field.slug} value={displayed}
        oninput={event => change(field.slug, event.currentTarget.value)} required={field.required}
        maxlength={max} dir="auto" aria-invalid={invalid || undefined}
        aria-describedby={hint ? `field-${field.slug}-hint` : undefined} />
    {/if}
    {#if hint}<span id={`field-${field.slug}-hint`} dir="auto">{hint}</span>{/if}
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
