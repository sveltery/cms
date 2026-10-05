// Source-shaped runtime transport delegates to the actual canonical content API.
// This bounded content runtime does not claim the unported EmDash plugin/MCP class.
import type {CmsDatabase} from './contract.ts';
import type {ServerPrincipal} from './service.ts';
import type {LifecycleDependencies} from './lifecycle/upstream/host.ts';
import {nativeContentApi} from './content-api.ts';
export function nativeContentRuntime(database:CmsDatabase,principal:ServerPrincipal|null,dependencies:LifecycleDependencies={}){
 const api=nativeContentApi(database,principal,dependencies);
 return{
  handleContentCreate:api.create,handleContentGet:api.get,handleContentUpdate:api.update,
  handleContentPublish:api.publish,handleContentDuplicate:api.duplicate,
  handleContentDiscardDraft:api.discardDraft,handleContentCompare:api.compare,
  handleContentDelete:api.delete,handleContentPermanentDelete:api.permanentDelete,
  handleRevisionRestore:api.restoreRevision
 };
}
