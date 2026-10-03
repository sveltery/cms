<script lang="ts">
  // Native Svelte rendering of pinned MenuList/MenuCard behavior; MIT attribution
  // and framework substitutions are recorded in docs/menus.md.
  // Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
  import * as api from './client.ts';
  import MenuDialog from './MenuDialog.svelte';
  import type { Menu, MenuClient } from './types.ts';
  let { client = api, basePath = '', locale, locales = [], mutationsEnabled = true, navigate = (url: string) => { location.href = url; } }:
    { client?: MenuClient; basePath?: string; locale?: string; locales?: string[]; mutationsEnabled?: boolean; navigate?: (url:string)=>void } = $props();
  let menus = $state<Menu[]>([]), loading = $state(true), error = $state('');
  let createOpen = $state(false), createPending = $state(false), createError = $state('');
  let deleteName = $state<string | null>(null), deletePending = $state(false), deleteError = $state('');
  const key = $props.id();
  async function load() { loading = true; error = ''; try { menus = await client.fetchMenus({ locale }); } catch (caught) { error = caught instanceof Error ? caught.message : 'Failed to fetch menus'; } finally { loading = false; } }
  $effect(() => { locale; void load(); });
  function changeCreate(open: boolean) { createOpen = open; if (!createPending) createError = ''; }
  async function create(event: SubmitEvent) {
    event.preventDefault(); if (createPending) return;
    const data = new FormData(event.currentTarget as HTMLFormElement); createPending = true; createError = '';
    try { const menu = await client.createMenu({ name: String(data.get('name') ?? ''), label: String(data.get('label') ?? ''), locale });
      createOpen = false; void load(); navigate(`${basePath}/menus/${menu.name}?locale=${encodeURIComponent(menu.locale)}`);
    } catch (caught) { createError = caught instanceof Error ? caught.message : 'Failed to create menu'; }
    finally { createPending = false; }
  }
  async function remove() { if (!deleteName || deletePending) return; deletePending = true; deleteError = '';
    try { await client.deleteMenu(deleteName, { locale }); deleteName = null; await load(); }
    catch (caught) { deleteError = caught instanceof Error ? caught.message : 'Failed to delete menu'; } finally { deletePending = false; }
  }
</script>

<header><div><h1>Menus</h1><p>Manage navigation menus for your site</p></div>
  {#if locales.length > 1}<label for={`${key}-locale`}>Locale</label><select id={`${key}-locale`} bind:value={locale}>{#each locales as option}<option value={option}>{option.toUpperCase()}</option>{/each}</select>{/if}
  <button disabled={!mutationsEnabled} onclick={() => changeCreate(true)}>Create Menu</button>
</header>
{#if loading}<p>Loading menus...</p>{:else if error}<p role="alert">{error}</p>
{:else if menus.length === 0}<section class="empty"><h2>No menus yet</h2><p>Create your first navigation menu to get started</p><button disabled={!mutationsEnabled} onclick={() => changeCreate(true)}>Create Menu</button></section>
{:else}<ul class="menus">{#each menus as menu (menu.id)}<li><article><h2>{menu.label}</h2><p>{menu.name}</p><p>{menu.itemCount ?? 0} {(menu.itemCount ?? 0) === 1 ? 'item' : 'items'}</p>
  {#if locales.length > 1}<p>{menu.locale.toUpperCase()}</p>{/if}
  <a href={`${basePath}/menus/${menu.name}?locale=${encodeURIComponent(menu.locale)}`}>Edit</a>
  <button disabled={!mutationsEnabled} aria-label={`Delete ${menu.name} menu`} onclick={() => { deleteName = menu.name; deleteError = ''; }}>Delete</button>
</article></li>{/each}</ul>{/if}
{#if createOpen}<MenuDialog labelledBy={`${key}-create`} onClose={() => changeCreate(false)}>
  <h2 id={`${key}-create`}>Create menu</h2><button type="button" aria-label="Close" onclick={() => changeCreate(false)}>×</button>
  <form onsubmit={create}><label for={`${key}-label`}>Label</label><input id={`${key}-label`} name="label" required placeholder="Primary navigation" />
    <p>Shown in the admin menu list.</p><label for={`${key}-name`}>Name</label><input id={`${key}-name`} name="name" required pattern="[a-z0-9\-]+" title="Only lowercase letters, numbers, and hyphens" placeholder="primary" />
    <p>Stable identifier for your site, such as primary or footer.</p>{#if createError}<p role="alert">{createError}</p>{/if}
    <footer><button type="button" onclick={() => changeCreate(false)}>Cancel</button><button type="submit" disabled={createPending}>{createPending ? 'Creating...' : 'Create'}</button></footer>
  </form>
</MenuDialog>{/if}
{#if deleteName}<MenuDialog labelledBy={`${key}-delete`} onClose={() => { deleteName = null; deleteError = ''; }}>
  <h2 id={`${key}-delete`}>Delete menu</h2><p>Are you sure you want to delete this menu? This will also delete all menu items. This action cannot be undone.</p>
  {#if deleteError}<p role="alert">{deleteError}</p>{/if}<footer><button onclick={() => { deleteName = null; deleteError = ''; }}>Cancel</button><button disabled={deletePending} onclick={remove}>{deletePending ? 'Deleting...' : 'Delete'}</button></footer>
</MenuDialog>{/if}

<style>
  header,footer { display:flex; gap:1rem; align-items:center; justify-content:space-between; } .menus { list-style:none; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(16rem,1fr)); gap:1rem; }
  article,.empty { border:1px solid #d4d4d8; border-radius:.7rem; padding:1.25rem; } article a { margin-inline-end:1rem; } 
   form { display:grid; gap:.5rem; } input { padding:.6rem; border:1px solid #a1a1aa; border-radius:.35rem; } button { cursor:pointer; padding:.5rem .8rem; } button:disabled { cursor:default; opacity:.55; } [role=alert] { color:#b91c1c; }
</style>
