/** Trusted delegation to the SINGLE public QueryCore SDK owner. No query,
 * storage provider or synthetic entry producer is implemented here. */
export type TaxonomyEntryQuery=(collection:string,options:Record<string,unknown>)=>Promise<{entries:Array<{id:string;data:Record<string,unknown>}>}>;
interface EntryQueryHost {query:TaxonomyEntryQuery|null}
const key=Symbol.for('sveltery:taxonomy-entry-query-host');
const store=globalThis as Record<symbol,unknown>;
const host=(store[key] as EntryQueryHost|undefined)??(()=>{const value:EntryQueryHost={query:null};store[key]=value;return value;})();
/** Only the real published public SDK composition installs its actual function. */
export function registerTaxonomyEntryQuery(query:TaxonomyEntryQuery):void {host.query=query;}
export async function getEmDashCollection(collection:string,options:Record<string,unknown>):Promise<{entries:Array<{id:string;data:Record<string,unknown>}>}> {
 if(!host.query)throw new Error('Taxonomy entry queries require the configured public QueryCore SDK');
 return host.query(collection,options);
}
