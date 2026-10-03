<script lang="ts">
  import type {PublicPageContext,PageMetadataContribution,SeoSettings}from './types.ts';
  let {page,contributions=[],siteSeo,defaultOgImage}: {page:PublicPageContext;contributions?:PageMetadataContribution[];siteSeo?:SeoSettings;defaultOgImage?:string|null}=$props();
  // Incomplete native rendering checkpoint for Original SSR assertion reds.
  void page;void contributions;void siteSeo;void defaultOgImage;
</script>

<svelte:head></svelte:head>
