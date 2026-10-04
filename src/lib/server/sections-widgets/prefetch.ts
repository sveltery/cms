// Widget portion of pinned EmDash astro/prefetch.ts; MIT, Copyright 2026 Cloudflare Inc.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; notices/emdash-MIT.txt.
import { requestCached, setRequestCacheEntry } from './request-cache.ts';
import { getWidgetAreas } from './widgets/index.ts';
/** Other chrome services remain separate dependencies; this is only widget-area prefetch. */
export async function prefetchWidgetAreas(): Promise<void> {
  const areas = await requestCached('widget-areas', getWidgetAreas);
  for (const area of areas) setRequestCacheEntry(`widget-area:${area.name}`, area);
}
export async function prefetchLayoutData(): Promise<void> {
  await Promise.allSettled([prefetchWidgetAreas()]);
}
