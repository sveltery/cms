import type {ContentSeo} from './types.ts';
export interface SeoContentInput<T=Record<string,unknown>> {data:T & {title?:unknown;excerpt?:unknown;seo?:ContentSeo};seo?:Partial<ContentSeo>}
export interface SeoMeta {title:string;description:string|null;ogTitle:string;ogDescription:string|null;ogImage:string|null;canonical:string|null;robots:string|null}
export interface SeoMetaOptions {siteTitle?:string;siteUrl?:string;titleSeparator?:string;path?:string;defaultOgImage?:string;defaultTitle?:string;defaultDescription?:string}
// Incomplete API checkpoint: behavior is implemented after unchanged Source reds.
export function getSeoMeta<T>(_content:SeoContentInput<T>,_options:SeoMetaOptions={}):SeoMeta {return {title:'',description:null,ogTitle:'',ogDescription:null,ogImage:null,canonical:null,robots:null};}
export function getContentSeo<T>(_content:SeoContentInput<T>):ContentSeo|undefined {return undefined;}
