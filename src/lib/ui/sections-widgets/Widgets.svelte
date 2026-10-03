<script lang="ts">
  // Native Svelte port of pinned Widgets.tsx; MIT notice in notices/emdash-MIT.txt.
  import { untrack } from 'svelte';
  import * as nativeApi from '$lib/sections-widgets/api.ts';
  import type { WidgetArea, WidgetComponent, CreateWidgetInput, UpdateWidgetInput } from '$lib/sections-widgets/api.ts';
  import type { EditorRenderer, PluginBlockDef, BlockSidebarPanel } from '$lib/sections-widgets/editor.ts';
  import { getPluginBlocks } from '$lib/sections-widgets/plugin-blocks.ts';
  import { getWidgetPalette } from '$lib/sections-widgets/palette.ts';
  import WidgetEditor from './WidgetEditor.svelte';
  import BlockSettings from './BlockSettings.svelte';
  import { modal } from './modal.ts';
  import './admin.css';
  let { api = nativeApi, editor, canManage = true }: { api?: typeof nativeApi; editor?: EditorRenderer; canManage?: boolean } = $props();
  let areas = $state<WidgetArea[]>([]), components = $state<WidgetComponent[]>([]), pluginBlocks = $state<PluginBlockDef[]>([]), loading = $state(true), loadError = $state(''), componentError = $state(''), manifestError = $state('');
  let createOpen = $state(false), deleteArea = $state<string | null>(null), expanded = $state(new Set<string>()), pending = $state(false), actionError = $state(''), status = $state(''), panel = $state<BlockSidebarPanel | null>(null);
  let loaded = $state(false);
  let drag = $state<{ source: 'palette'; input: CreateWidgetInput; label: string } | { source: 'area'; area: string; id: string } | null>(null);
  const palette = $derived(getWidgetPalette(components));
  async function load() {
    loading = !loaded; loadError = '';
    try { areas = await api.fetchWidgetAreas(); loaded = true; } catch (cause) { loadError = cause instanceof Error ? cause.message : String(cause); } finally { loading = false; }
  }
  $effect(() => {
    untrack(() => void load()); let active = true;
    void api.fetchWidgetComponents().then(value => { if (active) components = value; }).catch(cause => { if (active) componentError = cause instanceof Error ? cause.message : String(cause); });
    void api.fetchManifest().then(manifest => { if (active) pluginBlocks = getPluginBlocks(manifest); }).catch(cause => { if (active) manifestError = cause instanceof Error ? cause.message : String(cause); });
    return () => { active = false; };
  });
  async function mutate(callback: () => Promise<unknown>, message: string) {
    pending = true; actionError = '';
    try { await callback(); status = message; await load(); return true; }
    catch (cause) { actionError = cause instanceof Error ? cause.message : String(cause); return false; }
    finally { pending = false; }
  }
  async function create(event: SubmitEvent) {
    event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement);
    const success = await mutate(() => api.createWidgetArea({ name: String(form.get('name') ?? ''), label: String(form.get('label') ?? ''), description: String(form.get('description') ?? '') }), 'Widget area created');
    if (success) createOpen = false;
  }
  function toggle(id: string) { const next = new Set(expanded); if (next.has(id)) next.delete(id); else next.add(id); expanded = next; }
  function closePanel() { panel?.onClose(); panel = null; }
  function openPanel(next: BlockSidebarPanel) { panel?.onClose(); panel = next; }
  async function drop(areaName: string, overId?: string) {
    const active = drag; drag = null;
    if (!active || !canManage) return;
    if (active.source === 'palette') { await mutate(() => api.createWidget(areaName, active.input), 'Widget added'); return; }
    if (active.area !== areaName || !overId || active.id === overId) return;
    const area = areas.find(value => value.name === areaName), widgets = [...(area?.widgets ?? [])];
    const oldIndex = widgets.findIndex(value => value.id === active.id), newIndex = widgets.findIndex(value => value.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const [moved] = widgets.splice(oldIndex, 1); if (!moved) return; widgets.splice(newIndex, 0, moved);
    await mutate(() => api.reorderWidgets(areaName, widgets.map(widget => widget.id)), 'Widgets reordered');
  }
  function dragStart(event: DragEvent, value: NonNullable<typeof drag>) { if (!canManage) { event.preventDefault(); return; } drag = value; event.dataTransfer?.setData('text/plain', value.source === 'area' ? value.id : value.label); }
  async function move(area: WidgetArea, id: string, offset: number) {
    const widgets = area.widgets ?? [], index = widgets.findIndex(widget => widget.id === id), target = widgets[index + offset];
    if (!target) return; drag = { source: 'area', area: area.name, id }; await drop(area.name, target.id);
  }
</script>
<div class="cms-sw"><header class="toolbar"><div><h1>Widgets</h1><p class="muted">Manage content widgets in your widget areas</p></div><button disabled={!canManage} onclick={() => { createOpen = true; actionError = ''; }}>Add Widget Area</button></header>
{#if loading}<p role="status">Loading widgets...</p>{:else if loadError && !loaded}<div role="alert"><p>{loadError}</p><button onclick={() => void load()}>Retry</button></div>{:else}<div class="overflow-x-auto"><div class="grid grid-cols-12 min-w-[768px] widget-grid"><aside class="widget-palette"><section class="panel"><h2>Available Widgets</h2><p class="muted">Drag widgets into an area to add them</p>{#each palette as item}<button draggable={canManage} disabled={!canManage} ondragstart={event => dragStart(event, { source: 'palette', input: item.input, label: item.label })} ondragend={() => { drag = null; }} onclick={() => { drag = { source: 'palette', input: item.input, label: item.label }; }}><strong>{item.label}</strong>{#if item.description}<p class="muted">{item.description}</p>{/if}</button>{/each}{#if componentError}<p role="alert">Widget components are unavailable: {componentError}</p>{/if}</section></aside><main class="widget-areas">{#each areas as area (area.id)}<section class="widget-area"><div class="p-4 border-b"><div><h3>{area.label}</h3>{#if area.description}<p class="muted">{area.description}</p>{/if}</div><button aria-label={`Delete ${area.label} widget area`} disabled={!canManage} onclick={() => { deleteArea = area.name; actionError = ''; }}>Delete</button></div>
  <div class="widget-list" role="region" aria-label={`${area.label} widgets`} ondragover={event => { if (drag?.source === 'palette') event.preventDefault(); }} ondrop={event => { event.preventDefault(); void drop(area.name); }}>
  {#each area.widgets ?? [] as widget (widget.id)}<div class="widget-item" role="group" aria-label={widget.title || 'Untitled Widget'} ondragover={event => { if (drag?.source === 'area' && drag.area === area.name) event.preventDefault(); }} ondrop={event => { if (drag?.source === 'area') { event.preventDefault(); event.stopPropagation(); void drop(area.name, widget.id); } }}>
    <div class="actions"><button draggable={canManage} aria-label={`Drag to reorder ${widget.title ?? 'widget'}`} ondragstart={event => dragStart(event, { source: 'area', area: area.name, id: widget.id })} ondragend={() => { drag = null; }} onkeydown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); void move(area, widget.id, event.key === 'ArrowUp' ? -1 : 1); } }}>⠿</button><button class="text-start" aria-expanded={expanded.has(widget.id)} onclick={() => toggle(widget.id)}><span>{widget.title || 'Untitled Widget'}</span> <span class="muted">({widget.type})</span></button><button disabled={pending || !canManage} aria-label={`Delete ${widget.title ?? 'widget'}`} onclick={() => void mutate(() => api.deleteWidget(area.name, widget.id), 'Widget deleted')}>Delete</button></div>
    {#if expanded.has(widget.id)}<WidgetEditor {widget} {components} {pluginBlocks} {api} {editor} {canManage} isSaving={pending} onSave={(input: UpdateWidgetInput) => void mutate(() => api.updateWidget(area.name, widget.id, input), 'Widget updated')} onBlockSidebarOpen={openPanel} onBlockSidebarClose={closePanel} />{/if}
  </div>{/each}
  {#if drag?.source === 'palette'}<button disabled={!canManage} onclick={() => void drop(area.name)}>Drop to add widget</button>{:else if !area.widgets?.length}<p class="muted">Drag widgets here to add them</p>{/if}
  </div></section>{:else}<p>No widget areas yet. Create one to get started.</p>{/each}</main></div></div>{/if}
{#if panel}<BlockSettings {panel} onClose={closePanel} onDelete={() => { panel?.onDelete(); panel = null; }} />{/if}
{#if loadError && loaded}<p role="alert">{loadError}</p>{/if}
{#if manifestError}<p role="alert">Plugin definitions are unavailable: {manifestError}</p>{/if}{#if actionError && !createOpen && !deleteArea}<p role="alert">{actionError}</p>{/if}{#if status}<p role="status">{status}</p>{/if}
{#if createOpen}<div class="modal-backdrop"><dialog class="modal" use:modal={() => { createOpen = false; actionError = ''; }} aria-labelledby="create-widget-area-title"><h2 id="create-widget-area-title">Create Widget Area</h2><form onsubmit={create}><label>Name<input name="name" required pattern="[a-z0-9\-]+" placeholder="sidebar" /></label><label>Label<input name="label" required placeholder="Main Sidebar" /></label><label>Description<input name="description" placeholder="Appears on posts and pages" /></label>{#if actionError}<p role="alert">{actionError}</p>{/if}<div class="actions"><button type="button" onclick={() => { createOpen = false; actionError = ''; }}>Cancel</button><button disabled={pending || !canManage} type="submit">{pending ? 'Creating...' : 'Create'}</button></div></form></dialog></div>{/if}
{#if deleteArea}<div class="modal-backdrop"><dialog class="modal" use:modal={() => { deleteArea = null; actionError = ''; }} aria-labelledby="delete-widget-area-title"><h2 id="delete-widget-area-title">Delete Widget Area?</h2><p>This will delete the widget area and all its widgets. This action cannot be undone.</p>{#if actionError}<p role="alert">{actionError}</p>{/if}<div class="actions"><button onclick={() => { deleteArea = null; actionError = ''; }}>Cancel</button><button disabled={pending || !canManage} onclick={async () => { const name = deleteArea; if (name && await mutate(() => api.deleteWidgetArea(name), 'Widget area deleted')) deleteArea = null; }}>{pending ? 'Deleting...' : 'Delete'}</button></div></dialog></div>{/if}
</div>
