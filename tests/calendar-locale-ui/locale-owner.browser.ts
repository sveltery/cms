// Supplemental official-browser production locale wiring; controlled catalogs,
// no original callback, Request/session/HTTP/URL or modal/focus geometry credit.
import {afterEach,expect,it,vi} from 'vitest';
import {mount,tick,unmount} from 'svelte';
import {i18n} from '@lingui/core';
import Owner from './LocaleOwner.svelte';
let mounted:ReturnType<typeof mount>|undefined;
const initialLang=document.documentElement.getAttribute('lang'),initialDir=document.documentElement.getAttribute('dir');
afterEach(async()=>{if(mounted)await unmount(mounted);mounted=undefined;document.body.replaceChildren();i18n.loadAndActivate({locale:'en',messages:{}});vi.restoreAllMocks();for(const[name,value]of[['lang',initialLang],['dir',initialDir]] as const)if(value===null)document.documentElement.removeAttribute(name);else document.documentElement.setAttribute(name,value);});
it('updates actual shared schedule labels through one existing Calendar subscription',async()=>{
  i18n.loadAndActivate({locale:'en',messages:{LhMjLm:['First time'],6XgEPi:['First hour']}});
  const on=vi.spyOn(i18n,'on');mounted=mount(Owner,{target:document.body});await tick();
  expect(document.querySelector('legend')?.textContent).toBe('First time');
  expect(document.querySelector('input[aria-label="First hour"]')).not.toBeNull();
  expect(on.mock.calls.filter(([event])=>event==='change')).toHaveLength(1);
  i18n.load('en',{LhMjLm:['Second time'],6XgEPi:['Second hour']});await tick();
  expect(document.querySelector('legend')?.textContent).toBe('Second time');
  expect(document.querySelector('input[aria-label="Second hour"]')).not.toBeNull();
  expect(on.mock.calls.filter(([event])=>event==='change')).toHaveLength(1);
});
it('updates actual document and compact picker direction with the existing locale owner',async()=>{
  i18n.loadAndActivate({locale:'en',messages:{}});mounted=mount(Owner,{target:document.body});await tick();
  i18n.loadAndActivate({locale:'ar',messages:{}});await tick();
  expect(document.documentElement.getAttribute('lang')).toBe('ar');expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  expect(document.querySelector('.month table')?.getAttribute('dir')).toBe('rtl');
  i18n.loadAndActivate({locale:'de',messages:{}});await tick();
  expect(document.documentElement.getAttribute('lang')).toBe('de');expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  expect(document.querySelector('.month table')?.getAttribute('dir')).toBe('ltr');
});
