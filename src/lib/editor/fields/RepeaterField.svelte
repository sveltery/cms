<script lang="ts">
  // Data/state behavior ports EmDash RepeaterField at913cb1bb, MIT.
  // Native controls and drag/keyboard transport are a recorded RFE02 proposal.
  import { untrack } from 'svelte';
  import FieldHost from './FieldHost.svelte';
  import { ensureKeys, stripKeys, type RepeaterSubFieldDef, type RepeaterItem } from './repeater-values';
  let { id, label, value, onChange, subFields, minItems = 0, maxItems, timezone = 'UTC', readOnly = false }: {
    id: string; label: string; value: unknown; onChange: (value: unknown[]) => void;
    subFields: RepeaterSubFieldDef[]; minItems?: number; maxItems?: number;
    timezone?: string; readOnly?: boolean;
  } = $props();
  let items = $state<RepeaterItem[]>(untrack(() => ensureKeys(Array.isArray(value) ? value : [])));
  let collapsed = $state(new Set<string>()), dragged = $state<string | undefined>();
  $effect(() => {
    const incoming = Array.isArray(value) ? value : [];
    untrack(() => {
      items = incoming.map((item, index) => {
        const object = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
        const existingKey = (object._key as string) || items[index]?._key;
        return { ...object, _key: existingKey || `item-${index}-${Date.now()}` };
      });
    });
  });
  function emit(updated: RepeaterItem[]) {
    if (readOnly) return;
    items = updated; onChange(stripKeys(updated));
  }
  function add() {
    if (readOnly || (maxItems && items.length >= maxItems)) return;
    const item: RepeaterItem = { _key: `item-${Date.now()}` };
    for (const field of subFields) item[field.slug] = field.type === 'boolean' ? false :
      field.type === 'number' || field.type === 'integer' || field.type === 'image' ? null : '';
    emit([...items, item]);
  }
  function remove(key: string) {
    if (items.length <= minItems) return;
    emit(items.filter(item => item._key !== key));
  }
  function change(key: string, slug: string, next: unknown) {
    emit(items.map(item => item._key === key ? { ...item, [slug]: next } : item));
  }
  function move(fromKey: string, toKey: string) {
    if (readOnly || fromKey === toKey) return;
    const from = items.findIndex(item => item._key === fromKey), to = items.findIndex(item => item._key === toKey);
    if (from < 0 || to < 0) return;
    const updated = [...items], [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved); emit(updated);
  }
  function toggle(key: string) {
    const next = new Set(collapsed); next.has(key) ? next.delete(key) : next.add(key); collapsed = next;
  }
  function summary(item: RepeaterItem, index: number) {
    const field = subFields.find(field => field.type === 'string' || field.type === 'text');
    return (field ? String(item[field.slug] || '') : '') || `Item ${index + 1}`;
  }
  const canAdd = $derived(!maxItems || items.length < maxItems);
  const canRemove = $derived(items.length > minItems);
</script>

<div class="repeater" id={id}>
  <div class="heading"><span class="label">{label}{items.length ? ` (${items.length} ${items.length === 1 ? 'item' : 'items'})` : ''}</span>
    {#if canAdd}<button type="button" disabled={readOnly} onclick={add}>Add Item</button>{/if}
  </div>
  {#if items.length === 0}
    <div class="empty"><p>No items yet</p>
      {#if canAdd}<button type="button" disabled={readOnly} onclick={add}>Add First Item</button>{/if}
    </div>
  {:else}
    {#each items as item, index (item._key)}
      <section class="item" aria-label={summary(item, index)}
        ondragover={event => { if (!readOnly && dragged !== undefined) event.preventDefault(); }}
        ondrop={event => { event.preventDefault(); if (dragged !== undefined) move(dragged, item._key); dragged = undefined; }}>
        <div class="row-heading">
          <button type="button" class="drag" draggable={!readOnly} disabled={readOnly} aria-label={`Drag item ${index + 1}`}
            ondragstart={event => { dragged = item._key; event.dataTransfer?.setData('text/plain', item._key); }}
            ondragend={() => { dragged = undefined; }}>↕</button>
          <button type="button" class="summary" aria-expanded={!collapsed.has(item._key)} aria-controls={`${id}-${item._key}`}
            onclick={() => toggle(item._key)}>{collapsed.has(item._key) ? '▸' : '▾'} {summary(item, index)}</button>
          <button type="button" disabled={readOnly || index === 0} aria-label={`Move item ${index + 1} up`}
            onclick={() => { const target = items[index - 1]; if (target) move(item._key, target._key); }}>↑</button>
          <button type="button" disabled={readOnly || index === items.length - 1} aria-label={`Move item ${index + 1} down`}
            onclick={() => { const target = items[index + 1]; if (target) move(item._key, target._key); }}>↓</button>
          {#if canRemove}<button type="button" disabled={readOnly} aria-label={`Remove item ${index + 1}`} onclick={() => remove(item._key)}>Remove</button>{/if}
        </div>
        {#if !collapsed.has(item._key)}
          <div id={`${id}-${item._key}`} class="subfields">
            {#each subFields as field (field.slug)}
              <FieldHost name={`${id}.${index}.${field.slug}`} field={{ ...field, kind: field.type === 'integer' ? 'number' : field.type === 'text' ? 'richText' : field.type }}
                value={item[field.slug]} onChange={next => change(item._key, field.slug, next)} {readOnly} {timezone} context="repeater" />
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .heading, .row-heading { display: flex; align-items: center; gap: .5rem; }
  .heading { justify-content: space-between; margin-block-end: .5rem; }
  .label { font-weight: 500; }
  .empty { padding: 1.5rem; border: 2px dashed #c4cedd; border-radius: .5rem; text-align: center; }
  .item { margin-block-end: .5rem; border: 1px solid #c4cedd; border-radius: .5rem; }
  .row-heading { padding: .5rem; border-block-end: 1px solid #d9e0eb; }
  .summary { flex: 1; text-align: start; }
  .subfields { padding: 1rem; }
  button { padding: .4rem .6rem; border: 1px solid #c4cedd; border-radius: .375rem; font: inherit; background: white; }
  .drag { cursor: grab; }
</style>
