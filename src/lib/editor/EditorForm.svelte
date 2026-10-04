<script lang="ts">
  import { onMount, untrack, tick } from 'svelte';
  import { goto, beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { EditorCollection } from '../server/content/manifest';
  import { createContent, updateContent, deleteContent, getContent } from '../content.remote';
  import { autosaveEditorDraft } from '../editor-autosave.remote';
  import { EditorSession, type EditorRecord, type SavePayload, type EditorReceipt } from './session';
  import { EditorResponseError, editorError } from './errors';
  import WritableDraft from './WritableDraft.svelte';
  let { collection, definition, entry, canWrite, canTrash = false, isNew = false }: {
    collection: string; definition: EditorCollection; entry: EditorRecord;
    canWrite: boolean; canTrash?: boolean; isNew?: boolean;
  } = $props();
  const session = untrack(() => new EditorSession(entry, canWrite, definition.fields, isNew));
  let values = $state<Record<string, unknown>>(untrack(() => session.data));
  let slug = $state(untrack(() => session.slug));
  let revision = $state(untrack(() => session.revision));
  let pending = $state(false), dirty = $state(untrack(() => session.dirty));
  let conflict = $state(false), message = $state<string | undefined>();
  let trashPending = $state(false), trashError = $state<string | undefined>();
  const formKey = $derived(JSON.stringify([collection, entry.id, entry.locale]));
  const manualForm = $derived(isNew ? createContent.for(formKey) : updateContent.for(formKey));
  const automaticForm = $derived(autosaveEditorDraft.for(formKey));
  const trashForm = $derived(deleteContent.for(formKey));
  const scalarFields = $derived(Object.entries(definition.fields).filter(([, field]) =>
    (field.type === 'string' || field.type === 'text') && !field.widget && !field.unsupportedType
  ).map(([slug, field]) => ({ ...field, slug, validation: field.validation ?? null })));
  const deferredFields = $derived(Object.entries(definition.fields).filter(([slug]) => !scalarFields.some(field => field.slug === slug)));
  const issues = $derived(message ? [message] : []);
  function sync() {
    values = session.data; slug = session.slug; revision = session.revision;
    pending = session.pending; dirty = session.dirty; conflict = session.conflict; message = session.error;
  }
  onMount(() => session.subscribe(sync));
  $effect(() => {
    const next = entry, writable = canWrite;
    untrack(() => { session.writable = writable; session.receive(next); sync(); });
  });
  function edit(next: Record<string, unknown>) { session.edit(next, slug); sync(); }
  function editSlug(next: string) { session.edit(values, next); sync(); }
  // Source waits 2000ms, excludes new entries, and suppresses terminal repeats/conflicts.
  $effect(() => {
    const changed = JSON.stringify([values, slug, pending, dirty, conflict, canWrite, message]);
    void changed;
    if (!untrack(() => session.canAutosave)) return;
    const timer = setTimeout(() => { void programmaticSave(automaticForm, true); }, 2000);
    return () => clearTimeout(timer);
  });
  beforeNavigate(navigation => {
    if ((dirty || pending) && !window.confirm('You have unsaved changes. Leave this page?')) navigation.cancel();
  });
  onMount(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (session.dirty || session.pending) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });
  async function resolveConflict() {
    if (pending) return;
    try {
      const latest = getContent({ collection, id: entry.id, locale: entry.locale });
      await latest.refresh(); session.acceptLatestToken(await latest); sync();
      await programmaticSave(manualForm, false);
    } catch (cause) { message = editorError(cause).message; }
  }
  const localeAction = (action: string) => `${action}${action.includes('?') ? '&' : '?'}locale=${encodeURIComponent(entry.locale)}`;
  async function programmaticSave(form: typeof manualForm, autosave: boolean) {
    // Kit's public submit() performs transport directly, bypassing enhance().
    // Flush the current values/token before its synchronous FormData snapshot.
    await tick();
    await saved(() => form.submit(), form, autosave);
  }
  async function saved(submit: () => Promise<boolean>, form: typeof manualForm, autosave: boolean) {
    const success = await session.save(async (_payload: SavePayload): Promise<EditorReceipt> => {
      const accepted = await submit();
      if (!accepted || !form.result) throw new EditorResponseError(400, 'NATIVE_FORM_VALIDATION',
        form.fields.allIssues()?.map(issue => issue.message).join(' ') || 'Please check the entered values.');
      return form.result;
    }, autosave);
    sync();
    if (success && isNew) {
      // Only this accepted create can leave its pristine editor without warning.
      dirty = false;
      await goto(`${resolve('/content/[collection]/[id]', { collection, id: session.entry.id })}?locale=${encodeURIComponent(entry.locale)}`);
    }
  }
</script>

<form {...manualForm.enhance(async ({ submit }) => { await saved(submit, manualForm, false); })}
  action={localeAction(manualForm.action)} aria-label={isNew ? 'Create draft' : 'Edit draft'}>
  <input type="hidden" name="collection" value={collection} />
  <input type="hidden" name="locale" value={entry.locale} />
  {#if !isNew}<input type="hidden" name="id" value={entry.id} /><input type="hidden" name="_rev" value={revision} />{/if}
  <label for="entry-slug">Slug</label>
  <input id="entry-slug" name="slug" value={slug} oninput={event => editSlug(event.currentTarget.value)} disabled={!canWrite} maxlength="200" />
  <WritableDraft fields={scalarFields} {values} {pending} {dirty} {issues} {canWrite} onValuesChange={edit} />
  {#if deferredFields.length}
    <p>Other field values are preserved when saving.</p>
    <ul>{#each deferredFields as [name, field]}<li>{field.label || name}: read only.</li>{/each}</ul>
  {/if}
</form>
{#if !isNew}
  <form hidden {...automaticForm.enhance(async ({ submit }) => { await saved(submit, automaticForm, true); })}
    action={localeAction(automaticForm.action)} aria-label="Autosave draft">
    <input type="hidden" name="collection" value={collection} /><input type="hidden" name="id" value={entry.id} />
    <input type="hidden" name="locale" value={entry.locale} /><input type="hidden" name="_rev" value={revision} />
    <input type="hidden" name="data" value={JSON.stringify(values)} /><input type="hidden" name="slug" value={slug} />
  </form>
  {#if conflict}
    <div role="alert"><p>This entry changed somewhere else after you opened it.</p>
      <p>What you typed is still here. Saving replaces the newer version.</p>
      <button type="button" onclick={resolveConflict} disabled={!canWrite || pending}>Save anyway</button>
    </div>
  {/if}
  <p><a href={`${resolve('/content/[collection]/[id]/workflow', { collection, id: entry.id })}?locale=${encodeURIComponent(entry.locale)}`}>Publishing and history</a></p>
  <form {...trashForm.enhance(async ({ submit }) => {
    if (!canTrash || trashPending || pending) return;
    trashPending = true; trashError = undefined;
    try {
      if (await submit()) { dirty = false; await goto(resolve('/trash/[collection]', { collection })); }
      else trashError = trashForm.fields.allIssues()?.map(issue => issue.message).join(' ') || 'Please check this entry.';
    } catch (cause) { trashError = editorError(cause).message; }
    finally { trashPending = false; }
  })} action={localeAction(trashForm.action)} aria-label="Move draft to trash">
    <input type="hidden" name="collection" value={collection} /><input type="hidden" name="id" value={entry.id} />
    <input type="hidden" name="locale" value={entry.locale} /><input type="hidden" name="_rev" value={revision} />
    <button disabled={!canTrash || trashPending || pending}>{trashPending ? 'Moving to trash...' : 'Move to trash'}</button>
    {#if trashError}<p role="alert">{trashError}</p>{/if}
  </form>
{/if}
