// Test-only API dependency boundary. Whole source tests mock these functions;
// no network, provider/storage or source API parity is established by this host.
export function unavailable():never {throw new Error('An unmocked media picker dependency was called');}
export const fetchMediaList=unavailable,fetchMediaFolders=unavailable,fetchMediaFolder=unavailable,fetchMediaProviders=unavailable,fetchProviderMedia=unavailable,uploadMedia=unavailable,uploadToProvider=unavailable,updateMedia=unavailable;
export const MEDIA_SEARCH_MAX_LENGTH=200;
export class ApiResponseError extends Error {constructor(message:string,public code:string){super(message);}}
export interface MediaItem {id:string;filename:string;mimeType:string;url:string;size:number;createdAt:string;[key:string]:unknown}
