<script lang="ts">
 // Native port of EmDash 1.1.0 FocalPointPreviews; MIT notice: notices/emdash-MIT.txt.
 import {fallbackToOriginalThumbnail,getMediaObjectPosition,type MediaFocalPoint} from './source/media-utils';
 let {src,fallbackSrc,point,firstPreviewRef}: {src:string;fallbackSrc?:string;point:MediaFocalPoint|null;firstPreviewRef?:{current:HTMLDivElement|null}}=$props();
 const position=$derived(getMediaObjectPosition(point??{focalX:.5,focalY:.5})!);
 let first=$state<HTMLDivElement>();
 function previewFrame(node:HTMLDivElement,id:string){if(id==='portrait')first=node;return{destroy(){if(first===node)first=undefined;}};}
 $effect(()=>{if(firstPreviewRef)firstPreviewRef.current=first??null;return()=>{if(firstPreviewRef)firstPreviewRef.current=null;};});
 const previews=[['portrait','Portrait','4 / 5'],['square','Square','1'],['landscape','Landscape','16 / 9']] as const;
</script>
<div class="focal-previews" data-testid="focal-preview-group">
 {#each previews as [id,label,ratio]}
  <figure><div use:previewFrame={id} class="preview-frame" style:aspect-ratio={ratio}>
   {#key src}<img {src} alt="" data-testid={`focal-preview-${id}`} style:object-position={position} onerror={event=>{if(fallbackSrc)fallbackToOriginalThumbnail(event.currentTarget,fallbackSrc);}} />{/key}
  </div><figcaption>{label}</figcaption></figure>
 {/each}
</div>
<style>
 .focal-previews{display:grid;width:100%;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:.5rem}
 figure{display:grid;width:100%;min-width:0;gap:.25rem;margin:0}.preview-frame{overflow:hidden;border-radius:.5rem;background:#eef0f4;box-shadow:0 0 0 1px #dfe3e9}img{width:100%;height:100%;object-fit:cover;display:block}figcaption{text-align:center;font-size:.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
