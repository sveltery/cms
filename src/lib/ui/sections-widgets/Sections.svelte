<script lang="ts">
  // Native Svelte port of pinned EmDash Sections.tsx; MIT notice in notices/emdash-MIT.txt.
  import * as nativeApi from '$lib/sections-widgets/api.ts';
  import { slugify } from '$lib/sections-widgets/slugify.ts';
  import type { Section, SectionSource } from '$lib/sections-widgets/api.ts';
  import { modal } from './modal.ts';
  import './admin.css';
  let { api = nativeApi, navigate = (slug: string) => { window.location.href = `/sections/${encodeURIComponent(slug)}`; }, canManage = true }:
    { api?: typeof nativeApi; navigate?: (slug: string) => void; canManage?: boolean } = $props();
  let sections = $state<Section[]>([]), loading = $state(true), loadError = $state(false);
  let search = $state(''), source = $state<SectionSource | ''>('');
  let createOpen = $state(false), title = $state(''), slug = $state(''), description = $state(''), slugTouched = $state(false);
  let pending = $state(false), actionError = $state(''), status = $state('');
  let menuSlug = $state<string | null>(null), deleteSlug = $state<string | null>(null);
  let requestGeneration = 0;
  async function load(searchValue = search, sourceValue = source) {
    const generation = ++requestGeneration;
    loading = true; loadError = false;
    try {
      const data = await api.fetchSections({ source: sourceValue || undefined, search: searchValue || undefined });
      if (generation === requestGeneration) sections = data.items;
    } catch { if (generation === requestGeneration) loadError = true; }
    finally { if (generation === requestGeneration) loading = false; }
  }
  $effect(() => { void load(search, source); });
  function closeCreate() { createOpen = false; title = ''; slug = ''; description = ''; slugTouched = false; actionError = ''; }
  async function create(event: SubmitEvent) {
    event.preventDefault(); pending = true; actionError = '';
    try { const section = await api.createSection({ slug, title, description: description || undefined, content: [] }); closeCreate(); status = 'Section created'; await load(); navigate(section.slug); }
    catch (error) { actionError = error instanceof Error ? error.message : String(error); }
    finally { pending = false; }
  }
  async function remove() {
    if (!deleteSlug) return; pending = true; actionError = '';
    try { await api.deleteSection(deleteSlug); deleteSlug = null; status = 'Section deleted'; await load(); }
    catch (error) { actionError = error instanceof Error ? error.message : String(error); }
    finally { pending = false; }
  }
  const sectionToDelete = $derived(sections.find(section => section.slug === deleteSlug));
</script>

<div class="cms-sw">
  <header class="toolbar"><div><h1>Sections</h1><p class="muted">Reusable content blocks you can insert into any content</p></div><button disabled={!canManage} onclick={() => { createOpen = true; }}>New section</button></header>
  <div class="actions"><input aria-label="Search sections..." placeholder="Search sections..." bind:value={search} /><select aria-label="Filter by source" bind:value={source}><option value="">All sources</option><option value="theme">Theme</option><option value="user">Custom</option><option value="import">Imported</option></select></div>
  {#if loading}<p role="status">Loading sections...</p>
  {:else if loadError}<div role="alert"><p>Sections could not be loaded.</p><button onclick={() => void load()}>Retry</button></div>
  {:else if sections.length === 0}<div class="panel"><h2>{search || source ? 'No sections found' : 'No sections yet'}</h2><p>{search || source ? 'Try adjusting your search or filters.' : 'Create your first reusable content section to get started.'}</p>{#if search || source}<button onclick={() => { search = ''; source = ''; }}>Clear filters</button>{:else}<button disabled={!canManage} onclick={() => { createOpen = true; }}>Create section</button>{/if}</div>
  {:else}<div class="cards">{#each sections as section (section.id)}<article class="panel">
    {#if section.previewUrl}<img class="preview" src={section.previewUrl} alt={`Preview of ${section.title}`} />{/if}
    <h2 dir="auto" title={section.title}>{section.title}</h2><bdi dir="ltr">/{section.slug}</bdi><span class="muted"> · {section.source === 'theme' ? 'Theme' : section.source === 'import' ? 'Imported' : 'Custom'}</span>
    {#if section.description}<p dir="auto">{section.description}</p>{/if}
    <p class="muted">{#each section.keywords.slice(0, 3) as keyword}<bdi dir="auto">{keyword}</bdi>{' '}{/each}{#if section.keywords.length > 3}+{section.keywords.length - 3} more{/if}</p>
    <div class="actions"><button aria-label={`Edit ${section.title}`} onclick={() => navigate(section.slug)}>Edit</button><button aria-label={`More actions for ${section.title}`} aria-expanded={menuSlug === section.slug} onclick={() => { menuSlug = menuSlug === section.slug ? null : section.slug; }}>•••</button></div>
    {#if menuSlug === section.slug}<div role="menu"><button role="menuitem" onclick={async () => { try { await navigator.clipboard.writeText(section.slug); status = 'Slug copied to clipboard'; } catch (error) { actionError = String(error); } }}>Copy slug</button><button role="menuitem" aria-label={section.source === 'theme' ? undefined : `Delete ${section.title}`} aria-disabled={section.source === 'theme' || !canManage} disabled={section.source === 'theme' || !canManage} onclick={() => { deleteSlug = section.slug; menuSlug = null; actionError = ''; }}>{section.source === 'theme' ? 'Cannot delete theme sections' : 'Delete section'}</button></div>{/if}
  </article>{/each}</div>{/if}
  {#if status}<p role="status">{status}</p>{/if}
  {#if createOpen}<div class="modal-backdrop"><dialog class="modal" use:modal={closeCreate} aria-labelledby="create-section-title"><h2 id="create-section-title">Create section</h2><p>Name your section, then add its content in the editor.</p><form onsubmit={create}>
    <label>Title<input required placeholder="Hero Banner" value={title} oninput={event => { title = event.currentTarget.value; if (!slugTouched) slug = title.trim() ? slugify(title) : ''; }} /></label>
    <label>Slug<input required dir="ltr" pattern="[a-z0-9\-]+" placeholder="hero-banner" value={slug} oninput={event => { slug = event.currentTarget.value; slugTouched = true; }} /></label><p class="muted">Auto-generated from the title. You can change it.</p>
    <label>Description<textarea placeholder="A full-width hero banner with heading, text, and CTA button" rows="3" bind:value={description}></textarea></label>
    {#if actionError}<p role="alert">{actionError}</p>{/if}<div class="actions"><button type="button" onclick={closeCreate}>Cancel</button><button type="submit" disabled={pending || !canManage}>{pending ? 'Creating...' : 'Create section'}</button></div>
  </form></dialog></div>{/if}
  {#if deleteSlug}<div class="modal-backdrop"><dialog class="modal" use:modal={() => { deleteSlug = null; actionError = ''; }} aria-labelledby="delete-section-title"><h2 id="delete-section-title">Delete Section?</h2><p>{sectionToDelete?.source === 'theme' ? 'Theme-provided sections cannot be deleted. Edit the section to create a custom copy, then delete that.' : `This will permanently delete "${sectionToDelete?.title}". This action cannot be undone.`}</p>{#if actionError}<p role="alert">{actionError}</p>{/if}<div class="actions"><button onclick={() => { deleteSlug = null; actionError = ''; }}>Cancel</button><button disabled={pending || !canManage || sectionToDelete?.source === 'theme'} onclick={() => void remove()}>{pending ? 'Deleting...' : 'Delete'}</button></div></dialog></div>{/if}
</div>
