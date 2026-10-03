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
 let loaded=$state<{width:number;height:number}|null>(null),frameSize=$state<{width:number;height:number}|null>(null),announcement=$state('');
 type Rectangle={x:number;y:number;width:number;height:number};
 type Handle='nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
 type Gesture={id:number;handle:Handle|null;startX:number;startY:number;rect:Rectangle};
 let gesture=$state<Gesture|null>(null);
 const handles:ReadonlyArray<{direction:Handle;name:string}>=[{direction:'nw',name:'top-left corner'},{direction:'n',name:'top edge'},{direction:'ne',name:'top-right corner'},{direction:'e',name:'right edge'},{direction:'se',name:'bottom-right corner'},{direction:'s',name:'bottom edge'},{direction:'sw',name:'bottom-left corner'},{direction:'w',name:'left edge'}];
 const display=$derived.by(()=>{const size=loaded??sourceSize;if(!size||!frameSize)return null;const scale=Math.min(frameSize.width/size.width,frameSize.height/size.height);return {width:size.width*scale,height:size.height*scale};});
 onMount(()=>{const measure=()=>{if(frame.clientWidth>0&&frame.clientHeight>0)frameSize={width:frame.clientWidth,height:frame.clientHeight};};measure();const observer=new ResizeObserver(measure);observer.observe(frame);return()=>{observer.disconnect();onImageReady?.(null);};});
 $effect(()=>{if(!loaded||!display||crop)return;let width=100,height=100;
  if(aspect){const sourceAspect=loaded.width/loaded.height;if(aspect>sourceAspect)height=sourceAspect/aspect*100;else width=aspect/sourceAspect*100;}
  const next:MediaCropSelection={unit:'%',x:(100-width)/2,y:(100-height)/2,width,height};onCropChange(next);
  onCropComplete({x:Math.round(next.x*loaded.width/100),y:Math.round(next.y*loaded.height/100),width:Math.max(1,Math.round(width*loaded.width/100)),height:Math.max(1,Math.round(height*loaded.height/100))});
 });
 function ready(){if(image.naturalWidth<=0||image.naturalHeight<=0)return;loaded={width:image.naturalWidth,height:image.naturalHeight};onImageReady?.(image);onSourceReady(loaded);}
 function rectangle():Rectangle|null{if(!crop||!display||!loaded)return null;return {x:crop.x*display.width/100,y:crop.y*display.height/100,width:crop.width*display.width/100,height:crop.height*display.height/100};}
 const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
 function complete(rect:Rectangle,announce=false){if(!display||!loaded||!image||rect.width<=0||rect.height<=0)return;
  const x=clamp(Math.round(rect.x*loaded.width/display.width),0,loaded.width-1),y=clamp(Math.round(rect.y*loaded.height/display.height),0,loaded.height-1);
  const pixels={x,y,width:Math.max(1,Math.min(loaded.width-x,Math.round(rect.width*loaded.width/display.width))),height:Math.max(1,Math.min(loaded.height-y,Math.round(rect.height*loaded.height/display.height)))};
  onCropChange({unit:'%',x:rect.x/display.width*100,y:rect.y/display.height*100,width:rect.width/display.width*100,height:rect.height/display.height*100});onCropComplete(pixels);
  if(announce)announcement=`Crop area ${pixels.width} by ${pixels.height} pixels.`;
 }
 function resize(rect:Rectangle,handle:Handle,dx:number,dy:number):Rectangle{if(!display)return rect;
  const west=handle.includes('w'),east=handle.includes('e'),north=handle.includes('n'),south=handle.includes('s');
  const span=24*(aspect?2:3),minWidth=Math.min(display.width,aspect&&aspect>1?span*aspect:span),minHeight=Math.min(display.height,aspect&&aspect<=1?span/aspect:span);
  if(aspect){const anchorX=west?rect.x+rect.width:rect.x,anchorY=north?rect.y+rect.height:rect.y;
   const horizontal=west?-dx:dx,vertical=(north?-dy:dy)*aspect,delta=Math.abs(horizontal)>=Math.abs(vertical)?horizontal:vertical;
   const maxWidth=Math.min(west?anchorX:display.width-anchorX,(north?anchorY:display.height-anchorY)*aspect);
   const width=clamp(rect.width+delta,Math.min(maxWidth,Math.max(minWidth,minHeight*aspect)),maxWidth),height=width/aspect;
   return {x:west?anchorX-width:rect.x,y:north?anchorY-height:rect.y,width,height};
  }
  const left=west?clamp(rect.x+dx,0,rect.x+rect.width-Math.min(minWidth,rect.width)):rect.x;
  const right=east?clamp(rect.x+rect.width+dx,rect.x+Math.min(minWidth,rect.width),display.width):rect.x+rect.width;
  const top=north?clamp(rect.y+dy,0,rect.y+rect.height-Math.min(minHeight,rect.height)):rect.y;
  const bottom=south?clamp(rect.y+rect.height+dy,rect.y+Math.min(minHeight,rect.height),display.height):rect.y+rect.height;
  return {x:left,y:top,width:right-left,height:bottom-top};
 }
 function start(event:PointerEvent,handle:Handle|null){if(disabled||event.button!==0||!event.isPrimary)return;const rect=rectangle();if(!rect)return;event.preventDefault();event.stopPropagation();gesture={id:event.pointerId,handle,startX:event.clientX,startY:event.clientY,rect};}
 function dragRectangle(event:PointerEvent):Rectangle|null{if(!gesture||event.pointerId!==gesture.id||!display)return null;const dx=event.clientX-gesture.startX,dy=event.clientY-gesture.startY,rect=gesture.rect;
  return gesture.handle?resize(rect,gesture.handle,dx,dy):{...rect,x:clamp(rect.x+dx,0,display.width-rect.width),y:clamp(rect.y+dy,0,display.height-rect.height)};
 }
 function move(event:PointerEvent){const rect=dragRectangle(event);if(rect){event.preventDefault();complete(rect);}}
 function end(event:PointerEvent){const rect=dragRectangle(event);if(rect){complete(rect,true);gesture=null;}}
 function keyboard(event:KeyboardEvent,handle:Handle|null){if(disabled||!display||!event.key.startsWith('Arrow'))return;const rect=rectangle();if(!rect)return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:event.ctrlKey||event.metaKey?1:3;
  let dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
  if(handle&&handle.length===2){if(dx!==0)dy=(handle==='ne'||handle==='sw'?-1:1)*dx;else dx=(handle==='ne'||handle==='sw'?-1:1)*dy;}
  complete(handle?resize(rect,handle,dx,dy):{...rect,x:clamp(rect.x+dx,0,display.width-rect.width),y:clamp(rect.y+dy,0,display.height-rect.height)},true);
 }
</script>
<svelte:document onpointermove={move} onpointerup={end} onpointercancel={()=>gesture=null} />
<div bind:this={frame} class="media-image-cropper-frame" data-testid="media-image-cropper-frame" inert={disabled||undefined}>
 <div class="emdash-react-image-crop" style:width={display?`${display.width}px`:undefined} style:height={display?`${display.height}px`:undefined}>
  <img bind:this={image} {src} alt="" draggable={false} onload={ready} onerror={()=>{loaded=null;onImageReady?.(null);onSourceError();}} />
  {#if crop&&loaded}
   <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (The composite crop group implements the source Arrow-key movement contract and has separate native resize buttons.) -->
   <div class="ReactCrop__crop-selection" class:fixed-aspect={Boolean(aspect)} role="group" tabindex={disabled?-1:0} aria-label="Crop selection. Use the Arrow keys to move it." onkeydown={event=>keyboard(event,null)} onpointerdown={event=>start(event,null)} style:left={`${crop.x}%`} style:top={`${crop.y}%`} style:width={`${crop.width}%`} style:height={`${crop.height}%`}>
    <div class="ReactCrop__rule-of-thirds-vt"></div><div class="ReactCrop__rule-of-thirds-hz"></div>
    {#if !disabled}{#each handles.filter(handle=>!aspect||handle.direction.length===2) as handle}<button type="button" class={`ReactCrop__drag-handle ord-${handle.direction}`} aria-label={`Resize crop from ${handle.name}. Use the Arrow keys to resize.`} onpointerdown={event=>start(event,handle.direction)} onkeydown={event=>keyboard(event,handle.direction)}></button>{/each}{/if}
   </div>
  {/if}
 </div>
</div>
<p class="media-cropper-announcement" role="status">{announcement}</p>
