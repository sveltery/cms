/** ORIGINAL native widget requirement, grounded in full pinned Source updateMutation.onSuccess.
 * Ordinary isolated widget/API mock only; zero live identity/storage/Source callback credit.
 */
import * as React from 'react';
import {it,expect,vi,beforeEach} from 'vitest';
import {render} from 'vitest-browser-react';
import {MediaDetailPanel} from '../helpers/media-panel-react-bridge';
import {updateMedia} from '../helpers/media-panel-api-host';
vi.mock('../helpers/media-panel-api-host',async()=>({...await vi.importActual('../helpers/media-panel-api-host'),updateMedia:vi.fn()}));
const item={id:'media-1',filename:'photo.jpg',mimeType:'image/jpeg',url:'https://example.test/photo.jpg',storageKey:'media-1.jpg',size:200,width:100,height:100,alt:'Original',caption:'Preserved caption',focalX:null,focalY:null,blurhash:null,dominantColor:null,folderId:'folder-1',createdAt:'2025-01-15T10:30:00Z',status:'ready' as const,authorId:'user-1'};
beforeEach(()=>vi.resetAllMocks());
it('ORIGINAL native metadata callback preserves the complete local item with an empty Source mock result',async()=>{
 vi.mocked(updateMedia).mockResolvedValue({} as never);const refreshed=vi.fn();
 const screen=await render(<MediaDetailPanel open item={item} onClose={()=>{}} onItemRefreshed={refreshed}/>);
 await screen.getByLabelText('Alt text').fill('Changed');screen.getByRole('button',{name:'Save changes'}).element().click();
 await vi.waitFor(()=>expect(refreshed).toHaveBeenCalledWith(item));
});
it('ORIGINAL native metadata callback merges only returned changes and retains the original URL',async()=>{
 const returned={alt:'Changed',url:''};vi.mocked(updateMedia).mockResolvedValue(returned as never);const refreshed=vi.fn();
 const screen=await render(<MediaDetailPanel open item={item} onClose={()=>{}} onItemRefreshed={refreshed}/>);
 await screen.getByLabelText('Alt text').fill('Changed');screen.getByRole('button',{name:'Save changes'}).element().click();
 await vi.waitFor(()=>expect(refreshed).toHaveBeenCalledWith({...item,...returned,url:item.url}));
});
