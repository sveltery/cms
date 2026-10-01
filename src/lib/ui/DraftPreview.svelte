<script lang="ts">
  import type { Field } from '$lib/server/database/contract';
  let { fields = [], values = {} }: { fields?: Pick<Field, 'id' | 'slug' | 'label' | 'type' | 'required' | 'validation' | 'defaultValue'>[]; values?: Record<string, string | null> } = $props();
</script>

<input type="hidden" name="data" value={JSON.stringify(values)} disabled />
<fieldset disabled>
  <legend>Draft preview</legend>
  {#each fields as field (field.id)}
    <label>
      {field.label}{field.required ? ' *' : ''}
      {#if field.type === 'text'}
        <textarea data-field={field.slug} value={Object.hasOwn(values, field.slug) ? values[field.slug] ?? '' : field.defaultValue ?? ''} required={field.required} maxlength={field.validation?.maxLength ?? 100_000}></textarea>
      {:else}
        <input data-field={field.slug} value={Object.hasOwn(values, field.slug) ? values[field.slug] ?? '' : field.defaultValue ?? ''} required={field.required} minlength={field.validation?.minLength} maxlength={field.validation?.maxLength ?? 200} />
      {/if}
    </label>
  {/each}
  <button type="submit">Save draft</button>
</fieldset>
<p>Writes will be available after authentication and persistence are configured.</p>

<style>
  fieldset { border: 1px solid #d9e0eb; border-radius: 12px; padding: 24px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 12px; }
  input, textarea { display: block; box-sizing: border-box; inline-size: 100%; margin-block-start: 8px; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  textarea { min-block-size: 140px; }
  button { padding: 10px 18px; }
  p { color: #526079; font-size: 14px; }
</style>
