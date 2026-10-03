import sharp from 'sharp';
import {parseTransformParams,resolveTransformQuality} from '../source/media/image-endpoint.ts';
import type {NativeImageService} from './types.ts';

/** Actual native Node codec; bounded portable params, no remote fetch. */
export async function getNativeImageService():Promise<NativeImageService>{
 return {
  async parseURL(url){const parsed=parseTransformParams(url.searchParams);return parsed.ok?parsed.options:undefined;},
  async transform(input,options){
   const quality=resolveTransformQuality(options.format,options.quality);
   const pipeline=sharp(input).rotate().resize({width:options.width,height:options.height});
   const data=await pipeline.toFormat(options.format,quality===undefined?{}:{quality}).toBuffer();
   return {data:new Uint8Array(data),format:options.format};
  }
 };
}
