import {expect,it} from 'vitest';
import {render} from 'svelte/server';
import Details from '../../src/lib/media/MediaDetails.svelte';
import {mediaPermissionsForUser} from '../../src/lib/media/permissions.ts';
import type {MediaItem} from '../../src/lib/media/types';
const image:MediaItem={id:'ready-image',filename:'photo.png',mimeType:'image/png',url:'/_emdash/api/media/file/photo.png',storageKey:'photo.png',size:124,width:4,height:4,alt:'A photo',caption:null,focalX:null,focalY:null,blurhash:null,dominantColor:null,status:'ready',authorId:'author',createdAt:'2026-01-01T00:00:00Z'};
it('renders embedded details inside the caller workspace without another details dialog',()=>{
 const {body}=render(Details,{props:{item:image,embedded:true,onclose:()=>{}}});expect(body).toContain('aria-label="Media details"');expect(body).not.toContain('<dialog');expect(body).not.toContain('Save changes');expect(body).not.toContain('Delete media');expect(body).not.toContain('Crop image');
});
it('keeps asset deletion out of a content detail workspace',()=>{
 const {body}=render(Details,{props:{item:image,embedded:true,context:'content',permissions:mediaPermissionsForUser({role:50}),actorId:'admin',onclose:()=>{}}});expect(body).toContain('Save changes');expect(body).toContain('Crop image');expect(body).not.toContain('Delete media');
});
it('offers replacement for an editor inspecting a ready local image',()=>{
 const {body}=render(Details,{props:{item:image,permissions:mediaPermissionsForUser({role:40}),actorId:'editor',onclose:()=>{}}});expect(body).toContain('Replace image');expect(body).toContain('Choose replacement image');
});
// Original native render requirements; no copied Source callback credit.
it('offers a metadata-loading audio player for a stored audio file',()=>{
 const item:MediaItem={...image,id:'local-audio',filename:'recording.wav',mimeType:'audio/wav',storageKey:'recording.wav',url:'/_emdash/api/media/file/recording.wav',width:null,height:null};
 const {body}=render(Details,{props:{item,onclose:()=>{}}});
 expect(body).toContain('<audio');expect(body).toContain('src="/_emdash/api/media/file/recording.wav"');expect(body).toContain('controls');expect(body).toContain('preload="metadata"');expect(body).not.toContain('<img');
});
it('uses the stored video file URL directly in the video player',()=>{
 const item:MediaItem={...image,id:'local-video',filename:'clip.mp4',mimeType:'video/mp4',storageKey:'clip.mp4',url:'/_emdash/api/media/file/clip.mp4'};
 const {body}=render(Details,{props:{item,onclose:()=>{}}});
 expect(body).toContain('<video');expect(body).toContain('src="/_emdash/api/media/file/clip.mp4"');expect(body).toContain('controls');expect(body).toContain('preload="metadata"');expect(body).not.toContain('<source');expect(body).not.toContain('<img');
});
