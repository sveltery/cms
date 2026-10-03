import {form} from '$app/server';
import * as v from 'valibot';
import {requestSchema,schemaResponse} from '$lib/server/schema/request';
import {getEditorManifest,getCollection} from '$lib/content.remote';
import {getSchemaCollection,listSchemaCollections} from '$lib/schema.remote';
import {identifier} from '$lib/server/database/validation';
const strings=v.array(identifier);
const input=v.strictObject({collection:identifier,slug:identifier,label:v.pipe(v.string(),v.minLength(1),v.maxLength(200)),allowedTypes:v.optional(strings,[]),minItems:v.optional(v.pipe(v.string(),v.regex(/^\d+$/)), '0'),maxItems:v.optional(v.pipe(v.string(),v.regex(/^\d+$/)), '100'),expectedSchemaVersion:v.pipe(v.number(),v.safeInteger(),v.minValue(1))});
export const addBlockSchemaField=form(input,value=>schemaResponse(async()=>{
 const field=await requestSchema('mutation').addField({collection:value.collection,expectedSchemaVersion:value.expectedSchemaVersion,input:{slug:value.slug,label:value.label,type:'blocks',validation:{allowedTypes:value.allowedTypes,minItems:Number(value.minItems),maxItems:Number(value.maxItems)}}});
 void getSchemaCollection(value.collection).refresh();void listSchemaCollections().refresh();void getCollection(value.collection).refresh();void getEditorManifest().refresh();return {slug:field.slug};
}));
