<script lang="ts">
  import { untrack } from 'svelte';
  import * as nativeApi from '$lib/sections-widgets/api.ts';
  import type { Widget, WidgetComponent, UpdateWidgetInput, Menu } from '$lib/sections-widgets/api.ts';
  import type { EditorRenderer, PluginBlockDef, BlockSidebarPanel } from '$lib/sections-widgets/editor.ts';
  let { widget, components, pluginBlocks, onSave, isSaving, api = nativeApi, editor, onBlockSidebarOpen, onBlockSidebarClose, canManage }: { widget: Widget; components: WidgetComponent[]; pluginBlocks: PluginBlockDef[]; onSave: (input: UpdateWidgetInput) => void; isSaving: boolean; api?: typeof nativeApi; editor?: EditorRenderer; onBlockSidebarOpen: (panel: BlockSidebarPanel) => void; onBlockSidebarClose: () => void; canManage: boolean } = $props();
  const initial = untrack(() => widget);
  let title = $state(initial.title ?? ''), content = $state<unknown[]>(Array.isArray(initial.content) ? initial.content : []), menuName = $state(initial.menuName ?? ''), componentId = $state(initial.componentId ?? ''), componentProps = $state<Record<string, unknown>>(initial.componentProps ?? {});
  let menus = $state<Menu[]>([]), menuError = $state('');
  const selectedComponent = $derived(components.find(component => component.id === componentId));
  $effect(() => {
    if (widget.type !== 'menu') return;
    let active = true;
    void api.fetchMenus().then(value => { if (active) { menus = value; menuError = ''; } }).catch(cause => { if (active) menuError = cause instanceof Error ? cause.message : String(cause); });
    return () => { active = false; };
  });
  function selectComponent(next: string) {
    if (next !== componentId) {
      const component = components.find(value => value.id === next);
      componentProps = component ? Object.fromEntries(Object.entries(component.props).map(([key, def]) => [key, def.default ?? ''])) : {};
    }
    componentId = next;
  }
  function prop(key: string, value: unknown) { componentProps = { ...componentProps, [key]: value }; }
  function save() {
    const input: UpdateWidgetInput = { title };
    if (widget.type === 'content') input.content = content;
    else if (widget.type === 'menu') input.menuName = menuName;
    else { input.componentId = componentId; input.componentProps = componentProps; }
    onSave(input);
  }
</script>
<div class="widget-form"><label>Title<input placeholder="Widget title" bind:value={title} disabled={!canManage} /></label>
  {#if widget.type === 'content'}<h4>Content</h4>{#if editor}{@render editor({ value: content, onChange: value => { content = value; }, minimal: true, placeholder: 'Write widget content...', pluginBlocks, onBlockSidebarOpen, onBlockSidebarClose })}{:else}<p role="alert">Content editing is unavailable until a compatible rich-content editor is configured.</p>{/if}
  {:else if widget.type === 'menu'}<label>Menu<select bind:value={menuName} disabled={!canManage || !!menuError}><option value="">Select a menu...</option>{#each menus as menu}<option value={menu.name}>{menu.label || menu.name}</option>{/each}</select></label>{#if menuError}<p role="alert">Menus are unavailable: {menuError}</p>{/if}
  {:else}<label>Component<select value={componentId} disabled={!canManage} onchange={event => selectComponent(event.currentTarget.value)}><option value="">Select a component...</option>{#each components as component}<option value={component.id}>{component.label}</option>{/each}</select></label>
    {#if selectedComponent}{#each Object.entries(selectedComponent.props) as [key, def]}{#if def.type === 'boolean'}<label><input type="checkbox" checked={Boolean(componentProps[key])} disabled={!canManage} onchange={event => prop(key, event.currentTarget.checked)} />{def.label}</label>{:else if def.type === 'select'}<label>{def.label}<select value={typeof componentProps[key] === 'string' ? componentProps[key] : ''} disabled={!canManage} onchange={event => prop(key, event.currentTarget.value)}>{#each def.options ?? [] as option}<option value={option.value}>{option.label}</option>{/each}</select></label>{:else}<label>{def.label}<input type={def.type === 'number' ? 'number' : 'text'} value={def.type === 'number' ? String(componentProps[key] ?? '') : typeof componentProps[key] === 'string' ? componentProps[key] : ''} disabled={!canManage} oninput={event => prop(key, def.type === 'number' ? Number(event.currentTarget.value) : event.currentTarget.value)} /></label>{/if}{/each}{/if}
  {/if}<button disabled={isSaving || !canManage} onclick={save}>{isSaving ? 'Saving...' : 'Save'}</button>
</div>
