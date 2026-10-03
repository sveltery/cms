// Explicit native lifecycle transport, not the complete source handler module.
import {createTestRuntime} from './blocks-source-runtime.ts';
import {validateMediaFields} from '../../src/lib/server/blocks/validate-media-fields.ts';
export async function handleContentCreate(db:any,collection:string,input:any){const mime=await validateMediaFields(db,collection,input.data??{});return mime.success?createTestRuntime(db).handleContentCreate(collection,input):mime;}
export async function handleContentUpdate(db:any,collection:string,id:string,input:any){const mime=await validateMediaFields(db,collection,input.data??{});return mime.success?createTestRuntime(db).handleContentUpdate(collection,id,input):mime;}
