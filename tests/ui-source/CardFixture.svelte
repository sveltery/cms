<script lang="ts">
  import { createAttachmentKey } from 'svelte/attachments';
  import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from '../../src/lib/ui/vendor/sveltery/card/index.ts';
  const parts = [Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter];
  let refs = $state<(HTMLDivElement | null | undefined)[]>(parts.map((_, index) => index % 2 ? null : undefined));
  let shown = $state(true);
  let changed = $state(false);
  let attached = 0;
  let detached = 0;
  const clicks: string[] = [];
  const attachment = { [createAttachmentKey()]: (node: HTMLDivElement) => { attached++; node.dataset.attached = 'true'; return () => { detached++; }; } };
  export function snapshot() { return { refs: [...refs], attached, detached, clicks: [...clicks] }; }
  export function update() { changed = true; }
  export function remove() { shown = false; }
  export function show() { shown = true; }
</script>
{const label = $derived(changed ? 'Updated & <Card>' : 'Initial & <Card>')}
{#if shown}
  {#each parts as Part, index (Part)}
    <Part id={`bound-card-${index}`} bind:ref={refs[index]} {...attachment} class={changed ? 'grid px-6' : 'grid px-3'} title={`${label} ${index}`} onclick={event => clicks.push(event.currentTarget.id)}>{label} {index}</Part>
  {/each}
{/if}
