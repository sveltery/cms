/** Native queue follows pinned useMediaUploadQueue jobs, attempts and bounds. */
export interface PickerUploadJob<T> {id:number;file:File;status:'queued'|'uploading'|'complete'|'failed';attempt:number;result?:T}
export function createPickerUploadQueue<T>(upload:(file:File,options:{signal:AbortSignal;jobId:number;attempt:number})=>Promise<T>,changed:(jobs:PickerUploadJob<T>[],overflow:number)=>void,idle:()=>void,concurrency=3){
 let jobs:PickerUploadJob<T>[]=[],nextId=0,overflow=0,run=false;
 const active=new Map<number,{controller:AbortController;attempt:number}>();
 const limit=Math.min(6,Math.max(1,Number.isFinite(concurrency)?Math.floor(concurrency):3));
 const emit=()=>changed([...jobs],overflow);
 function pump(){
  for(const job of jobs.filter(job=>job.status==='queued'&&!active.has(job.id)).slice(0,limit-active.size)){
   const controller=new AbortController();active.set(job.id,{controller,attempt:job.attempt});
   jobs=jobs.map(item=>item.id===job.id?{...item,status:'uploading'}:item);emit();
   void Promise.resolve().then(()=>upload(job.file,{signal:controller.signal,jobId:job.id,attempt:job.attempt})).then(result=>settle(job,result),()=>settle(job));
  }
  if(run&&!jobs.some(job=>job.status==='queued'||job.status==='uploading')){run=false;idle();}
 }
 function settle(job:PickerUploadJob<T>,result?:T){
  const request=active.get(job.id);if(request?.attempt!==job.attempt)return;
  active.delete(job.id);if(request.controller.signal.aborted)return;
  jobs=jobs.map(item=>item.id===job.id&&item.attempt===job.attempt?{...item,status:result===undefined?'failed':'complete',result}:item);emit();pump();
 }
 return {
  add(files:readonly File[]){const accepted=files.slice(0,Math.max(0,100-jobs.length));overflow=files.length-accepted.length;const added=accepted.map(file=>({id:++nextId,file,status:'queued' as const,attempt:1}));if(!added.length){emit();return added;}run=true;jobs=[...jobs,...added];emit();queueMicrotask(pump);return added;},
  retry(id:number){run=true;jobs=jobs.map(job=>job.id===id&&job.status==='failed'?{...job,status:'queued',attempt:job.attempt+1,result:undefined}:job);emit();pump();},
  remove(id:number){const job=active.get(id);job?.controller.abort();active.delete(id);jobs=jobs.filter(job=>job.id!==id);emit();pump();},
  reset(){for(const {controller} of active.values())controller.abort();active.clear();jobs=[];overflow=0;run=false;emit();},
 };
}
