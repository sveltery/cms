<script lang="ts">
  import * as defaultClient from './client';
  import RelationImpact from './RelationImpact.svelte';
  import { moveCollection } from './order';
  import { modal } from './modal';
  let { collections = [], orphanedTables = [], isLoading = false, onDelete, onRegisterOrphan, onReorder, client = defaultClient, basePath = '/schema', disabled = false, deletionAvailable = true }: any = $props();
  let target = $state<any>(null), relations = $state<any[]>([]), order = $state<string[] | null>(null), dragging = $state('');
  let deleting = $state(false), deleteError = $state(''), loadError = $state('');
  let moving = $state(false), reorderError = $state('');
  const ordered = $derived(order ? order.map(slug => collections.find((value: any) => value.slug === slug)).filter(Boolean) : collections);
  const canReorder = $derived(Boolean(onReorder) && collections.length > 1);
  $effect(() => { const current = collections; order = null; });
  $effect(() => { let active = true; void client.fetchRelations().then((value: any[]) => { if (active) relations = value; }).catch((cause: Error) => { if(active) loadError=cause.message; }); return () => { active = false; }; });
  async function move(active: string, over: string) {
    if (moving || disabled) return;
    const previous = order, slugs = order ?? collections.map((value: any) => value.slug);
    const next = moveCollection(slugs,active,over); if (next === slugs) return;
    order = next; moving = true; reorderError = '';
    try { await onReorder?.(next); }
    catch (cause) { order = previous; reorderError = cause instanceof Error ? cause.message : 'Collection order could not be saved'; }
    finally { moving = false; }
  }
  async function confirmDelete() {
    if (!target || deleting || disabled || !deletionAvailable) return;
    deleting=true;deleteError='';
    try { await onDelete?.(target.slug);target=null; }
    catch(cause) { deleteError=cause instanceof Error?cause.message:'Content type could not be deleted'; }
    finally { deleting=false; }
  }
</script>
<div inert={Boolean(target)} aria-hidden={target ? true : undefined}>
<header><div><h1>Content Types</h1><p>Define the structure of your content</p></div><a href={`${basePath}/relations`}>Relations</a><a href={`${basePath}/new`}>New Content Type</a></header>
{#if !deletionAvailable}<p role="status">Deletion is unavailable until relationships and content references can be cleaned up</p>{/if}
{#if orphanedTables.length}<aside><h2>Unregistered Content Tables Found</h2><p>The following tables contain content but aren't registered as collections. Register them to manage this content in the admin.</p>
  {#each orphanedTables as orphan}<div><code>{orphan.slug}</code><span>({orphan.rowCount} {orphan.rowCount === 1 ? 'item' : 'items'})</span><button type="button" onclick={() => onRegisterOrphan?.(orphan.slug)}>Register</button></div>{/each}
</aside>{/if}
<table><thead><tr>{#if canReorder}<th>Reorder</th>{/if}<th>Name</th><th>Slug</th><th>Source</th><th>Features</th><th>Actions</th></tr></thead><tbody>
{#if isLoading}<tr><td colspan={canReorder ? 6 : 5}>Loading collections...</td></tr>
{:else if !collections.length && !orphanedTables.length}<tr><td colspan={canReorder ? 6 : 5}>No content types yet. <a href={`${basePath}/new`}>Create your first content type</a></td></tr>
{:else}{#each ordered as collection (collection.id)}
<tr ondragover={event => event.preventDefault()} ondrop={event => { event.preventDefault(); move(dragging,collection.slug); dragging = ''; }}>
  {#if canReorder}<td><button disabled={moving || disabled} draggable="true" type="button" aria-label={`Reorder ${collection.label}`} ondragstart={() => dragging = collection.slug}
    onkeydown={event => { const index = ordered.findIndex((value: any) => value.slug === collection.slug); if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); move(collection.slug,ordered[index - 1].slug); } if (event.key === 'ArrowDown' && index < ordered.length - 1) { event.preventDefault(); move(collection.slug,ordered[index + 1].slug); } }}>↕</button></td>{/if}
  <td><div class="name"><div class="shrink-0" aria-hidden="true">▣</div><div class="min-w-0"><a href={`${basePath}/${collection.slug}`}>{collection.label}</a>{#if collection.description}<p>{collection.description}</p>{/if}</div></div></td>
  <td><code>{collection.slug}</code></td><td>{collection.source === 'code' ? 'Code' : collection.source === 'dashboard' || collection.source === 'manual' ? 'Dashboard' : collection.source}</td>
  <td>{#each [...collection.supports.filter((value: string) => value !== 'seo'),...(collection.hasSeo ? ['seo'] : [])] as feature}<span>{feature}</span>{/each}</td>
  <td><a href={`${basePath}/${collection.slug}`} aria-label={`Edit ${collection.label}`}>Edit</a>{#if collection.source !== 'code'}<button type="button" disabled={disabled || !deletionAvailable} aria-label={`Delete ${collection.label}`} onclick={() => { deleteError='';target=collection; }}>Delete</button>{/if}</td>
</tr>{/each}{/if}
</tbody></table>
{#if loadError}<p role="alert">Relationship impact is unavailable: {loadError}</p>{/if}
{#if reorderError}<p role="alert">{reorderError}</p>{/if}
</div>
{#if target}<dialog open use:modal={() => { if(!deleting)target=null; }} aria-label="Delete Content Type?"><h2>Delete Content Type?</h2><p>Are you sure you want to delete "{target.label}"? This will also delete all content in this collection.</p>
  {#if relations.some(value => value.parentCollection === target.slug || value.childCollection === target.slug)}<p>Every relationship this content type takes part in goes too:</p><RelationImpact relations={relations.filter(value => value.parentCollection === target.slug || value.childCollection === target.slug)} />{/if}
  {#if deleteError}<p role="alert">{deleteError}</p>{/if}
  <button type="button" disabled={deleting} onclick={() => target = null}>Cancel</button><button type="button" disabled={deleting || disabled} onclick={confirmDelete}>{deleting?'Deleting...':'Delete'}</button>
</dialog>{/if}
<style>header { display:flex;gap:20px;align-items:center; } table {inline-size:100%;border-collapse:collapse; } th,td {padding:12px;text-align:start;border-bottom:1px solid #ddd; } .name { display:flex;gap:12px;align-items:center; } .shrink-0 { flex-shrink:0;inline-size:32px;block-size:32px; } .min-w-0 { min-inline-size:0; } td span { margin-inline-end:8px; } dialog { border:1px solid #aaa;border-radius:12px;padding:24px; }</style>
