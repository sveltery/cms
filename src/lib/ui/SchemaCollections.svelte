<script lang="ts">
  import { createSchemaCollection } from '$lib/schema.remote';
  const controlsId = $props.id();
  let { collections = [], unavailable = false, disabled = true }: {
    collections?: { slug: string; label: string; href: string }[];
    unavailable?: boolean;
    disabled?: boolean;
  } = $props();
  let supportsMode = $state('keep');
  let drafts = $state(true);
  let revisions = $state(true);
  let setSingular = $state(false);
  let setDescription = $state(false);
  const supports = $derived(JSON.stringify([...(drafts ? ['drafts'] : []), ...(revisions ? ['revisions'] : [])]));
</script>

<h1>Schema</h1>
{#if unavailable}
  <p role="status">Schema is unavailable until authentication and storage are configured.</p>
{:else}
  <ul aria-label="Schema collections">
    {#each collections as collection (collection.slug)}
      <li><a href={collection.href}>{collection.label}</a> <code>{collection.slug}</code></li>
    {:else}
      <li>No collections yet.</li>
    {/each}
  </ul>
{/if}
<form {...createSchemaCollection}>
  <fieldset {disabled}>
    <legend>Create collection</legend>
    <label>Collection slug <input {...createSchemaCollection.fields.slug.as('text')} required maxlength="63" pattern="[a-z][a-z0-9_]*" /></label>
    <label>Collection label <input {...createSchemaCollection.fields.label.as('text')} required maxlength="200" /></label>
    <label class="toggle"><input type="checkbox" bind:checked={setSingular} /> Set singular label</label>
    <label>Singular label <input {...createSchemaCollection.fields.labelSingular.as('text')} disabled={!setSingular} required={setSingular} maxlength="200" /></label>
    <label class="toggle"><input type="checkbox" bind:checked={setDescription} /> Set description</label>
    <label>Description <textarea {...createSchemaCollection.fields.description.as('text')} disabled={!setDescription} maxlength="2000"></textarea></label>
    <label for={`${controlsId}-supports`}>Supports</label>
    <select id={`${controlsId}-supports`} bind:value={supportsMode}>
      <option value="keep">Use default supports</option>
      <option value="set">Set supports</option>
    </select>
    {#if supportsMode === 'set'}
      <input {...createSchemaCollection.fields.supports.as('hidden', supports)} />
      <label class="toggle"><input type="checkbox" bind:checked={drafts} /> Drafts</label>
      <label class="toggle"><input type="checkbox" bind:checked={revisions} /> Revisions</label>
      <p>Leaving both unchecked stores an empty supports list.</p>
    {/if}
    <button type="submit" disabled={createSchemaCollection.pending > 0}>Create collection</button>
  </fieldset>
  {#if createSchemaCollection.fields.allIssues()?.length}
    <ul aria-label="Collection validation errors">
      {#each createSchemaCollection.fields.allIssues() ?? [] as issue}<li>{issue.message}</li>{/each}
    </ul>
  {/if}
  {#if createSchemaCollection.result}<p role="status">Collection created: {createSchemaCollection.result.slug}.</p>{/if}
</form>
{#if disabled}<p>Writes will be available after authentication and persistence are configured.</p>{/if}

<style>
  h1 { margin: 0 0 24px; }
  fieldset { border: 1px solid #d9e0eb; border-radius: 12px; padding: 24px; margin-top: 24px; }
  legend { font-weight: 600; }
  label { display: block; margin-block: 12px; }
  input, textarea, select { display: block; inline-size: 100%; margin-block-start: 8px; padding: 10px; border: 1px solid #c4cedd; border-radius: 6px; font: inherit; }
  .toggle input { display: inline; inline-size: auto; margin-inline-end: 8px; }
  textarea { min-block-size: 100px; }
  button { padding: 10px 18px; }
  p { color: #526079; font-size: 14px; }
  code { margin-left: 8px; }
</style>
