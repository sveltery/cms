import {form,query} from '$app/server';
import {getRequestEvent} from '$app/server';
import {taxonomyResponse,requestTaxonomy} from './server/taxonomies/request';
import * as input from './server/taxonomies/schema';

export const listTaxonomyDefinitions=query(input.definitionQuery,options=>taxonomyResponse(()=>requestTaxonomy().listDefinitions(options.locale)));
export const listTaxonomyCollections=query(()=>taxonomyResponse(()=>requestTaxonomy('manage').collections()));
export const getTaxonomyDefinition=query(input.taxonomyQuery,({taxonomy,locale})=>taxonomyResponse(()=>requestTaxonomy().getDefinition(taxonomy,locale)));
export const listTaxonomyTerms=query(input.taxonomyQuery,({taxonomy,locale})=>taxonomyResponse(()=>requestTaxonomy().listTerms(taxonomy,locale)));
export const getEntryTaxonomies=query(input.entryTaxonomiesInput,key=>taxonomyResponse(()=>requestTaxonomy('entry-read').entryTaxonomies(key)));
export const setEntryTaxonomyTerms=form(input.setTermsInput,value=>taxonomyResponse(async()=>{const receipt=await requestTaxonomy('entry-mutation').setEntryTerms(value);await getEntryTaxonomies({collection:value.collection,id:value.id,locale:value.locale}).refresh();return receipt;}));
export const createTaxonomyDefinition=form(input.createDefinitionInput,value=>taxonomyResponse(async()=>{const receipt=await requestTaxonomy('manage').createDefinition({...value,labelSingular:value.labelSingular||undefined,translationOf:value.translationOf||undefined});refresh(value.name,value.locale);return receipt;}));
export const updateTaxonomyDefinition=form(input.updateDefinitionInput,({name,locale,translationOf,...value})=>taxonomyResponse(async()=>{const receipt=await requestTaxonomy('manage').updateDefinition(name,{...value,labelSingular:value.labelSingular||null},locale);refresh(name,locale);return receipt;}));
export const deleteTaxonomyDefinition=form(input.deleteDefinitionInput,({taxonomy})=>taxonomyResponse(async()=>{const receipt=await requestTaxonomy('manage').deleteDefinition(taxonomy);refresh(taxonomy,'en');return receipt;}));
export const createTaxonomyTerm=form(input.createTermInput,({taxonomy,...value})=>taxonomyResponse(async()=>{const receipt=await requestTaxonomy('manage').createTerm(taxonomy,{...value,slug:value.slug||undefined,parentId:value.parentId||undefined,translationOf:value.translationOf||undefined});refresh(taxonomy,value.locale);return receipt;}));
export const updateTaxonomyTerm=form(input.updateTermInput,({taxonomy,originalSlug,locale,translationOf,...value})=>taxonomyResponse(async()=>{const receipt=await requestTaxonomy('manage').updateTerm(taxonomy,originalSlug,{...value,slug:value.slug||undefined,parentId:value.parentId||null},locale);refresh(taxonomy,locale);return receipt;}));
export const reorderTaxonomyTerms=form(input.reorderTermsInput,({taxonomy,parentId,ids})=>taxonomyResponse(async()=>{const receipt=await requestTaxonomy('manage').reorderTerms(taxonomy,{ids,parentId:parentId||null});void listTaxonomyTerms({taxonomy,locale:'en'}).refresh();return receipt;}));
export const bulkTagEntries=form(input.bulkTagInput,value=>taxonomyResponse(()=>requestTaxonomy('manage').bulkTag(getRequestEvent().url.origin,value)));
function refresh(taxonomy:string,locale:string){void listTaxonomyDefinitions({}).refresh();void listTaxonomyDefinitions({locale}).refresh();void getTaxonomyDefinition({taxonomy,locale}).refresh();void listTaxonomyTerms({taxonomy,locale}).refresh();}
