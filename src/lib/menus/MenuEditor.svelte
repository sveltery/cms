<script lang="ts">
  // Native rendering of pinned EmDash MenuEditor, 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
  // Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
  import * as api from './client.ts';
  import MenuDialog from './MenuDialog.svelte';
  import type { ContentClient, ContentChoice, MenuClient, MenuItem, MenuWithItems, MenuTranslation } from './types.ts';
  let { name, locale, client = api, basePath = '', locales = [], mutationsEnabled = true, contentClient,
    navigate = (url: string) => { location.href = url; } }:
    { name: string; locale?: string; client?: MenuClient; basePath?: string; locales?: string[]; mutationsEnabled?: boolean; contentClient?: ContentClient; navigate?: (url:string)=>void } = $props();
  const key = $props.id();
  let menu = $state<MenuWithItems | null>(null), localItems = $state<MenuItem[]>([]), loading = $state(true), error = $state('');
  let addOpen = $state(false), addPending = $state(false), addError = $state('');
  let editingItem = $state<MenuItem | null>(null), editPending = $state(false), editError = $state(''), parentOpen = $state(false), parentId = $state('');
  let translations = $state<MenuTranslation[]>([]), translationPending = $state<string | null>(null);
  let contentOpen = $state(false), collection = $state(''), collections = $state<{slug:string;label:string}[]>([]), choices = $state<ContentChoice[]>([]), contentLoading = $state(false);
  const menuLocale = $derived(locale ?? menu?.locale);
  async function load() { loading = true; error = ''; try {
    menu = await client.fetchMenu(name, { locale }); localItems = menu.items;
    if (locales.length > 1) translations = (await client.fetchMenuTranslations(name, { locale: locale ?? menu.locale })).translations;
  } catch (caught) { error = caught instanceof Error ? caught.message : 'Failed to fetch menu'; } finally { loading = false; } }
  $effect(() => { name; locale; void load(); });

  // Source parent-first traversal, including its visited-set cycle protection.
  function displayList(items: MenuItem[]) {
    const children = new Map<string | null, MenuItem[]>(); for (const item of items) { const siblings = children.get(item.parentId) ?? []; siblings.push(item); children.set(item.parentId, siblings); }
    const result: {item:MenuItem;depth:number}[] = [], visited = new Set<string>();
    function visit(parent: string | null, depth: number) { for (const item of children.get(parent) ?? []) { if (visited.has(item.id)) continue; visited.add(item.id); result.push({item,depth}); visit(item.id,depth+1); } }
    visit(null,0); return result;
  }
  function excludedIds(rootId: string) { const ids = new Set([rootId]); function visit(id: string) { for (const item of localItems.filter(value => value.parentId === id)) { if (ids.has(item.id)) continue; ids.add(item.id); visit(item.id); } } visit(rootId); return ids; }
  const rows = $derived(displayList(localItems));
  const parentOptions = $derived(editingItem ? rows.filter(({item}) => !excludedIds(editingItem!.id).has(item.id)) : []);
  function formValue(data: FormData, name: string) { const value = data.get(name); return typeof value === 'string' ? value : ''; }
  async function add(event: SubmitEvent) { event.preventDefault(); if (addPending) return; addPending = true; addError = '';
    const data = new FormData(event.currentTarget as HTMLFormElement);
    try { await client.createMenuItem(name, { type: 'custom', label: formValue(data,'label'), customUrl: formValue(data,'url'), target: formValue(data,'target') || undefined }, { locale: menuLocale }); addOpen = false; await load(); }
    catch (caught) { addError = caught instanceof Error ? caught.message : 'Failed to create menu item'; } finally { addPending = false; }
  }
  function edit(item: MenuItem) { editingItem = item; parentId = item.parentId ?? ''; parentOpen = false; editError = ''; }
  async function save(event: SubmitEvent) { event.preventDefault(); if (!editingItem || editPending) return; editPending = true; editError = '';
    const data = new FormData(event.currentTarget as HTMLFormElement);
    try { await client.updateMenuItem(name, editingItem.id, { label: formValue(data,'label'), customUrl: editingItem.type === 'custom' ? formValue(data,'url') : undefined,
      target: formValue(data,'target') || undefined, parentId: parentId || null }, { locale: menuLocale }); editingItem = null; await load(); }
    catch (caught) { editError = caught instanceof Error ? caught.message : 'Failed to update menu item'; } finally { editPending = false; }
  }
  async function remove(id: string) { try { await client.deleteMenuItem(name,id,{locale:menuLocale}); await load(); } catch (caught) { error = caught instanceof Error ? caught.message : 'Failed to delete menu item'; } }
  async function move(id: string, direction: number) { const item = localItems.find(value => value.id === id); if (!item) return;
    const siblings = localItems.filter(value => value.parentId === item.parentId), position = siblings.findIndex(value => value.id === id), target = siblings[position+direction]; if (!target) return;
    const next = [...localItems], ownIndex = next.findIndex(value => value.id === id), targetIndex = next.findIndex(value => value.id === target.id); next[ownIndex] = target; next[targetIndex] = item; localItems = next;
    try { await client.reorderMenuItems(name,{items:next.map((value,sortOrder) => ({id:value.id,parentId:value.parentId,sortOrder}))},{locale:menuLocale}); await load(); }
    catch (caught) { error = caught instanceof Error ? caught.message : 'Failed to reorder menu items'; }
  }
  async function translate(targetLocale: string) { if (translationPending) return; translationPending = targetLocale;
    try { const translated = await client.createMenuTranslation(name,{locale:targetLocale,label:menu?.label},{locale:menuLocale}); navigate(`${basePath}/menus/${name}?locale=${encodeURIComponent(translated.locale)}`); }
    catch (caught) { error = caught instanceof Error ? caught.message : 'Failed to create menu translation'; } finally { translationPending = null; }
  }
  async function openContent() { if (!contentClient) return; contentOpen = true; contentLoading = true;
    try { collections = await contentClient.collections(); collection = collections[0]?.slug ?? ''; await loadChoices(); }
    catch (caught) { error = caught instanceof Error ? caught.message : 'Failed to fetch content'; } finally { contentLoading = false; }
  }
  async function loadChoices() { if (!contentClient || !collection) return; contentLoading = true; try { choices = await contentClient.entries(collection,menuLocale); } catch (caught) { error = caught instanceof Error ? caught.message : 'Failed to fetch content'; } finally { contentLoading = false; } }
  async function chooseContent(choice: ContentChoice) { addPending = true; try { await client.createMenuItem(name,{type:choice.collection === 'pages' ? 'page' : choice.collection === 'posts' ? 'post' : 'collection',label:choice.title,referenceCollection:choice.collection,referenceId:choice.id},{locale:menuLocale}); contentOpen = false; await load(); } catch (caught) { error = caught instanceof Error ? caught.message : 'Failed to create menu item'; } finally { addPending = false; } }
</script>

<a href={`${basePath}/menus`} aria-label="Back to menus">Back</a>
{#if loading}<p>Loading menu...</p>{:else if !menu}<p role="alert">{error || 'Menu not found'}</p>{:else}
  <header><div><h1>{menu.label}</h1><p>Edit menu items</p></div><div><button disabled={!mutationsEnabled || !contentClient} onclick={openContent}>Add Content</button> <button disabled={!mutationsEnabled} onclick={() => { addOpen = true; addError = ''; }}>Add Custom Link</button></div></header>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if locales.length > 1}<section class="translations"><h2>Translations</h2>{#each locales as target}<button disabled={translationPending !== null || target === menu.locale || (!mutationsEnabled && !translations.some(value => value.locale === target))} onclick={() => translations.some(value => value.locale === target) ? navigate(`${basePath}/menus/${name}?locale=${encodeURIComponent(target)}`) : translate(target)}>{target.toUpperCase()}{translations.some(value => value.locale === target) ? '' : ' — Create translation'}</button>{/each}</section>{/if}
  {#if localItems.length === 0}<section class="border empty"><h3>No menu items yet</h3><p>Add links to build your navigation menu</p></section>
  {:else}{#each rows as {item,depth} (item.id)}{@const siblings = localItems.filter(value => value.parentId === item.parentId)}{@const index = siblings.findIndex(value => value.id === item.id)}
    <div class="border row" style:margin-inline-start={`${depth*1.5}rem`}><div><strong>{item.label}</strong><p>{item.type === 'custom' ? item.customUrl : item.referenceCollection ?? item.type}{item.target === '_blank' ? ' (opens in new window)' : ''}</p></div>
      <div><button aria-label="Move up" disabled={!mutationsEnabled || index === 0} onclick={() => move(item.id,-1)}>↑</button><button aria-label="Move down" disabled={!mutationsEnabled || index === siblings.length-1} onclick={() => move(item.id,1)}>↓</button><button disabled={!mutationsEnabled} onclick={() => edit(item)}>Edit</button><button aria-label="Delete" disabled={!mutationsEnabled} onclick={() => remove(item.id)}>Delete</button></div>
    </div>
  {/each}{/if}
{/if}

{#if addOpen}<MenuDialog labelledBy={`${key}-add`} onClose={() => { addOpen = false; addError = ''; }}><h2 id={`${key}-add`}>Add Custom Link</h2><button aria-label="Close" onclick={() => { addOpen = false; addError = ''; }}>×</button>
  <form onsubmit={add}><label for={`${key}-add-label`}>Label</label><input id={`${key}-add-label`} name="label" required placeholder="Home" />
    <label for={`${key}-add-url`}>URL</label><input id={`${key}-add-url`} name="url" type="text" required pattern="(https?://.+|/.*)" title="Enter a URL (https://…) or a relative path (/…)" placeholder="https://example.com or /about" />
    <label for={`${key}-add-target`}>Target</label><select id={`${key}-add-target`} name="target"><option value="">Same window</option><option value="_blank">New window</option></select>
    {#if addError}<p role="alert">{addError}</p>{/if}<footer><button type="button" onclick={() => { addOpen = false; addError = ''; }}>Cancel</button><button type="submit" disabled={addPending}>{addPending ? 'Adding...' : 'Add'}</button></footer>
  </form>
</MenuDialog>{/if}
{#if editingItem}<MenuDialog labelledBy={`${key}-edit`} onClose={() => { editingItem = null; editError = ''; }}><h2 id={`${key}-edit`}>Edit Menu Item</h2><button aria-label="Close" onclick={() => { editingItem = null; editError = ''; }}>×</button>
  <form onsubmit={save}><label for={`${key}-edit-label`}>Label</label><input id={`${key}-edit-label`} name="label" required value={editingItem.label} />
    {#if editingItem.type === 'custom'}<label for={`${key}-edit-url`}>URL</label><input id={`${key}-edit-url`} name="url" type="text" required pattern="(https?://.+|/.*)" title="Enter a URL (https://…) or a relative path (/…)" value={editingItem.customUrl ?? ''} />{/if}
    <label for={`${key}-edit-target`}>Target</label><select id={`${key}-edit-target`} name="target" value={editingItem.target ?? ''}><option value="">Same window</option><option value="_blank">New window</option></select>
    <label for={`${key}-parent`}>Parent</label><button id={`${key}-parent`} aria-label="Parent" type="button" role="combobox" aria-expanded={parentOpen} aria-controls={`${key}-options`} onclick={() => parentOpen = !parentOpen}>{localItems.find(value => value.id === parentId)?.label ?? 'No parent (top level)'}</button>
    <input type="hidden" name="parentId" value={parentId} />
    {#if parentOpen}<div role="listbox" id={`${key}-options`}><button role="option" aria-selected={parentId === ''} type="button" onclick={() => { parentId = ''; parentOpen = false; }}>No parent (top level)</button>{#each parentOptions as {item,depth}}<button role="option" aria-selected={parentId === item.id} type="button" style:margin-inline-start={`${depth*1.5}rem`} onclick={() => { parentId = item.id; parentOpen = false; }}>{item.label}</button>{/each}</div>{/if}
    {#if editError}<p role="alert">{editError}</p>{/if}<footer><button type="button" onclick={() => { editingItem = null; editError = ''; }}>Cancel</button><button type="submit" disabled={editPending}>{editPending ? 'Saving...' : 'Save'}</button></footer>
  </form>
</MenuDialog>{/if}
{#if contentOpen}<MenuDialog labelledBy={`${key}-content`} onClose={() => contentOpen = false}><h2 id={`${key}-content`}>Add Content</h2><button aria-label="Close" onclick={() => contentOpen = false}>×</button>
  <label for={`${key}-collection`}>Collection</label><select id={`${key}-collection`} bind:value={collection} onchange={loadChoices}>{#each collections as value}<option value={value.slug}>{value.label}</option>{/each}</select>
  {#if contentLoading}<p>Loading content...</p>{:else}<ul>{#each choices as choice (choice.id)}<li><button disabled={addPending} onclick={() => chooseContent(choice)}>{choice.title}</button></li>{/each}</ul>{/if}
</MenuDialog>{/if}

<style>
  header,.row,footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; } .border { border:1px solid #d4d4d8; padding:1rem; margin-block:.5rem; border-radius:.5rem; } .empty { text-align:center; padding:3rem; } button { padding:.45rem .7rem; cursor:pointer; } button:disabled { cursor:default; opacity:.5; }
    form { display:grid; gap:.65rem; } input,select { padding:.6rem; border:1px solid #a1a1aa; border-radius:.35rem; } [role=listbox] { display:flex; flex-direction:column; border:1px solid #d4d4d8; } [role=option] { text-align:start; } [role=alert] { color:#b91c1c; } .translations { margin-block:1rem; }
</style>
