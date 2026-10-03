import {afterEach,describe,expect,it,vi} from 'vitest';
import * as React from 'react';
import {render} from 'vitest-browser-react';
import {NativeBlockSubField,NativeBlockMediaField,NativeBlockTypeEditorBoundary} from './helpers/blocks-native-widget-bridge.ts';
// Original native UI regressions. These use actual Svelte widgets; separate
// secured built-adapter workflows verify persistence and ordinary authentication.
afterEach(()=>vi.unstubAllGlobals());
describe('Native reusable block controls',()=>{
 const definition=(fingerprint:string)=>({id:'hero',slug:'hero',label:'Hero',currentVersion:1,source:'user',createdAt:'2026-01-01',updatedAt:'2026-01-01',versions:[{id:'hero-v1',blockTypeId:'hero',version:1,active:true,fingerprint,fields:[{slug:'heading',label:'Heading',type:'string'}],createdAt:'2026-01-01',updatedAt:'2026-01-01'}]});
 it('opens an existing block type from the actual reactive selection',async()=>{
  const screen=await render(React.createElement(NativeBlockTypeEditorBoundary,{type:definition('sha256:original')}));
  expect(screen.container.textContent).not.toContain('could not be cloned');
  await expect.element(screen.getByLabelText('Field label')).toHaveValue('Heading');
 });
 it('submits the fingerprint belonging to the opened edit when the list refreshes',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:false,error:{message:'The block type changed'}}),{status:409}));vi.stubGlobal('fetch',fetch);
  const screen=await render(React.createElement(NativeBlockTypeEditorBoundary,{plainFixture:true,type:definition('sha256:original')}));
  await screen.getByLabelText('Field label').fill('Updated heading');
  await screen.rerender(React.createElement(NativeBlockTypeEditorBoundary,{plainFixture:true,type:definition('sha256:concurrent')}));
  (screen.getByRole('button',{name:'Save block type'}).element() as HTMLButtonElement).click();
  await expect.element(screen.getByRole('status')).toHaveTextContent('The block type changed');
  expect(JSON.parse(fetch.mock.calls[0]![1].body).expectedFingerprint).toBe('sha256:original');
 });
 it('round-trips stored datetimes through the configured site timezone',async()=>{
  const onchange=vi.fn();const screen=await render(React.createElement(NativeBlockSubField,{id:'starts',field:{slug:'starts',label:'Starts',type:'datetime'},value:'2026-02-26T09:30:00.000Z',timezone:'Asia/Tokyo',onchange}));
  await expect.element(screen.getByLabelText('Starts')).toHaveValue('2026-02-26T18:30');
  await screen.getByLabelText('Starts').fill('2026-02-27T18:45');
  expect(onchange).toHaveBeenLastCalledWith('2026-02-27T09:45:00.000Z');
 });
 it('passes site timezone into datetime repeater subfields',async()=>{
  const onchange=vi.fn();const screen=await render(React.createElement(NativeBlockSubField,{id:'events',field:{slug:'events',label:'Events',type:'repeater',validation:{subFields:[{slug:'starts',label:'Starts',type:'datetime'}]}},value:[{starts:'2026-02-26T09:30:00.000Z'}],timezone:'Asia/Tokyo',onchange}));
  await expect.element(screen.getByLabelText('Starts')).toHaveValue('2026-02-26T18:30');
  await screen.getByLabelText('Starts').fill('2026-02-27T18:45');
  expect(onchange).toHaveBeenLastCalledWith([{starts:'2026-02-27T09:45:00.000Z'}]);
 });
 it('allows HTML form submission after selecting local media',async()=>{
  const screen=await render(React.createElement('form',null,React.createElement(NativeBlockMediaField,{id:'photo',label:'Photo',image:true,value:{provider:'local',id:'asset',meta:{storageKey:'photo.png'}},onchange:vi.fn()})));
  const input=screen.getByLabelText('Photo').element() as HTMLInputElement;
  expect(input.validity.typeMismatch).toBe(false);
  expect(input.form!.checkValidity()).toBe(true);
 });
 it('preserves a selected dark variant when replacing the primary image',async()=>{
  const dark={provider:'external',id:'',src:'https://example.com/dark.png'};const onchange=vi.fn();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,data:{items:[{id:'asset',filename:'new.png',storageKey:'new.png',mimeType:'image/png',width:40,height:30,alt:'Replacement'}],totalCount:1}}),{status:200})));
  const screen=await render(React.createElement(NativeBlockMediaField,{id:'photo',label:'Photo',image:true,value:{provider:'external',id:'',src:'https://example.com/old.png',darkVariant:dark},onchange}));
  (screen.getByRole('button',{name:'Choose from media library'}).element() as HTMLButtonElement).click();
  await expect.element(screen.getByRole('button',{name:'new.png'})).toBeInTheDocument();
  (screen.getByRole('button',{name:'new.png'}).element() as HTMLButtonElement).click();
  await expect.element(screen.getByRole('button',{name:'Use selected image'})).toBeEnabled();
  (screen.getByRole('button',{name:'Use selected image'}).element() as HTMLButtonElement).click();
  expect(onchange).toHaveBeenLastCalledWith(expect.objectContaining({provider:'local',id:'asset',darkVariant:dark}));
 });
 it('retains selected image focal point placeholders and provider metadata',async()=>{
  const onchange=vi.fn();
  const item={id:'asset',filename:'new.png',storageKey:'new.png',mimeType:'image/png',size:123,width:40,height:30,alt:'Replacement',focalX:0.2,focalY:0.8,blurhash:'full-hash',dominantColor:'#112233',meta:{custom:'kept'}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,data:{items:[item],totalCount:1}}),{status:200})));
  const screen=await render(React.createElement(NativeBlockMediaField,{id:'photo',label:'Photo',image:true,onchange}));
  (screen.getByRole('button',{name:'Choose from media library'}).element() as HTMLButtonElement).click();
  await expect.element(screen.getByRole('button',{name:'new.png'})).toBeInTheDocument();
  (screen.getByRole('button',{name:'new.png'}).element() as HTMLButtonElement).click();
  await expect.element(screen.getByRole('button',{name:'Use selected image'})).toBeEnabled();
  (screen.getByRole('button',{name:'Use selected image'}).element() as HTMLButtonElement).click();
  expect(onchange).toHaveBeenLastCalledWith(expect.objectContaining({provider:'local',id:'asset',focalX:0.2,focalY:0.8,blurhash:'full-hash',dominantColor:'#112233',meta:{custom:'kept',storageKey:'new.png'}}));
 });
 it('keeps a legacy primary URL when assigning its dark image',async()=>{
  const onchange=vi.fn();
  const screen=await render(React.createElement(NativeBlockSubField,{id:'photo',field:{slug:'photo',label:'Photo',type:'image',options:{darkVariant:true}},value:'https://example.com/primary.png',onchange}));
  await screen.getByLabelText('Photo (dark variant)').fill('https://example.com/dark.png');
  expect(onchange).toHaveBeenLastCalledWith({id:'',src:'https://example.com/primary.png',darkVariant:{provider:'external',id:'',src:'https://example.com/dark.png'}});
 });
});
