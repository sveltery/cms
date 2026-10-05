<script lang="ts">
 // Native port of EmDash 1.1.0 FocalPointEditor; MIT notice: notices/emdash-MIT.txt.
 import {onMount} from 'svelte';
 import {fallbackToOriginalThumbnail,type MediaFocalPoint} from './source/media-utils';
 import {containedMediaSize,observeMediaFrame,type MediaSize} from './contained-media-size';
 let {src,fallbackSrc,sourceSize,alt,editing,disabled,point,descriptionId,onChange,onReadyChange,editorFrameRef}:{
  src:string;fallbackSrc?:string;sourceSize?:MediaSize;alt:string;editing:boolean;disabled:boolean;point:MediaFocalPoint|null;descriptionId:string;
  onChange:(point:MediaFocalPoint)=>void;onReadyChange?:(ready:boolean)=>void;editorFrameRef?:{current:HTMLDivElement|null};
 }=$props();
 let frame=$state<HTMLDivElement>(),frameSize=$state<MediaSize|null>(null),loaded=$state<(MediaSize&{src:string})|null>(null),announcement=$state('');
 let activePointer:number|null=null;
 const ready=$derived(loaded?.src===src),current=$derived(point??{focalX:.5,focalY:.5});
 const display=$derived(containedMediaSize(frameSize,(ready?loaded:null)??sourceSize??null));
 const moves:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 const clamp=(value:number)=>Math.min(1,Math.max(0,Math.round(value*10000)/10000));
 const announce=(value:MediaFocalPoint)=>announcement=`Horizontal ${Math.round(value.focalX*100)}%, vertical ${Math.round(value.focalY*100)}%`;
 onMount(()=>frame?observeMediaFrame(frame,size=>frameSize=size):undefined);
 $effect(()=>{if(editorFrameRef)editorFrameRef.current=frame??null;return()=>{if(editorFrameRef)editorFrameRef.current=null;};});
 function release(event:PointerEvent){if(activePointer!==event.pointerId)return;activePointer=null;const target=event.currentTarget as HTMLButtonElement;if(event.type!=='lostpointercapture'&&target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);}
 function pointer(event:PointerEvent){
  const target=event.currentTarget as HTMLButtonElement;
  if(event.type==='pointerdown'){if(activePointer!==null)return;activePointer=event.pointerId;target.setPointerCapture(event.pointerId);}
  else if(activePointer!==event.pointerId)return;
  if(event.type==='pointercancel'||event.type==='lostpointercapture'){release(event);return;}
  const bounds=target.getBoundingClientRect();
  if(bounds.width&&bounds.height){const next={focalX:clamp((event.clientX-bounds.left)/bounds.width),focalY:clamp((event.clientY-bounds.top)/bounds.height)};onChange(next);if(event.type==='pointerup')announce(next);}
  if(event.type==='pointerup')release(event);
 }
 function keydown(event:KeyboardEvent){const move=moves[event.key];if(!move)return;event.preventDefault();const step=event.shiftKey?.05:.01;const next={focalX:clamp(current.focalX+move[0]*step),focalY:clamp(current.focalY+move[1]*step)};onChange(next);announce(next);}
</script>
<div class="focal-editor">
 <div bind:this={frame} aria-busy={!ready} class="focal-frame">
  <div class="focal-image" style:width={display?`${display.width}px`:undefined} style:height={display?`${display.height}px`:undefined}>
   {#key src}<img {src} {alt} draggable={false} onload={event=>{const image=event.currentTarget;loaded={src,width:image.naturalWidth,height:image.naturalHeight};onReadyChange?.(true);}} onerror={event=>{const image=event.currentTarget;if(fallbackSrc&&!image.dataset.thumbFallback){fallbackToOriginalThumbnail(image,fallbackSrc);return;}loaded=null;onReadyChange?.(false);}} />{/key}
   {#if editing&&ready}<button type="button" aria-label="Focal point. Use arrow keys to move it." aria-describedby={descriptionId} {disabled} onpointerdown={pointer} onpointermove={pointer} onpointerup={pointer} onpointercancel={pointer} onlostpointercapture={pointer} onkeydown={keydown}><span aria-hidden="true" style:left={`${current.focalX*100}%`} style:top={`${current.focalY*100}%`}></span></button>{/if}
  </div>
 </div>
 <p role="status" aria-live="polite" class="sr-only">{announcement}</p>
</div>
<style>
 .focal-editor{display:grid;gap:1rem}.focal-frame{height:256px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:.75rem;background:#eef0f4;box-shadow:0 0 0 1px #dfe3e9}.focal-image{position:relative;display:inline-flex;max-height:100%;max-width:100%}img{display:block;width:100%;height:100%;object-fit:contain;max-height:256px;max-width:100%}button{position:absolute;inset:0;cursor:crosshair;touch-action:none;background:transparent;border:0;border-radius:.3rem}button:focus-visible{outline:2px solid #4465ce;outline-offset:2px}button>span{position:absolute;width:1.25rem;height:1.25rem;transform:translate(-50%,-50%);background:#4465ce;border-radius:50%;box-shadow:0 0 0 2px white}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}@media(min-width:48rem){.focal-frame{height:320px}img{max-height:320px}}
</style>
