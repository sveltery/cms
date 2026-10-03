/** Import-only widget mock bridge; never patches global fetch or invents provider/usage success. */
import * as sourceApi from './media-panel-api-host';
import {MediaRequestError,mediaHref} from '../../src/lib/media/client';
export {MediaRequestError,mediaHref};
import {nativeMockRow} from './media-panel-response-context';
export async function uploadMediaFile(file:File,options:Record<string,unknown>={}){return sourceApi.uploadMedia(file,options);}
export async function mediaRequest<T>(path:string,options:RequestInit={}):Promise<T>{
 const match=/^\/api\/media\/([^/]+)(\/replace)?$/.exec(path);
 if(!match)throw new Error(`Unimplemented Source widget test bridge path: ${path}`);
 const id=decodeURIComponent(match[1]!);
 try {
  if(match[2] && options.method==='PUT') {
   if(!(options.body instanceof FormData))throw new TypeError('Replacement must supply actual FormData');
   return {item:await sourceApi.replaceMediaImage(id,options.body.get('file') as File,{width:Number(options.body.get('width')),height:Number(options.body.get('height'))})} as T;
  }
  if(options.method==='PUT')return {item:nativeMockRow(id,await sourceApi.updateMedia(id,JSON.parse(options.body as string)))} as T;
  if(options.method==='DELETE')return await sourceApi.deleteMedia(id) as T;
  if(!options.method || options.method==='GET')return {item:await sourceApi.fetchMediaItem(id)} as T;
  throw new Error(`Unimplemented Source widget test bridge method: ${options.method}`);
 } catch(error) {
  if(error instanceof sourceApi.ApiResponseError)throw new MediaRequestError(error.code,error.message,error.status);
  throw error;
 }
}
