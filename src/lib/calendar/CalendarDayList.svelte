<script lang="ts">
  import { useCalendarMessages } from './message-context.svelte.ts';
  const t = useCalendarMessages();
  // EmDash1.1.0 CalendarDayList ordering/now boundary, pin913cb1bb; MIT.
  import Entry from './CalendarEntry.svelte';
  import type { DayListProps } from './ui-types.ts';
  let { items, display, now, label, nowAt, selectedKey, onSelect }: DayListProps = $props();
</script>
{#snippet line()}<li class="now">{t("Now · {time}",{time:display.formatTime(now)})}</li>{/snippet}
<ul aria-label={label}>
  {#each items as item, index (item.key)}
    {#if index === nowAt}{@render line()}{/if}
    <li><Entry {item} {display} {now} {onSelect} selected={selectedKey === item.key} /></li>
  {/each}
  {#if nowAt !== undefined && nowAt >= items.length}{@render line()}{/if}
</ul>
<style>ul {list-style:none;margin:0;padding:0;display:grid;gap:2px;} .now { color:#b32929; border-bottom:2px solid #b32929; padding:.4rem .5rem; font-size:.75rem; font-weight:650; }</style>
