import type {PageMetadataContribution,PageMetadataLinkRel}from './types.ts';
export interface ResolvedPageMetadata {meta:Array<{name:string;content:string}>;properties:Array<{property:string;content:string}>;links:Array<{rel:PageMetadataLinkRel;href:string;hreflang?:string}>;jsonld:Array<{id?:string;json:string}>}
export function resolvePageMetadata(_contributions:PageMetadataContribution[]):ResolvedPageMetadata{return {meta:[],properties:[],links:[],jsonld:[]};}
export function renderPageMetadata(_metadata:ResolvedPageMetadata,_options:{includeJsonLd?:boolean}={}):string{return '';}
export function safeJsonLdSerialize(value:unknown):string{return JSON.stringify(value);}
export function escapeHtmlAttr(value:string):string{return value;}
export async function createSha256CspHash(_value:string):Promise<string>{return '';}
export async function registerJsonLdCspHashes(_enabled:boolean,_getCsp:()=>{insertScriptHash(hash:string):void}|undefined,_scripts:ReadonlyArray<{json:string}>):Promise<void>{}
