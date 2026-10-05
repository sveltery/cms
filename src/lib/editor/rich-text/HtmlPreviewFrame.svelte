<script lang="ts">
  import { onMount } from 'svelte';
  import type { Translate } from './types';
  import { HTML_BLOCK_FRAME_MAX_HEIGHT, HTML_BLOCK_FRAME_MESSAGE } from '../portable-text/html-block';
  import { htmlMessage } from './html-messages.source';
  let { srcdoc, lastHeight, translate }: { srcdoc: string; lastHeight: { current: number }; translate: Translate } = $props();
  let container: HTMLDivElement;
  let frame = $state<HTMLIFrameElement>();
  const initialHeight = () => lastHeight.current;
  let visible = $state(false), blocked = $state(false), dragging = $state(false), height = $state(initialHeight());
  onMount(() => {
    // Root-qualified unsupported Native environment: no visibility claim or
    // iframe creation when this browser API is absent; real browsers stay exact.
    if (typeof IntersectionObserver === 'undefined') return;
    const onMessage = (event: MessageEvent) => {
      if (!visible || event.source !== frame?.contentWindow) return;
      const data: unknown = event.data;
      if (typeof data !== 'object' || data === null || !('type' in data) || data.type !== HTML_BLOCK_FRAME_MESSAGE) return;
      if ('blocked' in data && data.blocked === true) blocked = true;
      if ('height' in data && typeof data.height === 'number' && Number.isFinite(data.height)) {
        const next = Math.min(Math.max(data.height, 0), HTML_BLOCK_FRAME_MAX_HEIGHT);
        lastHeight.current = next; height = next;
      }
    };
    // Register before actual visibility creates the first iframe/document.
    window.addEventListener('message', onMessage);
    const start = () => { dragging = true; }, end = () => { dragging = false; };
    document.addEventListener('dragstart', start); document.addEventListener('dragend', end); document.addEventListener('drop', end);
    const observer = new IntersectionObserver(([entry]) => { if (!entry?.isIntersecting) return; visible = true; observer.disconnect(); }, { rootMargin: '200px' });
    observer.observe(container);
    return () => { observer.disconnect(); window.removeEventListener('message', onMessage); document.removeEventListener('dragstart', start); document.removeEventListener('dragend', end); document.removeEventListener('drop', end); };
  });
</script>
<div bind:this={container} style:height={`${height}px`}>
  {#if visible}<iframe bind:this={frame} {srcdoc} sandbox="allow-scripts" title={htmlMessage(translate, 'HTML block preview')} class:pointer-events-none={dragging}></iframe>{/if}
</div>
{#if blocked}<p class="notice">{htmlMessage(translate, "The admin's security policy blocked some resources this block loads, such as external scripts, fonts or frames. Your site may still load them.")}</p>{/if}
<style>
  iframe { display: block; width: 100%; height: 100%; border: 0; }
  .pointer-events-none { pointer-events: none; }
  .notice { font-size: .75rem; color: #667080; }
</style>
