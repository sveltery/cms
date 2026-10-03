<script lang="ts">
  import { untrack } from 'svelte';
  // Preserve Source updatedAt-keyed form lifecycle and serialized dirty check.
  import type { Section, UpdateSectionInput } from '$lib/sections-widgets/api.ts';
  import type { BlockSidebarPanel, EditorRenderer, PluginBlockDef } from '$lib/sections-widgets/editor.ts';
  import BlockSettings from './BlockSettings.svelte';
  let { section, isSaving, pluginBlocks, onSave, editor, canManage }: { section: Section; isSaving: boolean; pluginBlocks: PluginBlockDef[]; onSave: (input: UpdateSectionInput) => void; editor?: EditorRenderer; canManage: boolean } = $props();
  const initial = untrack(() => section);
  let title = $state(initial.title), slug = $state(initial.slug), description = $state(initial.description || ''), keywords = $state(initial.keywords.join(', ')), content = $state<unknown[]>(initial.content);
  const lastSaved = JSON.stringify({ title: initial.title, slug: initial.slug, description: initial.description || '', keywords: initial.keywords.join(', '), content: initial.content });
  const dirty = $derived(JSON.stringify({ title, slug, description, keywords, content }) !== lastSaved);
  const saveLabel = $derived(isSaving ? 'Saving...' : dirty ? 'Save' : 'Saved');
  let panel = $state<BlockSidebarPanel | null>(null);
  function closePanel() { panel?.onClose(); panel = null; }
  function save() { onSave({ title, slug, description: description || undefined, keywords: keywords.split(',').map(keyword => keyword.trim()).filter(Boolean), content }); }
</script>
<header class="toolbar"><div><a href="/sections" aria-label="Back to sections">←</a><h1>{section.title}</h1><p class="muted">{section.source === 'theme' ? 'Theme Section' : 'Custom Section'} · {section.slug}</p></div><button disabled={isSaving || !dirty || !canManage} onclick={save}>{saveLabel}</button><span role="status">{saveLabel}</span></header>
<div class="editor-layout"><div class="editor-main"><section class="panel"><h2>Content</h2>{#if editor}{@render editor({ value: content, onChange: value => { content = value; }, pluginBlocks, onBlockSidebarOpen: value => { panel = value; }, onBlockSidebarClose: closePanel })}{:else}<p role="alert">Content editing is unavailable until a compatible rich-content editor is configured.</p>{/if}</section><div class="actions"><button disabled={isSaving || !dirty || !canManage} onclick={save}>{saveLabel}</button></div></div>
  <aside class="editor-sidebar">{#if panel}<BlockSettings {panel} onClose={closePanel} onDelete={() => { panel?.onDelete(); panel = null; }} />{:else}<section class="panel"><h2>Section Details</h2><label>Title<input placeholder="Section title" bind:value={title} disabled={!canManage} /></label><label>Slug<input placeholder="section-slug" pattern="[a-z0-9\-]+" bind:value={slug} disabled={!canManage} /></label><p class="muted">Used to identify this section. Lowercase letters, numbers, and hyphens only.</p><label>Description<textarea rows="3" placeholder="Describe what this section is for..." bind:value={description} disabled={!canManage}></textarea></label><label>Keywords<input placeholder="hero, banner, cta" bind:value={keywords} disabled={!canManage} /></label><p class="muted">Comma-separated keywords for search.</p></section>
  <section class="panel"><h2>Source</h2><p class="muted">{section.source === 'theme' ? 'This section is provided by the theme. Editing will create a custom copy that overrides the theme version.' : section.source === 'import' ? 'This section was imported from another system.' : 'This is a custom section.'}</p>{#if section.themeId}<p class="muted">Theme ID: {section.themeId}</p>{/if}</section>{/if}</aside>
</div>
