// Structural types from the pinned EmDash bulk taxonomy API; see notices/emdash-MIT.txt.
export interface BulkTaxonomyDefinition {name:string;label:string;labelSingular?:string}
export interface BulkTaxonomyTerm {id:string;label:string;locale?:string;translationGroup?:string|null;children:BulkTaxonomyTerm[]}
export interface BulkSelectedPost {collection:string;id:string;title:string;locale?:string}
export type BulkTaxonomySource={collection:string;id:string}|{url:string};
export interface BulkTaxonomyResult {input:BulkTaxonomySource;status:'ready'|'added'|'skipped'|'unmatched'|'failed';reason?:'not_found'|'ambiguous'|'save_failed';entry?:{collection:string;id:string;title:string;locale:string}}
export interface BulkTaxonomyClient {
 terms(name:string,options:{locale:string;includeCounts:false;resolveFallback:true}):Promise<BulkTaxonomyTerm[]>;
 createTerm(name:string,input:{label:string;locale:string}):Promise<BulkTaxonomyTerm>;
 bulkTag(termId:string,items:BulkTaxonomySource[],apply?:boolean,refreshOnly?:boolean):Promise<{results:BulkTaxonomyResult[];cacheRefreshFailed:boolean}>;
 invalidate?(key:'taxonomy-terms'|'content',name?:string):Promise<void>|void;
}
export interface BulkTaxonomyDialogProps {
 taxonomies:BulkTaxonomyDefinition[];client:BulkTaxonomyClient;open:boolean;onClose:()=>void;onClosed?:()=>void;
 selected?:BulkSelectedPost[];activeLocale?:string;defaultLocale?:string;adminLocale?:string;onApplied?:(results:BulkTaxonomyResult[])=>void;
}
