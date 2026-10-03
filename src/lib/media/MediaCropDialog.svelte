<script lang="ts">
 import MediaDialog from './MediaDialog.svelte';
 import MediaImageCropper,{type MediaCropSelection} from './MediaImageCropper.svelte';
 import {createCroppedImageFile,createCroppedFilename,type CropAspectMode,type PixelCrop} from './source/crop-image';
 import type {MediaItem} from './types';
 let {item,src,oncreate,onclose}:{item:MediaItem;src:string;oncreate:(file:File)=>Promise<void>;onclose:()=>void}=$props();
 let image=$state<HTMLImageElement|null>(null);
 let source=$state<{width:number;height:number}|null>(null),crop=$state<MediaCropSelection>(),pixels=$state<PixelCrop>({x:0,y:0,width:0,height:0});
 let mode=$state<CropAspectMode>('original'),busy=$state(false),error=$state('');
 const aspect=$derived(mode==='freeform'?undefined:mode==='original'?(source?source.width/source.height:undefined):mode==='square'?1:mode==='4:3'?4/3:mode==='3:2'?3/2:16/9);
 const valid=$derived(!!source&&!!image&&[pixels.x,pixels.y,pixels.width,pixels.height].every(Number.isSafeInteger)&&pixels.x>=0&&pixels.y>=0&&pixels.width>0&&pixels.height>0&&pixels.x+pixels.width<=source.width&&pixels.y+pixels.height<=source.height);
 function setPixels(key:keyof PixelCrop,event:Event){if(!source)return;pixels={...pixels,[key]:(event.currentTarget as HTMLInputElement).valueAsNumber};
  if(aspect&&key==='width')pixels.height=Math.max(1,Math.round(pixels.width/aspect));
  if(aspect&&key==='height')pixels.width=Math.max(1,Math.round(pixels.height*aspect));
  crop={unit:'%',x:pixels.x/source.width*100,y:pixels.y/source.height*100,width:pixels.width/source.width*100,height:pixels.height/source.height*100};
 }
 async function create(){if(!valid||!image)return;busy=true;error='';try{const filename=createCroppedFilename(item.filename,mode,pixels);const file=await createCroppedImageFile(image,pixels,filename,item.mimeType);await oncreate(file);}catch(cause){error=cause instanceof Error?cause.message:'Cropped image could not be created';}finally{busy=false;}}
</script>
<MediaDialog label="Crop image" dismissible={!busy} {onclose}>
 <h2>Crop image</h2>
 <MediaImageCropper {src} {crop} {aspect} disabled={busy} onCropChange={value=>crop=value} onCropComplete={value=>pixels=value} onSourceReady={size=>source=size} onSourceError={()=>{image=null;error='This image could not be loaded for cropping.';}} onImageReady={value=>image=value} />
 <form onsubmit={event=>{event.preventDefault();void create();}}>
  <label>Crop aspect ratio<select bind:value={mode} disabled={busy} onchange={()=>crop=undefined}><option value="original">Original</option><option value="freeform">Freeform</option><option value="square">Square</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option></select></label>
  <fieldset disabled={busy||!source}><legend>Crop rectangle</legend><label>Crop X<input type="number" min="0" step="1" value={pixels.x} oninput={event=>setPixels('x',event)} /></label><label>Crop Y<input type="number" min="0" step="1" value={pixels.y} oninput={event=>setPixels('y',event)} /></label><label>Crop width<input type="number" min="1" step="1" value={pixels.width} oninput={event=>setPixels('width',event)} /></label><label>Crop height<input type="number" min="1" step="1" value={pixels.height} oninput={event=>setPixels('height',event)} /></label></fieldset>
  <output aria-label="Crop output dimensions">{pixels.width} × {pixels.height}</output>
  {#if error}<p role="alert">{error}</p>{/if}
  <button type="submit" disabled={busy||!valid}>{busy?'Creating cropped copy…':'Create cropped copy'}</button><button type="button" disabled={busy} onclick={onclose}>Cancel</button>
 </form>
</MediaDialog>
<style>form,label{display:grid;gap:.4rem}form{gap:1rem;margin-top:1rem}fieldset{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}input,select,button{font:inherit;padding:.65rem;border:1px solid #c8ced8;border-radius:.5rem}button{cursor:pointer}button:disabled{cursor:default;opacity:.5}output{font-variant-numeric:tabular-nums}</style>
