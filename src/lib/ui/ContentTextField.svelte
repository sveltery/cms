<script lang="ts">
  import type { EditorField } from '$lib/server/content/manifest';
  let { slug, field, name, value = $bindable(''), disabled = false }: {
    slug: string;
    field: EditorField;
    name?: string;
    value?: string | null;
    disabled?: boolean;
  } = $props();
</script>

<label for={`field-${slug}`}>
  {field.label || slug.charAt(0).toUpperCase() + slug.slice(1)}
  {#if field.required}<span aria-hidden="true"> *</span>{/if}
</label>
{#if field.kind === 'richText'}
  <textarea id={`field-${slug}`} {name} bind:value {disabled} required={field.required}
    minlength={field.validation?.minLength} maxlength={field.validation?.maxLength}></textarea>
{:else}
  <input id={`field-${slug}`} type="text" {name} bind:value {disabled} required={field.required}
    minlength={field.validation?.minLength} maxlength={field.validation?.maxLength} />
{/if}

<style>
  label { display: block; font-weight: 600; margin-block: 18px 8px; }
  input, textarea { inline-size: 100%; border: 1px solid #c4cedd; border-radius: 6px; padding: 10px; font: inherit; }
  textarea { min-block-size: 140px; }
</style>
