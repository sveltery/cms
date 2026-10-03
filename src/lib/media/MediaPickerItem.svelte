<script lang="ts">
 import {base} from '$app/paths';
 import type {MediaItem} from './picker-client';
 import {getMediaObjectPosition,getMediaPreviewUrl,formatFileSize,getFileIcon} from './source/picker-media-utils';

 let {item,layout,selected,onselect,ondimensions}: {
  item:MediaItem;
  layout:'grid'|'list';
  selected:boolean;
  onselect:(event:MouseEvent)=>void;
  ondimensions:(image:HTMLImageElement)=>void;
 }=$props();

 const preview=$derived.by(()=>{
  const url=getMediaPreviewUrl(item.url,item.contentHash);
  return url.startsWith('/')&&!url.startsWith(`${base}/`)?`${base}${url}`:url;
 });
</script>

<button
 type="button"
 class="card"
 class:list={layout==='list'}
 aria-label={item.filename}
 aria-pressed={selected}
 data-media-layout={layout}
 onclick={onselect}
>
 {#if item.url&&(item.mimeType.startsWith('image/')||item.provider)}
  <img
   src={preview}
   alt=""
   style:object-position={getMediaObjectPosition(item)}
   onload={event=>ondimensions(event.currentTarget as HTMLImageElement)}
  />
 {:else}
  <span class="file-icon" aria-hidden="true">{getFileIcon(item.mimeType)}</span>
 {/if}
 <span class="filename">{item.filename}</span>
 {#if layout==='list'}
  <span class="metadata">{item.mimeType} · {formatFileSize(item.size)}</span>
 {/if}
</button>

<style>
 .card{font:inherit;color:inherit;border:1px solid #cbd1dc;border-radius:.5rem;background:transparent;padding:.6rem .8rem;cursor:pointer;min-width:0;text-align:left;overflow:hidden;display:flex;flex-direction:column;gap:.5rem}
 .card[aria-pressed=true]{border-color:#386de0;background:#edf3ff}
 .card:focus-visible{outline:2px solid #386de0;outline-offset:2px}
 .card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:.25rem}
 .filename{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
 .list{display:grid;grid-template-columns:3.5rem minmax(0,1fr) auto;align-items:center}
 .list img{width:3.5rem;height:3rem}
 .metadata{color:#626b7b;font-size:.9rem}
 .file-icon{min-height:5rem;display:grid;place-items:center;font-size:2.5rem}
 @media(max-width:600px){.list{grid-template-columns:3rem minmax(0,1fr)}.metadata{grid-column:2}}
</style>
