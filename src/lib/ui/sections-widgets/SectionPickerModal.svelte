<script lang="ts">
  // Native Svelte port of pinned SectionPickerModal.tsx; MIT notice in notices/emdash-MIT.txt.
  import * as nativeApi from '$lib/sections-widgets/api.ts';
  import type { Section } from '$lib/sections-widgets/api.ts';
  import { modal } from './modal.ts';
  import './admin.css';
  let { open, onOpenChange, onSelect, api = nativeApi }: { open: boolean; onOpenChange: (open: boolean) => void; onSelect: (section: Section) => void; api?: typeof nativeApi } = $props();
  let search = $state(''), debounced = $state(''), loading = $state(false), sections = $state<Section[]>([]), error = $state('');
  let wasOpen = false, generation = 0;
  $effect(() => { if (open && !wasOpen) { search = ''; debounced = ''; } wasOpen = open; });
  $effect(() => { const value = search; const timer = setTimeout(() => { debounced = value; }, 300); return () => clearTimeout(timer); });
  $effect(() => {
    const opened = open, value = debounced, current = ++generation;
    if (!opened) return;
    loading = true; error = '';
    void api.fetchSections({ search: value || undefined }).then(data => { if (generation === current) sections = data.items; }).catch(cause => { if (generation === current) error = cause instanceof Error ? cause.message : String(cause); }).finally(() => { if (generation === current) loading = false; });
  });
</script>
{#if open}<div class="cms-sw"><div class="modal-backdrop"><dialog class="modal" use:modal={() => onOpenChange(false)} aria-labelledby="section-picker-title"><header class="toolbar"><h2 id="section-picker-title">Insert Section</h2><button aria-label="Close" onclick={() => onOpenChange(false)}>×</button></header>
  <input placeholder="Search sections..." aria-label="Search sections..." bind:value={search} />
  {#if loading}<p>Loading sections...</p>{:else if error}<p role="alert">{error}</p>{:else if sections.length === 0}<p>{debounced ? 'No sections found' : 'No sections available'}</p>{:else}<div class="cards">{#each sections as section (section.id)}<button class="panel" onclick={() => { onSelect(section); onOpenChange(false); }}>{#if section.previewUrl}<img class="preview" src={section.previewUrl} alt={`Preview of ${section.title}`} />{/if}<strong>{section.title}</strong>{#if section.description}<p>{section.description}</p>{/if}</button>{/each}</div>{/if}
  <button onclick={() => onOpenChange(false)}>Cancel</button>
</dialog></div></div>{/if}
