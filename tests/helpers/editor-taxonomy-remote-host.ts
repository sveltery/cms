/** Fixture representation bridge for the existing public native UI baseline only. */
import {apiFetch} from './editor-taxonomy-api-host';
import {resolveTaxonomyDefinitions} from '../../src/lib/taxonomy-editor/source/taxonomy-definitions';
export async function getEntryTaxonomies({collection,id,locale}:{collection:string;id?:string;locale:string}){
 const {data:{taxonomies}}=await (await apiFetch('/_emdash/api/taxonomies')).json();
 return Promise.all(resolveTaxonomyDefinitions<any>(taxonomies,locale,'en').filter(definition=>definition.collections.includes(collection)).map(async definition=>{
  const path=`/_emdash/api/taxonomies/${definition.name}/terms?includeCounts=false${locale?'&resolveFallback=true&locale='+encodeURIComponent(locale):''}`;
  const {data:{terms}}=await (await apiFetch(path)).json();
  const assignment=id?(await (await apiFetch(`/_emdash/api/content/${collection}/${id}/terms/${definition.name}`)).json()).data:{terms:[],unresolved:[]};
  return {definition,terms,assignment};
 }));
}
export const setEntryTaxonomyTerms={for(serialized:string){const [collection,id,_locale,taxonomy]=JSON.parse(serialized);return{async submit(){
 const form=[...document.querySelectorAll<HTMLFormElement>('form')].find(form=>new FormData(form).get('taxonomy')===taxonomy);
 const terms=form?JSON.parse(String(new FormData(form).get('termIds'))):[];
 const response=await apiFetch(`/_emdash/api/content/${collection}/${id}/terms/${taxonomy}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({termIds:terms})});return response.ok;
 }}}};
