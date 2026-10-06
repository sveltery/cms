// Native page/query transport for the pinned MediaPage; one supplied QueryClient.
// EmDash 1.1.0 913cb1bb; Copyright 2026 Cloudflare Inc. MIT notices/emdash-MIT.txt.
import {InfiniteQueryObserver,QueryObserver,keepPreviousData,type InfiniteData,type QueryClient} from '@tanstack/react-query';
import {ApiResponseError} from './source/api/client.ts';
import {
  fetchMediaList,fetchMediaFolders,fetchMediaFolder,createMediaFolder,renameMediaFolder,
  deleteMediaFolder,updateMedia,uploadMedia,type MediaFolder,type MediaFolderListResult,
  type MediaListResult,type MediaUploadOptions,
} from './source/api/media.ts';

export interface MediaLibraryRuntimeOptions {
  folderId?:string;
  initialItems?:MediaListResult['items'];
  initialTotal?:number;
  navigate?:(folderId:string|undefined,replace?:boolean)=>Promise<void>|void;
}

/** Owns queries and callbacks for the real page; widgets receive controlled data. */
export function createMediaLibraryRuntime(queryClient:QueryClient,options:MediaLibraryRuntimeOptions={}) {
  let search='',mimeFilter:string|string[]|undefined,folderId=options.folderId;
  let page=1,perPage=35,retainedTotalCount=options.initialTotal??0,activeProvider='local',started=false,disposed=false;
  let recoveredFolder:string|undefined,folderWarning=false;
  const listeners=new Set<()=>void>();const stops:Array<()=>void>=[];
  const mediaOptions=()=>{
    // Match the Source render closure: a query reads the state in its own key.
    const request={page,limit:perPage,search:search||undefined,mimeType:mimeFilter,folderId:search?undefined:folderId??null};
    return {
      queryKey:['media',{search,mime:Array.isArray(mimeFilter)?mimeFilter.join(','):mimeFilter??'',folder:folderId??'main',page,perPage}],
      queryFn:()=>fetchMediaList(request),placeholderData:keepPreviousData,enabled:started,
    };
  };
  const folderOptions=()=>{
    const folderSearch=search||undefined;
    return {
      queryKey:['media-folders','page',{search}],
      queryFn:({pageParam}:{pageParam:string|undefined})=>fetchMediaFolders({limit:100,cursor:pageParam,search:folderSearch}),
      initialPageParam:undefined as string|undefined,
      getNextPageParam:(lastPage:MediaFolderListResult)=>lastPage.nextCursor,
      enabled:started&&activeProvider==='local'&&page===1&&mimeFilter===undefined&&(folderId===undefined||search!==''),
    };
  };
  const currentFolderOptions=()=>{
    const requestedFolderId=folderId;
    return {
      queryKey:['media-folder',requestedFolderId],queryFn:()=>fetchMediaFolder(requestedFolderId!),enabled:started&&requestedFolderId!==undefined,
      retry:(failureCount:number,error:Error)=>!(error instanceof ApiResponseError&&error.code==='NOT_FOUND')&&failureCount<2,
    };
  };
  const media=new QueryObserver<MediaListResult>(queryClient,mediaOptions());
  const folders=new InfiniteQueryObserver<MediaFolderListResult,Error,InfiniteData<MediaFolderListResult>,readonly unknown[],string|undefined>(queryClient,folderOptions());
  const currentFolder=new QueryObserver<MediaFolder>(queryClient,currentFolderOptions());
  const emit=()=>{if(!disposed)for(const listener of listeners)listener();};
  const resetPage=()=>{page=1;retainedTotalCount=0;};
  function sync() {media.setOptions(mediaOptions());folders.setOptions(folderOptions());currentFolder.setOptions(currentFolderOptions());emit();}
  async function refreshEnabled() {
    await Promise.all([
      media.refetch({cancelRefetch:false}),
      ...(folderOptions().enabled?[folders.refetch({cancelRefetch:false})]:[]),
      ...(currentFolderOptions().enabled?[currentFolder.refetch({cancelRefetch:false})]:[]),
    ]);
  }
  async function setFolder(next:string|undefined) {
    if(folderId===next)return;
    folderId=next;resetPage();if(next!==recoveredFolder)recoveredFolder=undefined;
    sync();await refreshEnabled();
  }
  const runtime={
    queryClient,
    snapshot() {
      const result=media.getCurrentResult(),folderResult=folders.getCurrentResult(),current=currentFolder.getCurrentResult();
      const totalCount=result.data?.totalCount??retainedTotalCount,lastPage=Math.max(1,Math.ceil((result.data?.totalCount??0)/perPage));
      const recovering=result.data?.totalCount!==undefined&&page>lastPage;
      return {
        items:recovering?[]:result.data?.items??options.initialItems??[],
        error:result.error,currentFolderError:current.error,
        isLoading:result.isLoading||result.isFetching||recovering,
        pagination:{page:recovering?lastPage:page,perPage,totalCount,isPending:result.isLoading||result.isFetching||recovering},
        folders:folderResult.data?.pages.flatMap(value=>value.items)??[],
        foldersLoading:folderResult.isLoading,foldersError:folderResult.error,
        hasMoreFolders:folderResult.hasNextPage,isLoadingMoreFolders:folderResult.isFetchingNextPage,
        folderId,currentFolder:current.data??null,currentFolderLoading:current.isLoading,
        activeProvider,folderWarning,
      };
    },
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    async start() {
      if(started)return;started=true;
      stops.push(media.subscribe(result=>{
        if(result.data?.totalCount!==undefined)retainedTotalCount=result.data.totalCount;
        if(result.data&&!result.isPlaceholderData&&!result.isFetching){
          const lastPage=Math.max(1,Math.ceil((result.data.totalCount??0)/perPage));
          if(page>lastPage){page=lastPage;sync();}
        }
        emit();
      }),folders.subscribe(emit),currentFolder.subscribe(result=>{
        if(folderId&&result.error instanceof ApiResponseError&&result.error.code==='NOT_FOUND'&&recoveredFolder!==folderId){
          recoveredFolder=folderId;folderWarning=true;folderId=undefined;resetPage();sync();void options.navigate?.(undefined,true);
        }
        emit();
      }));
      sync();await refreshEnabled();
    },
    async setPage(next:number) {
      const count=Math.max(1,Math.ceil(runtime.snapshot().pagination.totalCount/perPage));
      if(media.getCurrentResult().isFetching||!Number.isSafeInteger(next)||next<1||next>count)return;
      page=next;sync();await refreshEnabled();
    },
    async setPageSize(next:number) {
      if(media.getCurrentResult().isFetching||![35,70,90].includes(next))return;
      perPage=next;resetPage();sync();await refreshEnabled();
    },
    async setSearch(next:string){if(search===next)return;search=next;resetPage();sync();await refreshEnabled();},
    async setMimeFilter(next:string|string[]|undefined){mimeFilter=next;resetPage();sync();await refreshEnabled();},
    setFolder,
    async setActiveProvider(next:string){activeProvider=next;sync();if(folderOptions().enabled)await folders.refetch({cancelRefetch:false});},
    async loadMoreFolders(){await folders.fetchNextPage();},
    async retryFolders(){await folders.refetch();},
    async createFolder(name:string) {
      const created=await createMediaFolder(name);resetPage();sync();await queryClient.invalidateQueries({queryKey:['media-folders']});return created;
    },
    async renameFolder(folder:MediaFolder,name:string) {
      const renamed=await renameMediaFolder(folder.id,name);
      await Promise.all([queryClient.invalidateQueries({queryKey:['media-folders']}),queryClient.invalidateQueries({queryKey:['media-folder',folder.id]})]);return renamed;
    },
    async deleteFolder(folder:MediaFolder) {
      await deleteMediaFolder(folder.id);const deletingCurrent=folderId===folder.id;
      if(deletingCurrent){folderId=undefined;resetPage();sync();await options.navigate?.(undefined,true);}
      queryClient.removeQueries({queryKey:['media-folder',folder.id],exact:true});
      await Promise.all([queryClient.invalidateQueries({queryKey:['media-folders']}),queryClient.invalidateQueries({queryKey:['media']})]);
      if(!deletingCurrent){resetPage();sync();}
    },
    async moveMedia(item:{id:string},destination:{id:string}) {
      try {await updateMedia(item.id,{folderId:destination.id});await queryClient.invalidateQueries({queryKey:['media']});}
      catch(error){
        const recovery:Promise<unknown>[]=[queryClient.invalidateQueries({queryKey:['media']})];
        if(error instanceof ApiResponseError&&error.code==='NOT_FOUND')recovery.push(queryClient.invalidateQueries({queryKey:['media-folders']}),queryClient.invalidateQueries({queryKey:['media-folder']}));
        if(error instanceof ApiResponseError&&(error.status===401||error.status===403))recovery.push(queryClient.resetQueries({queryKey:['currentUser'],exact:true}));
        await Promise.allSettled(recovery);throw error;
      }
    },
    async upload(file:File,uploadOptions?:MediaUploadOptions){await uploadMedia(file,uploadOptions);resetPage();sync();await queryClient.invalidateQueries({queryKey:['media']});},
    async itemUpdated(){await queryClient.invalidateQueries({queryKey:['media']});},
    dispose(){disposed=true;for(const stop of stops)stop();media.destroy();folders.destroy();currentFolder.destroy();listeners.clear();},
  };
  return runtime;
}
export type MediaLibraryRuntime=ReturnType<typeof createMediaLibraryRuntime>;
