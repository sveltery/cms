<script lang="ts">
  import type { EditorField } from '$lib/server/content/manifest';
  let { slug, field, name, value = $bindable(''), disabled = false, onchange }: {
    slug: string;
    field: Omit<EditorField, 'kind'> & { kind: 'string' | 'richText' };
    name?: string;
    value?: string | null;
    disabled?: boolean;
    onchange?: (value: string) => void;
  } = $props();
</script>

<label for={`field-${slug}`}>
  {field.label || slug.charAt(0).toUpperCase() + slug.slice(1)}
  {#if field.required}<span aria-hidden="true"> *</span>{/if}
</label>
{#if field.kind === 'richText'}
  <textarea id={`field-${slug}`} {name} bind:value {disabled} maxlength={field.validation?.maxLength}
    oninput={event => onchange?.(event.currentTarget.value)} dir="auto" placeholder="Enter markdown content..."></textarea>
{:else}
  <input id={`field-${slug}`} type="text" {name} bind:value {disabled} required={field.required}
    oninput={event => onchange?.(event.currentTarget.value)} maxlength={field.validation?.maxLength} dir="auto" />
{/if}

<style>
  label { display: block; font-weight: 600; margin-block: 18px 8px; }
  input, textarea { inline-size: 100%; border: 1px solid #c4cedd; border-radius: 6px; padding: 10px; font: inherit; }
  textarea { min-block-size: 140px; }
</style>
