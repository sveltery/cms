import {form} from '$app/server';
import * as v from 'valibot';
import {requestSchema,schemaResponse} from '$lib/server/schema/request';
import {getEditorManifest,getCollection} from '$lib/content.remote';
import {getSchemaCollection,listSchemaCollections} from '$lib/schema.remote';
import {identifier} from '$lib/server/database/validation';
import {CmsError} from '$lib/server/database/contract';
const strings=v.array(identifier);
const label=v.pipe(v.string(),v.minLength(1),v.maxLength(200));
const limit=v.optional(v.union([v.literal(''),v.pipe(v.string(),v.regex(/^\d+$/))]));
const controls={collection:identifier,label,allowedTypes:v.optional(strings,[]),minItems:limit,maxItems:limit};
const input=v.strictObject({...controls,slug:identifier,expectedSchemaVersion:v.pipe(v.number(),v.safeInteger(),v.minValue(1))});
function validation(value:{allowedTypes:string[];minItems?:string;maxItems?:string}){return {allowedTypes:value.allowedTypes,...(value.minItems?{minItems:Number(value.minItems)}:{}),...(value.maxItems?{maxItems:Number(value.maxItems)}:{})};}
function refresh(collection:string){void getSchemaCollection(collection).refresh();void listSchemaCollections().refresh();void getCollection(collection).refresh();void getEditorManifest().refresh();}
export const addBlockSchemaField=form(input,value=>schemaResponse(async()=>{
 const field=await requestSchema('mutation').addField({collection:value.collection,expectedSchemaVersion:value.expectedSchemaVersion,input:{slug:value.slug,label:value.label,type:'blocks',validation:validation(value)}});
 refresh(value.collection);return {slug:field.slug};
}));
export const updateBlockSchemaField=form(v.strictObject({...controls,field:identifier}),value=>schemaResponse(async()=>{
 const service=requestSchema('mutation');
 const definition=await service.getCollection(value.collection);
 const target=definition.fields.find(field=>field.slug===value.field);
 if(!target)throw new CmsError('NOT_FOUND');
 if(target.type!=='blocks')throw new CmsError('VALIDATION_ERROR','Choose a blocks field');
 const field=await service.updateField({collection:value.collection,field:value.field,label:value.label,validation:validation(value)});
 refresh(value.collection);return {slug:field.slug};
}));
