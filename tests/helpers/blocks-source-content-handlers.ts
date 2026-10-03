// Explicit native lifecycle transport, not the complete source handler module.
import {createTestRuntime} from './blocks-source-runtime.ts';
export function handleContentCreate(db:any,collection:string,input:any){return createTestRuntime(db).handleContentCreate(collection,input);}
export function handleContentUpdate(db:any,collection:string,id:string,input:any){return createTestRuntime(db).handleContentUpdate(collection,id,input);}
