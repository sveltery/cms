import {afterEach,describe,expect,it,vi} from 'vitest';
import * as React from 'react';
import {render} from 'vitest-browser-react';
import {NativeBlockSubField,NativeBlockMediaField,NativeBlockTypeEditor} from './helpers/blocks-native-widget-bridge.ts';
// Original native UI regressions. These use actual Svelte widgets; separate
// secured built-adapter workflows verify persistence and ordinary authentication.
afterEach(()=>vi.unstubAllGlobals());
describe('Native reusable block controls',()=>{
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
  screen.getByRole('button',{name:'Choose from media library'}).element().click();
  await expect.element(screen.getByRole('button',{name:'new.png'})).toBeInTheDocument();
  screen.getByRole('button',{name:'new.png'}).element().click();
  expect(onchange).toHaveBeenLastCalledWith(expect.objectContaining({provider:'local',id:'asset',darkVariant:dark}));
 });
});
