<script lang="ts">
  // Native Svelte port of pinned SectionEditor.tsx; MIT notice in notices/emdash-MIT.txt.
  import * as nativeApi from '$lib/sections-widgets/api.ts';
  import { getPluginBlocks } from '$lib/sections-widgets/plugin-blocks.ts';
  import type { Section, UpdateSectionInput } from '$lib/sections-widgets/api.ts';
  import type { EditorRenderer, PluginBlockDef } from '$lib/sections-widgets/editor.ts';
  import SectionEditorForm from './SectionEditorForm.svelte';
  import './admin.css';
  let { slug, api = nativeApi, editor, canManage = true, navigate = (nextSlug: string) => { window.location.href = `/sections/${encodeURIComponent(nextSlug)}`; } }: { slug: string; api?: typeof nativeApi; editor?: EditorRenderer; canManage?: boolean; navigate?: (slug: string) => void } = $props();
  let section = $state<Section | null>(null), loading = $state(true), error = $state(''), isSaving = $state(false), saveError = $state('');
  let pluginBlocks = $state<PluginBlockDef[]>([]), manifestError = $state('');
  $effect(() => {
    const currentSlug = slug; let active = true;
    loading = true; error = '';
    void api.fetchSection(currentSlug).then(value => { if (active) section = value; }).catch(cause => { if (active) error = cause instanceof Error ? cause.message : String(cause); }).finally(() => { if (active) loading = false; });
    void api.fetchManifest().then(manifest => { if (active) { pluginBlocks = getPluginBlocks(manifest); manifestError = ''; } }).catch(cause => { if (active) manifestError = cause instanceof Error ? cause.message : String(cause); });
    return () => { active = false; };
  });
  async function save(input: UpdateSectionInput) {
    isSaving = true; saveError = '';
    try { const updated = await api.updateSection(slug, input); section = updated; if (updated.slug !== slug) navigate(updated.slug); }
    catch (cause) { saveError = cause instanceof Error ? cause.message : String(cause); }
    finally { isSaving = false; }
  }
</script>
<div class="cms-sw">{#if loading}<p role="status">Loading section...</p>{:else if error || !section}<a href="/sections" aria-label="Back to sections">←</a><h1>Section Not Found</h1><p role="alert">{error || `Section "${slug}" could not be found.`}</p>{:else}{#key section.updatedAt}<SectionEditorForm {section} {isSaving} {pluginBlocks} {editor} {canManage} onSave={input => void save(input)} />{/key}{#if saveError}<p role="alert">Error saving section: {saveError}</p>{/if}{#if manifestError}<p role="alert">Plugin definitions are unavailable: {manifestError}</p>{/if}{/if}</div>
