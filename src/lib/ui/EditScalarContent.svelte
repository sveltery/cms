<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { isHttpError } from '@sveltejs/kit';
  import type { EditorCollection } from '$lib/server/content/manifest';
  import { saveEditorContent } from '$lib/editor.remote';
  import ContentTextField from './ContentTextField.svelte';
  import { describeContentValidationError } from './content-validation-errors';
  let { collection, definition, item, disabled }: {
    collection: string; definition: EditorCollection;
    item: { id: string; locale: string; _rev: string; data: Record<string, unknown>; slug: string | null };
    disabled: boolean;
  } = $props();
  const saveForm = $derived(saveEditorContent.for(JSON.stringify([collection, item.id, item.locale])));
  let values = $state<Record<string, string>>(untrack(() => Object.fromEntries(Object.entries(item.data).map(([field, value]) => [field, typeof value === 'string' ? value : '']))));
  let changed = $state<Record<string, string>>({});
  let slug = $state(untrack(() => item.slug ?? ''));
  let revision = $state(untrack(() => item._rev));
  let enhanced = $state(false);
  let message = $state<string | undefined>();
  let saved = $state(false);
  onMount(() => { enhanced = true; });
  function change(field: string, value: string) {
    values = { ...values, [field]: value };
    changed = { ...changed, [field]: value };
    saved = false;
  }
  const enhancedForm = $derived(saveForm.enhance(async form => {
    message = undefined;
    saved = false;
    try {
      if (await form.submit()) {
        revision = saveForm.result!._rev;
        changed = {};
        saved = true;
      }
    } catch (cause) {
      message = describeContentValidationError(cause, definition.fields) ??
        (isHttpError(cause) ? cause.body.message : 'Content could not be saved.');
    }
  }));
</script>
<form {...enhancedForm}>
  <fieldset disabled={disabled || saveForm.pending > 0}>
    <legend>Edit {definition.labelSingular}</legend>
    <input type="hidden" name="collection" value={collection} />
    <input type="hidden" name="id" value={item.id} />
    <input type="hidden" name="locale" value={item.locale} />
    <input type="hidden" name="_rev" value={revision} />
    <input type="hidden" name="editorMode" value={enhanced ? 'changed' : 'native'} />
    <input type="hidden" name="data" value={JSON.stringify(changed)} disabled={!enhanced} />
    {#each Object.entries(definition.fields) as [fieldSlug, field] (field.id)}
      {#if field.kind === 'string' || field.kind === 'richText'}
        <ContentTextField slug={fieldSlug} field={{ ...field, kind: field.kind }}
          name={enhanced ? undefined : `data.${fieldSlug}`} value={values[fieldSlug] ?? ''}
          onchange={value => change(fieldSlug, value)} />
      {:else}<p>{field.label || fieldSlug}: this field requires a configured editor.</p>{/if}
    {/each}
    <label for="content-slug">Slug</label>
    <input id="content-slug" name="slug" type="text" maxlength="200" bind:value={slug} />
    <button type="submit">{saveForm.pending > 0 ? 'Saving…' : 'Save'}</button>
  </fieldset>
  {#each saveForm.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
  {#if message}<p role="alert">{message}</p>{/if}
  {#if saved || saveForm.result}<p role="status">Saved</p>{/if}
</form>
<style>
  fieldset { padding: 24px; border: 1px solid #d9e0eb; border-radius: 12px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 18px 8px; font-weight: 600; }
  input:not([type='hidden']) { inline-size: 100%; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  button { margin-block-start: 24px; padding: 10px 18px; }
</style>
