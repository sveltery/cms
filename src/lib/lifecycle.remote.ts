import { query, form, requested } from '$app/server';
import { getContent, listContent } from './content.remote';
import { withRevision, precondition } from './server/content/schema';
import { requestLifecycle, lifecycleResponse } from './server/lifecycle/request';
import { contentEntry, lifecycleMutation, publishInput, revisionList, restoreRevisionInput } from './server/lifecycle/schema';
import { contentKey, createInput } from './server/content/schema';

export const createLifecycleContent=form(createInput,(input)=>lifecycleResponse(async()=>{
  const {collection,...value}=input;
  const item=await requestLifecycle('mutation').createContent({type:collection,...value});
  await refresh(collection,item.id,item.locale??'en');
  return receipt(contentEntry(item));
}));

export const getLifecycleContent=query(contentKey,({collection,...input})=>
  lifecycleResponse(async()=>withRevision(contentEntry(await requestLifecycle().getContent({type:collection,...input})))));

export const listContentRevisions=query(revisionList,({collection,...input})=>
  lifecycleResponse(()=>requestLifecycle().listRevisions({type:collection,...input})));

export const publishContent=form(publishInput,(input)=>lifecycleResponse(async()=>{
  const service=requestLifecycle('mutation');const {collection,_rev,...value}=input;
  const item=await service.publish({type:collection,...value,expected:precondition(input)});
  await refresh(collection,value.id,value.locale);
  return receipt(contentEntry(item));
}));
export const unpublishContent=form(lifecycleMutation,(input)=>lifecycleResponse(async()=>{
  const service=requestLifecycle('mutation');const {collection,_rev,...value}=input;
  const item=await service.unpublish({type:collection,...value,expected:precondition(input)});
  await refresh(collection,value.id,value.locale);
  return receipt(contentEntry(item));
}));
export const discardContentDraft=form(lifecycleMutation,(input)=>lifecycleResponse(async()=>{
  const service=requestLifecycle('mutation');const {collection,_rev,...value}=input;
  const item=await service.discardDraft({type:collection,...value,expected:precondition(input)});
  await refresh(collection,value.id,value.locale);
  return receipt(contentEntry(item));
}));
export const restoreContentRevision=form(restoreRevisionInput,(input)=>lifecycleResponse(async()=>{
  const service=requestLifecycle('mutation');const {collection,_rev,...value}=input;
  const item=await service.restoreRevision({type:collection,...value,expected:precondition(input)});
  await refresh(collection,value.id,value.locale);
  return receipt(contentEntry(item));
}));

function receipt(item:ReturnType<typeof contentEntry>) {
  const value=withRevision(item);return {id:value.id,type:value.type,locale:value.locale,_rev:value._rev};
}
async function refresh(collection:string,id:string,locale:string) {
  void getContent({collection,id,locale}).refresh();void listContent({collection,locale}).refresh();
  void getLifecycleContent({collection,id,locale}).refresh();
  void listContentRevisions({collection,id,locale}).refresh();
  if(locale==='en'){
    void getContent({collection,id}).refresh();void listContent({collection}).refresh();
    void getLifecycleContent({collection,id}).refresh();
    void listContentRevisions({collection,id}).refresh();
  }
  for await(const {arg,query}of requested(listContentRevisions,5))if(arg.collection===collection&&arg.id===id&&arg.locale===locale)void query.refresh();
  for await(const {arg,query}of requested(listContent,5))if(arg.collection===collection&&arg.locale===locale)void query.refresh();
  for await(const {arg,query}of requested(getContent,5))if(arg.collection===collection&&arg.id===id&&arg.locale===locale)void query.refresh();
  for await(const {arg,query}of requested(getLifecycleContent,5))if(arg.collection===collection&&arg.id===id&&arg.locale===locale)void query.refresh();
}
