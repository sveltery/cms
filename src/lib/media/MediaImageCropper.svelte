<script module lang="ts">
 export interface MediaCropSelection {unit:'%';x:number;y:number;width:number;height:number}
 export interface MediaImageCropperProps {
  src:string;sourceSize?:{width:number;height:number};crop?:MediaCropSelection;aspect?:number;disabled?:boolean;
  onCropChange:(crop:MediaCropSelection)=>void;onCropComplete:(crop:{x:number;y:number;width:number;height:number})=>void;
  onSourceReady:(size:{width:number;height:number})=>void;onSourceError:()=>void;onImageReady?:(image:HTMLImageElement|null)=>void;
 }
</script>
<script lang="ts">
 import {onMount} from 'svelte';
 import './source/media-cropper.css';
 let {src,sourceSize,crop,aspect,disabled=false,onCropChange,onCropComplete,onSourceReady,onSourceError,onImageReady}:MediaImageCropperProps=$props();
 let frame:HTMLDivElement,image:HTMLImageElement;
 let loaded=$state<{width:number;height:number}|null>(null),frameSize=$state<{width:number;height:number}|null>(null);
 const display=$derived.by(()=>{const size=loaded??sourceSize;if(!size||!frameSize)return null;const scale=Math.min(frameSize.width/size.width,frameSize.height/size.height);return {width:size.width*scale,height:size.height*scale};});
 onMount(()=>{const measure=()=>{if(frame.clientWidth>0&&frame.clientHeight>0)frameSize={width:frame.clientWidth,height:frame.clientHeight};};measure();const observer=new ResizeObserver(measure);observer.observe(frame);return()=>{observer.disconnect();onImageReady?.(null);};});
 $effect(()=>{if(!loaded||!display||crop)return;let width=100,height=100;
  if(aspect){const sourceAspect=loaded.width/loaded.height;if(aspect>sourceAspect)height=sourceAspect/aspect*100;else width=aspect/sourceAspect*100;}
  const next:MediaCropSelection={unit:'%',x:(100-width)/2,y:(100-height)/2,width,height};onCropChange(next);
  onCropComplete({x:Math.round(next.x*loaded.width/100),y:Math.round(next.y*loaded.height/100),width:Math.max(1,Math.round(width*loaded.width/100)),height:Math.max(1,Math.round(height*loaded.height/100))});
 });
 function ready(){if(image.naturalWidth<=0||image.naturalHeight<=0)return;loaded={width:image.naturalWidth,height:image.naturalHeight};onImageReady?.(image);onSourceReady(loaded);}
</script>
<div bind:this={frame} class="media-image-cropper-frame" data-testid="media-image-cropper-frame" inert={disabled||undefined}>
 <div class="emdash-react-image-crop" style:width={display?`${display.width}px`:undefined} style:height={display?`${display.height}px`:undefined}>
  <img bind:this={image} {src} alt="" draggable={false} onload={ready} onerror={()=>{loaded=null;onImageReady?.(null);onSourceError();}} />
  {#if crop&&loaded}<div class="ReactCrop__crop-selection" role="group" aria-label="Crop selection. Use the Arrow keys to move it." style:left={`${crop.x}%`} style:top={`${crop.y}%`} style:width={`${crop.width}%`} style:height={`${crop.height}%`}><div class="ReactCrop__rule-of-thirds-vt"></div><div class="ReactCrop__rule-of-thirds-hz"></div></div>{/if}
 </div>
</div>
