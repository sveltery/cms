/** Current Native row preservation controls; zero copied Source/identity/storage credit.
 * The real supplied QueryClient receives the production widget's invalidation.
 */
import * as React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,expect,it,vi} from 'vitest';
import {render} from 'vitest-browser-react';
import {MediaDetailPanel} from '../helpers/media-panel-react-bridge';
import {updateMedia} from '../helpers/media-panel-api-host';

vi.mock('../helpers/media-panel-api-host',async()=>({
 ...await vi.importActual('../helpers/media-panel-api-host'),
 updateMedia:vi.fn(),fetchMediaFolder:vi.fn().mockResolvedValue({id:'folder-1',name:'Product photos'}),
}));

const item={id:'media-1',filename:'photo.jpg',mimeType:'image/jpeg',url:'https://example.test/photo.jpg',storageKey:'media-1.jpg',size:200,width:100,height:100,alt:'Original',caption:'Preserved caption',focalX:null,focalY:null,blurhash:null,dominantColor:null,folderId:'folder-1',createdAt:'2025-01-15T10:30:00Z',status:'ready' as const,authorId:'user-1'};
const cacheKey=['media','native-row'] as const;
beforeEach(()=>vi.clearAllMocks());

async function renderNativeRow(){
 const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
 queryClient.setQueryData(cacheKey,{items:[item],totalCount:1});
 const refreshed=vi.fn(),changed=vi.fn();
 const screen=await render(<QueryClientProvider client={queryClient}><MediaDetailPanel open item={item} onClose={()=>{}} onItemRefreshed={refreshed} onUpdated={changed}/></QueryClientProvider>);
 return{screen,queryClient,refreshed,changed};
}

it('CURRENT Native empty update result retains the complete row and invalidates the supplied media cache',async()=>{
 vi.mocked(updateMedia).mockResolvedValue({} as never);
 const {screen,queryClient,refreshed,changed}=await renderNativeRow();
 await screen.getByLabelText('Alt Text').fill('Changed');
 screen.getByRole('button',{name:'Save',exact:true}).element().click();
 await vi.waitFor(()=>{
  expect(updateMedia).toHaveBeenCalledWith(item.id,{alt:'Changed'});
  expect(refreshed).toHaveBeenCalledExactlyOnceWith(item);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(cacheKey)?.isInvalidated).toBe(true);
 });
 expect(queryClient.getQueryData(cacheKey)).toEqual({items:[item],totalCount:1});
});

it('CURRENT Native partial update merges returned fields and retains the original URL and row metadata',async()=>{
 const returned={alt:'Changed',url:''};vi.mocked(updateMedia).mockResolvedValue(returned as never);
 const {screen,queryClient,refreshed,changed}=await renderNativeRow();
 await screen.getByLabelText('Alt Text').fill('Changed');
 screen.getByRole('button',{name:'Save',exact:true}).element().click();
 await vi.waitFor(()=>{
  expect(refreshed).toHaveBeenCalledExactlyOnceWith({...item,...returned,url:item.url});
  expect(changed).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(cacheKey)?.isInvalidated).toBe(true);
 });
});
