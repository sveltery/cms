<script lang="ts">
  import type {PublicPageContext,PageMetadataContribution,SeoSettings}from './types.ts';
  import {generateBaseSeoContributions,generateSiteSeoContributions}from './contributions.ts';
  import {resolvePageMetadata,renderPageMetadata}from './metadata.ts';
  let {page,contributions=[],siteSeo,defaultOgImage}: {page:PublicPageContext;contributions?:PageMetadataContribution[];siteSeo?:SeoSettings;defaultOgImage?:string|null}=$props();
  const metadata=$derived(resolvePageMetadata([
    ...contributions,
    ...generateSiteSeoContributions(siteSeo),
    ...generateBaseSeoContributions(page,defaultOgImage)
  ]));
  // The pinned renderer escapes all attributes and safely serializes JSON-LD.
  const html=$derived(renderPageMetadata(metadata));
</script>

<svelte:head>
  {#if page.title}<title>{page.title}</title>{/if}
  {@html html}
</svelte:head>
