<script lang="ts">
  import type { PublicEntry } from '$lib/server/public-site/read.ts';
  import type { Field } from '$lib/server/database/contract.ts';
  import PortableText from './PortableText.svelte';
  let { entry, fields }: { entry: PublicEntry; fields: Pick<Field, 'slug' | 'label' | 'type'>[] } = $props();
</script>
<article>
  <h1>{entry.title}</h1>
  {#if typeof entry.data.excerpt === 'string'}<p class="excerpt">{entry.data.excerpt}</p>{/if}
  {#if entry.publishedAt}<time datetime={entry.publishedAt}>{new Date(entry.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>{/if}
  {#each fields as field (field.slug)}
    {#if field.type === 'portableText' && entry.data[field.slug] !== null}
      <PortableText value={entry.data[field.slug]} />
    {:else if !['title', 'excerpt'].includes(field.slug) && ['string', 'text', 'integer', 'number', 'boolean'].includes(field.type) && entry.data[field.slug] !== null}
      <section><h2>{field.label}</h2><p>{String(entry.data[field.slug])}</p></section>
    {/if}
  {/each}
</article>
<style>
  h1 { font-size: clamp(2.2rem, 5vw, 3.5rem); line-height: 1.1; letter-spacing: -.035em; }
  .excerpt { font-size: 1.2rem; line-height: 1.6; color: #506079; }
  time { display: block; color: #526079; margin: 1.5rem 0 2.5rem; }
  section p { white-space: pre-wrap; }
</style>
