// Media consumers share the existing canonical media and editor-manifest owners.
// No registry, provider or independent response cache is installed here.
import {base} from '$app/paths';
import {apiFetch,parseApiResponse} from './source/api/client';
export * from './source/api/media';
export {ApiResponseError} from './source/api/client';

/** Structural view of the actual editor manifest used by media reference labels. */
export interface MediaManifest {
 collections:Record<string,{label?:string;fields:Record<string,{label?:string}>}>;
 i18n?:{defaultLocale:string;locales:string[]};
}

/** Read the existing permission-checked canonical editor manifest endpoint. */
export async function fetchManifest():Promise<MediaManifest> {
 const response=await apiFetch(`${base}/api/content-picker/manifest`);
 return parseApiResponse<MediaManifest>(response,'Failed to fetch manifest');
}
