<script lang="ts">
  // EmDash1.1.0 CalendarEntry row/chip behavior, pin913cb1bb; MIT.
  import { base } from '$app/paths';
  import { formatTimeAgo, formatShortDuration } from './calendar.ts';
  import { isPlainClick, stateLabels } from './entry.ts';
  import type { EntryProps } from './ui-types.ts';
  let { item, display, now, selected, onSelect, chip = false }: EntryProps = $props();
  const href = $derived(`${base}/content/${encodeURIComponent(item.collection)}/${encodeURIComponent(item.id)}?locale=${encodeURIComponent(item.locale)}`);
</script>
<a {href} class:chip class:published={item.state === 'published'} class:overdue={item.state === 'overdue'}
  aria-haspopup={onSelect ? 'dialog' : undefined} aria-current={selected ? 'true' : undefined}
  onclick={event => { if (onSelect && isPlainClick(event)) { event.preventDefault(); onSelect(item, event.currentTarget); } }}>
  <span class="time">{display.formatTime(item.time)}</span><span dir="auto" class="title">{item.title}</span>
  <span class="state">{stateLabels[item.state]}</span>
  {#if item.state === 'overdue'}<span class="note">{chip ? `${formatShortDuration(now-item.time, display.locale)} late` : `Overdue · ${formatTimeAgo(now-item.time, display.locale)}`}</span>
  {:else if item.state === 'update'}<span class="note" aria-hidden="true">Update</span>{/if}
  {#if !chip}<span class="collection">{display.collection(item.collection).label}</span>{/if}
  {#if display.showLocale}<span class="locale">{new Intl.DisplayNames([display.locale], {type:'language'}).of(item.locale)}</span>{/if}
  {#if display.viewerZoneDiffers && !chip}<span class="viewer">{display.formatViewerTime(item.time)}</span>{/if}
</a>
<style>
  a { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; padding:.45rem .5rem; border-radius:.35rem; text-decoration:none; font-size:.875rem; }
  a:hover,a[aria-current="true"] { background:var(--muted,#eee); } a:focus-visible { outline:2px solid var(--ring,#165ccc); }
  .title { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .time { font-variant-numeric:tabular-nums; }
  .state { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
  .note,.collection,.locale,.viewer { font-size:.75rem; } .overdue .note { color:#a74b00; }
  .chip { display:grid; gap:.15rem; border:1px solid var(--border,#ddd); background:var(--card,#fff); font-size:.75rem; }
  .chip.published { display:flex; border:0; padding:.25rem .4rem; } .published { color:var(--muted-foreground,#666); }
</style>
