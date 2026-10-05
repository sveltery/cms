<script lang="ts">
  import { useCalendarMessages } from './message-context.svelte.ts';
  const t = useCalendarMessages();
  // Source CalendarToolbar semantics with native controls and CSS.
  // EmDash1.1.0 pin913cb1bb; MIT notices/emdash-MIT.txt.
  import type { CalendarDisplay } from './calendar.ts';
  let {title,display,zoneTime,loading,onPrevious,onNext,onToday,onPreviewPrevious,onPreviewNext}:{
    title:string;display:CalendarDisplay;zoneTime:number;loading:boolean;
    onPrevious:()=>void;onNext:()=>void;onToday:()=>void;onPreviewPrevious?:()=>void;onPreviewNext?:()=>void;
  }=$props();
  const siteZone=$derived(display.zoneShortName(zoneTime)),viewerZone=$derived(display.viewerZoneShortName(zoneTime));
  const showViewerZone=$derived(display.viewerZoneDiffers&&viewerZone!==siteZone);
  const zoneDescription=$derived(showViewerZone?t("Times are in {zoneName}. Your browser uses {viewerZoneName}.",{zoneName:display.zoneName,viewerZoneName:display.viewerZoneName}):t("Times are in {zoneName}.",{zoneName:display.zoneName}));
</script>
<div class="toolbar"><div><h2>{title}</h2><p title={zoneDescription}><span aria-hidden="true">{showViewerZone?t("{siteZone} · Your time: {viewerZone}",{siteZone,viewerZone}):siteZone}</span><span class="sr-only">{zoneDescription}</span></p></div><div class="month-nav">{#if loading}<span class="loader" role="img" aria-label={t("Loading")}>◌</span>{/if}<button type="button" aria-label={t("Previous month")} onclick={onPrevious} onpointerenter={onPreviewPrevious} onfocus={onPreviewPrevious}>‹</button><button type="button" onclick={onToday}>{t("Today")}</button><button type="button" aria-label={t("Next month")} onclick={onNext} onpointerenter={onPreviewNext} onfocus={onPreviewNext}>›</button></div></div>
<style>.toolbar{display:flex;justify-content:space-between;gap:1rem;align-items:start;}h2{margin:0;font-size:1.25rem;}p{font-size:.875rem;color:var(--muted-foreground,#666);}.month-nav{display:flex;gap:.35rem;align-items:center;}button{font:inherit;color:inherit;background:var(--card,#fff);border:1px solid var(--border,#ccc);border-radius:.35rem;padding:.55rem .8rem;cursor:pointer;}button:focus-visible{outline:2px solid var(--ring,#165ccc);outline-offset:2px;}.loader{font-size:1.25rem;}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}</style>
