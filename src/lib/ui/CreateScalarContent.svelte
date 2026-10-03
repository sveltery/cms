<script lang="ts">
  import { onMount } from 'svelte';
  import { isHttpError } from '@sveltejs/kit';
  import type { EditorCollection } from '$lib/server/content/manifest';
  import { createEditorContent } from '$lib/editor.remote';
  import ContentTextField from './ContentTextField.svelte';
  import { slugify } from './content-slug';
  import { describeContentValidationError } from './content-validation-errors';
  let { collection, locale, definition, disabled }: {
    collection: string; locale: string; definition: EditorCollection; disabled: boolean;
  } = $props();
  const createForm = $derived(createEditorContent.for(JSON.stringify([collection, locale])));
  let values = $state<Record<string, string>>({});
  let slug = $state('');
  let slugTouched = $state(false);
  let enhanced = $state(false);
  let message = $state<string | undefined>();
  onMount(() => { enhanced = true; });
  function change(field: string, value: string) {
    values = { ...values, [field]: value };
    if (field === 'title' && !slugTouched && value) slug = slugify(value);
  }
  const enhancedForm = $derived(createForm.enhance(async form => {
    message = undefined;
    try { await form.submit(); }
    catch (cause) {
      message = describeContentValidationError(cause, definition.fields) ??
        (isHttpError(cause) ? cause.body.message : 'Content could not be saved.');
    }
  }));
</script>

<form {...enhancedForm}>
  <fieldset disabled={disabled || createForm.pending > 0}>
    <legend>New {definition.labelSingular}</legend>
    <input type="hidden" name="collection" value={collection} />
    <input type="hidden" name="locale" value={locale} />
    <input type="hidden" name="editorMode" value={enhanced ? 'changed' : 'native'} />
    <input type="hidden" name="data" value={JSON.stringify(values)} disabled={!enhanced} />
    {#each Object.entries(definition.fields) as [fieldSlug, field] (field.id)}
      {#if field.kind === 'string' || field.kind === 'richText'}
        <ContentTextField slug={fieldSlug} field={{ ...field, kind: field.kind }}
          name={enhanced ? undefined : `data.${fieldSlug}`} value={values[fieldSlug] ?? ''}
          onchange={value => change(fieldSlug, value)} />
      {:else}
        <p>{field.label || fieldSlug}: this field requires a configured editor.</p>
      {/if}
    {/each}
    <label for="content-slug">Slug</label>
    <input id="content-slug" name="slug" type="text" maxlength="200" bind:value={slug}
      oninput={() => { slugTouched = true; }} />
    <button type="submit">Save</button>
  </fieldset>
  {#each createForm.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
  {#if message}<p role="alert">{message}</p>{/if}
</form>

<style>
  fieldset { padding: 24px; border: 1px solid #d9e0eb; border-radius: 12px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 18px 8px; font-weight: 600; }
  input:not([type='hidden']) { inline-size: 100%; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  button { margin-block-start: 24px; padding: 10px 18px; }
</style>
