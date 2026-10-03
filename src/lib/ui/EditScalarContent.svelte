<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { isHttpError } from '@sveltejs/kit';
  import type { EditorCollection } from '$lib/server/content/manifest';
  import { saveEditorContent, autosaveEditorContent } from '$lib/editor.remote';
  import ContentTextField from './ContentTextField.svelte';
  import BlocksField from './BlocksField.svelte';
  import { describeContentValidationError } from './content-validation-errors';
  let { collection, definition, item, disabled }: {
    collection: string; definition: EditorCollection;
    item: { id: string; locale: string; _rev: string; data: Record<string, unknown>; slug: string | null };
    disabled: boolean;
  } = $props();
  const key = $derived(JSON.stringify([collection, item.id, item.locale]));
  const saveForm = $derived(saveEditorContent.for(key));
  const autosaveForm = $derived(autosaveEditorContent.for(key));
  let values = $state<Record<string, unknown>>(untrack(() => ({...item.data})));
  let baseline = $state<Record<string, unknown>>(untrack(() => ({ ...item.data })));
  let touched = $state<string[]>([]);
  const changed = $derived(Object.fromEntries(touched.filter(field => values[field] !== baseline[field]).map(field => [field, values[field]])));
  let slug = $state(untrack(() => item.slug ?? ''));
  let baselineSlug = $state(untrack(() => item.slug ?? ''));
  let revision = $state(untrack(() => item._rev));
  let enhanced = $state(false);
  let message = $state<string | undefined>();
  let saved = $state(untrack(() => Boolean(saveForm.result)));
  let rejected = $state<string | undefined>();
  let conflict = $state(false);
  let autosaving = $state(false);
  let autosaveData = $state<Record<string, unknown>>({});
  let autosaveSlug = $state('');
  let autosaveRevision = $state('');
  const dirty = $derived(Object.keys(changed).length > 0 || slug !== baselineSlug);
  onMount(() => { enhanced = true; });
  function change(field: string, value: unknown) {
    values = { ...values, [field]: value };
    if (!touched.includes(field)) touched = [...touched, field];
    saved = false;
  }
  function failure(cause: unknown) {
    message = describeContentValidationError(cause, definition.fields) ??
      (isHttpError(cause) ? cause.body.message : 'Content could not be saved.');
    if (isHttpError(cause, 409)) conflict = true;
  }
  function accept(data: Record<string, unknown>, slug: string, token: string) {
    // Advance only the sent snapshot; edits made during the request stay dirty.
    baseline = { ...baseline, ...data };
    baselineSlug = slug;
    revision = token;
    rejected = undefined;
    saved = true;
  }
  const enhancedForm = $derived(saveForm.enhance(async form => {
    if (disabled || autosaving || conflict) return;
    const data = { ...changed };
    const sentSlug = slug;
    message = undefined;
    saved = false;
    try {
      if (await form.submit()) accept(data, sentSlug, saveForm.result!._rev);
    } catch (cause) { failure(cause); }
  }));
  async function autosave(data: Record<string, unknown>, sentSlug: string, payload: string) {
    autosaving = true;
    autosaveData = data;
    autosaveSlug = sentSlug;
    autosaveRevision = revision;
    message = undefined;
    saved = false;
    try {
      await tick();
      if (await autosaveForm.submit()) accept(data, sentSlug, autosaveForm.result!._rev);
      else rejected = payload;
    } catch (cause) { rejected = payload; failure(cause); }
    finally { autosaving = false; }
  }
  $effect(() => {
    const payload = JSON.stringify([changed, slug]);
    if (!enhanced || disabled || !dirty || autosaving || saveForm.pending > 0 || conflict || payload === rejected) return;
    const data = { ...changed };
    const sentSlug = slug;
    // Pinned ContentEditor AUTOSAVE_DELAY is 2000ms. New entries never mount this editor.
    const timer = setTimeout(() => { void autosave(data, sentSlug, payload); }, 2000);
    return () => clearTimeout(timer);
  });
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
          name={enhanced ? undefined : `data.${fieldSlug}`} value={typeof values[fieldSlug]==='string'?values[fieldSlug] as string:''}
          onchange={value => change(fieldSlug, value)} />
      {:else if field.kind==='blocks'}
        <BlocksField id={`field-${fieldSlug}`} fieldPath={fieldSlug} label={field.label} value={values[fieldSlug]??[]} blockTypes={field.blockTypes??[]} allowedTypes={field.validation?.allowedTypes??[]} retiredTypes={field.validation?.retiredTypes??[]} minItems={field.validation?.minItems} maxItems={field.validation?.maxItems} readOnly={!enhanced||disabled} onchange={value=>change(fieldSlug,value)}/>
        {#if !enhanced}<label>{field.label} (JSON)<textarea name={`jsonData.${fieldSlug}`}>{JSON.stringify(values[fieldSlug]??[])}</textarea></label>{/if}
      {:else}<p>{field.label || fieldSlug}: this field requires a configured editor.</p>{/if}
    {/each}
    <label for="content-slug">Slug</label>
    <input id="content-slug" name="slug" type="text" maxlength="200" bind:value={slug} oninput={() => { saved = false; }} />
    <button type="submit" disabled={autosaving || conflict}>{saveForm.pending > 0 || autosaving ? 'Saving…' : 'Save'}</button>
  </fieldset>
  {#each saveForm.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
  {#each autosaveForm.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
  {#if message}<p role="alert">{message}</p>{/if}
  {#if conflict}<p role="alert">Content changed elsewhere. Reload before saving.</p><button type="button" onclick={() => location.reload()}>Reload content</button>{/if}
  {#if saved && !dirty}<p role="status">Saved</p>{/if}
</form>
<form {...autosaveForm} hidden aria-label="Automatic content save">
  <input type="hidden" name="collection" value={collection} />
  <input type="hidden" name="id" value={item.id} />
  <input type="hidden" name="locale" value={item.locale} />
  <input type="hidden" name="_rev" value={autosaveRevision} />
  <input type="hidden" name="editorMode" value="changed" />
  <input type="hidden" name="data" value={JSON.stringify(autosaveData)} />
  <input type="hidden" name="slug" value={autosaveSlug} />
</form>
<style>
  fieldset { padding: 24px; border: 1px solid #d9e0eb; border-radius: 12px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 18px 8px; font-weight: 600; }
  input:not([type='hidden']) { inline-size: 100%; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  button { margin-block-start: 24px; padding: 10px 18px; }
</style>
