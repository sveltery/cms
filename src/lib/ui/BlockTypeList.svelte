<script lang="ts">
  // Native rendering of pinned admin/components/BlockTypeList.tsx, MIT Cloudflare.
  import type {BlockType} from '$lib/server/schema/block-types';
  let {blockTypes,isLoading=false}:{blockTypes:readonly BlockType[];isLoading?:boolean}=$props();
</script>
<section>
  <h2>Block types</h2>
  <p>Database-owned definitions available to blocks fields.</p>
  {#if isLoading}<p>Loading block types…</p>
  {:else if blockTypes.length===0}<p>No block types defined</p>
  {:else}{#each blockTypes as blockType(blockType.slug)}
    <article>
      <strong>{blockType.label}</strong> <code>{blockType.slug}</code> <span>Active v{blockType.currentVersion}</span>
      {#if blockType.description}<p>{blockType.description}</p>{/if}
      {#each blockType.versions as version(version.version)}
        <p>Version {version.version}{version.active?' (active)':''} · <code>{version.fingerprint}</code></p>
      {/each}
    </article>
  {/each}{/if}
</section>
<style>section{border:1px solid #d9e0eb;border-radius:12px;padding:20px}article{border-block-start:1px solid #d9e0eb;padding-block:16px}code{overflow-wrap:anywhere}span{background:#eef2f8;padding:3px 8px;border-radius:6px}</style>
