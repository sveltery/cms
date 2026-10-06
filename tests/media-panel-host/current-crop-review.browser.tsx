/** Supplemental Current Native review controls; zero copied Source/backend credit.
 * Real image decoding, cropper, canvas, dialogs and supplied QueryClient are used.
 */
import * as React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,expect,it,vi} from 'vitest';
import {render} from 'vitest-browser-react';
import {userEvent} from 'vitest/browser';
import {MediaDetailPanel} from '../helpers/media-panel-react-bridge';
import {uploadMedia} from '../helpers/media-panel-api-host';

vi.mock('../helpers/media-panel-api-host',async()=>({
 ...await vi.importActual('../helpers/media-panel-api-host'),
 uploadMedia:vi.fn(),fetchMediaFolder:vi.fn().mockResolvedValue({id:'folder-1',name:'Product photos'}),
}));

// The pinned panel fixture's square SVG, decoded by the actual Native cropper.
const imageUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='gray'/%3E%3C/svg%3E";
const item={id:'native-crop-review',filename:'photo.jpg',mimeType:'image/jpeg',url:imageUrl,storageKey:'photo.jpg',size:200,width:100,height:100,alt:'Photo',caption:'',focalX:null,focalY:null,blurhash:null,dominantColor:null,folderId:'folder-1',createdAt:'2025-01-15T10:30:00Z',status:'ready' as const,authorId:'user-1'};
beforeEach(()=>vi.clearAllMocks());

async function renderNativeCrop(){
 const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const element=(value=item)=><QueryClientProvider client={queryClient}><MediaDetailPanel open item={value} canCropOriginal canDuplicateCrop onClose={()=>{}}/></QueryClientProvider>;
 const screen=await render(element());
 return{screen,element};
}

async function openCrop(screen:Awaited<ReturnType<typeof renderNativeCrop>>['screen']){
 screen.getByRole('tab',{name:'Edit image',exact:true}).element().click();
 await expect.element(screen.getByRole('button',{name:'Resize crop from top-left corner. Use the Arrow keys to resize.'})).toBeVisible();
 await expect.element(screen.getByRole('status',{name:'Crop output dimensions'})).toHaveTextContent('100 × 100');
}

it.each(['Freeform','Square'])('CURRENT Native resets unchanged %s aspect to Original',async label=>{
 const {screen}=await renderNativeCrop();await openCrop(screen);
 screen.getByRole('combobox',{name:'Aspect ratio'}).element().click();
 screen.getByRole('option',{name:label,exact:true}).element().click();
 await expect.element(screen.getByRole('status',{name:'Crop output dimensions'})).toHaveTextContent('100 × 100');
 await expect.element(screen.getByRole('button',{name:'Create cropped copy',exact:true})).toBeDisabled();
 const reset=screen.getByRole('button',{name:'Reset crop',exact:true});
 await expect.element(reset).toBeEnabled();
 reset.element().click();
 await expect.element(screen.getByRole('combobox',{name:'Aspect ratio'})).toHaveTextContent('Original');
 await expect.element(reset).toBeDisabled();
});

it('CURRENT Native disables reset and aspect controls after the actual crop source fails',async()=>{
 const {screen,element}=await renderNativeCrop();await openCrop(screen);
 const handle=screen.getByRole('button',{name:'Resize crop from top-left corner. Use the Arrow keys to resize.'});
 handle.element().focus();await userEvent.keyboard('{ArrowRight}');
 await expect.element(screen.getByRole('button',{name:'Create cropped copy',exact:true})).toBeEnabled();
 await screen.rerender(element({...item,url:'data:image/png;base64,invalid'}));
 await expect.element(screen.getByRole('alert')).toHaveTextContent('This image could not be loaded for cropping.');
 await expect.element(screen.getByRole('button',{name:'Reset crop',exact:true})).toBeDisabled();
 await expect.element(screen.getByRole('combobox',{name:'Aspect ratio'})).toBeDisabled();
});

it('CURRENT Native keeps exposed aspect options and crop draft stable while a real crop upload is pending',async()=>{
 let rejectUpload!:(cause:Error)=>void;
 vi.mocked(uploadMedia).mockImplementation(()=>new Promise((_,reject)=>rejectUpload=reject));
 const {screen}=await renderNativeCrop();await openCrop(screen);
 const handle=screen.getByRole('button',{name:'Resize crop from top-left corner. Use the Arrow keys to resize.'});
 handle.element().focus();await userEvent.keyboard('{ArrowRight}');
 const output=screen.getByRole('status',{name:'Crop output dimensions'}),draft=output.element().textContent;
 screen.getByRole('combobox',{name:'Aspect ratio'}).element().click();
 const exposedOption=screen.getByRole('option',{name:'Square',exact:true});
 screen.getByRole('button',{name:'Create cropped copy',exact:true}).element().click();
 await vi.waitFor(()=>expect(uploadMedia).toHaveBeenCalledTimes(1));
 try{
  await expect.element(exposedOption).toBeDisabled();
  exposedOption.element().click();
  await expect.element(screen.getByRole('combobox',{name:'Aspect ratio'})).toHaveTextContent('Original');
  expect(output.element().textContent).toBe(draft);
  expect(screen.getByText('Creating cropped copy...', {exact:true}).element().textContent).toBe('Creating cropped copy...');
 }finally{rejectUpload(new Error('Controlled crop upload stopped'));}
});

it('CURRENT Native Uploaded text and title retain the pinned hour and minute display',async()=>{
 const {screen}=await renderNativeCrop();
 const facts=screen.getByTestId('media-detail-dialog-file-facts').element();
 const row=Array.from(facts.children).find(node=>node.firstElementChild?.textContent==='Uploaded:');
 expect(row).toBeTruthy();
 const date=row!.querySelector('span[title]')!;
 expect(date.textContent).toBe('Jan 15, 2025, 05:30 AM');
 expect(date.getAttribute('title')).toBe('Jan 15, 2025, 05:30 AM');
});
