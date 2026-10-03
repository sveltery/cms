import type {ImageTransformOptions} from '../source/media/image-endpoint.ts';
import type {ImageTransform,ImageOutputOptions} from '@cloudflare/workers-types';
/** Native codec transport, separate from Astro's configured image-service contract. */
export interface NativeImageService {
 parseURL(url:URL,config:unknown):Promise<ImageTransformOptions|undefined>;
 transform(input:Uint8Array,options:ImageTransformOptions,config:unknown):Promise<{data:Uint8Array<ArrayBuffer>;format:string}>;
}
/** Structural type bridge only: actual Images methods/streams run unchanged in workerd. */
export interface NativeImagesBinding {
 input(body:ReadableStream<Uint8Array>):{transform(options:ImageTransform):{output(options:ImageOutputOptions):Promise<{response():Response}>}};
}
