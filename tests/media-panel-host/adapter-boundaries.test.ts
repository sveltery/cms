import {beforeEach,describe,it,expect,vi} from 'vitest';
import {mediaRequest,uploadMediaFile,MediaRequestError} from '../helpers/media-panel-client-host';
import * as api from '../helpers/media-panel-api-host';
vi.mock('../helpers/media-panel-api-host',async()=>({...await vi.importActual('../helpers/media-panel-api-host'),updateMedia:vi.fn(),replaceMediaImage:vi.fn(),uploadMedia:vi.fn(),deleteMedia:vi.fn(),fetchMediaItem:vi.fn()}));
describe('ORIGINAL test-host boundaries; zero Source, identity, or real provider credit',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('forwards unchanged metadata and adds only the mock row envelope',async()=>{
  const returned={id:'row',caption:'returned'};vi.mocked(api.updateMedia).mockResolvedValue(returned as never);
  const payload={alt:'',focalX:null,focalY:null};
  const result=await mediaRequest('/api/media/row',{method:'PUT',body:JSON.stringify(payload)});
  expect(api.updateMedia).toHaveBeenCalledExactlyOnceWith('row',payload);
  expect(result).toEqual({item:returned});
  expect((result as {item:unknown}).item).toBe(returned);

 });
 it('retains actual native error class, status, code and message',async()=>{
  vi.mocked(api.updateMedia).mockRejectedValue(new api.ApiResponseError(404,'NOT_FOUND','Original Source rejection'));
  try{await mediaRequest('/api/media/row',{method:'PUT',body:'{}'});throw new Error('Expected rejection');}
  catch(error){expect(error).toBeInstanceOf(MediaRequestError);expect(error).toMatchObject({status:404,code:'NOT_FOUND',message:'Original Source rejection'});}
 });
 it('passes the actual replacement File and exact dimensions through',async()=>{
  const file=new File(['bytes'],'same.png',{type:'image/png'}),body=new FormData();body.append('file',file);body.append('width','80');body.append('height','40');
  const row={id:'row',url:'/original.png'};vi.mocked(api.replaceMediaImage).mockResolvedValue(row as never);
  expect(await mediaRequest('/api/media/row/replace',{method:'PUT',body})).toEqual({item:row});
  expect(api.replaceMediaImage).toHaveBeenCalledExactlyOnceWith('row',file,{width:80,height:40});
 });
 it('does not add admission flags or simulate uploaded bytes',async()=>{
  const file=new File(['bytes'],'copy.png',{type:'image/png'}),options={deduplicate:false,ensureUniqueFilename:true,folderId:'folder'};
  const row={id:'distinct'};vi.mocked(api.uploadMedia).mockResolvedValue(row as never);
  expect(await uploadMediaFile(file,options)).toBe(row);
  expect(api.uploadMedia).toHaveBeenCalledExactlyOnceWith(file,options);
 });
 it('does not fabricate storage cleanup or unimplemented route success',async()=>{
  vi.mocked(api.deleteMedia).mockResolvedValue(undefined);
  expect(await mediaRequest('/api/media/row',{method:'DELETE'})).toBeUndefined();
  await expect(mediaRequest('/api/media/row/usage')).rejects.toThrow();
  expect(api.fetchMediaItem).not.toHaveBeenCalled();
 });
 it('preserves partial and malformed Source responses for actual product behavior to handle',async()=>{
  vi.mocked(api.updateMedia).mockResolvedValue({} as never);
  expect(await mediaRequest('/api/media/row',{method:'PUT',body:'{}'})).toEqual({item:{}});
  vi.mocked(api.updateMedia).mockResolvedValue(null as never);
  expect(await mediaRequest('/api/media/row',{method:'PUT',body:'{}'})).toEqual({item:null});
 });
});
