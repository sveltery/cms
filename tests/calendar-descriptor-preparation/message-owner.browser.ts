// Supplemental real-browser controlled display, not original Source callbacks.
import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { i18n } from '@lingui/core';
import Owner from './MessageOwner.svelte';

let mounted:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(mounted)await unmount(mounted);mounted=undefined;document.body.replaceChildren();i18n.loadAndActivate({locale:'en',messages:{}});vi.restoreAllMocks();});
it('updates actual production context children when the same locale catalog is replaced',async()=>{
  i18n.loadAndActivate({locale:'en',messages:{AjVXBS:['First calendar'],ecUA8p:['First today']}});
  mounted=mount(Owner,{target:document.body});await tick();
  expect(document.querySelector('h1')?.textContent).toBe('First calendar');
  expect(document.body.textContent).toContain('First today');
  i18n.load('en',{AjVXBS:['Second calendar'],ecUA8p:['Second today']});await tick();
  expect(document.querySelector('h1')?.textContent).toBe('Second calendar');
  expect(document.body.textContent).toContain('Second today');
});
it('owns one subscription and cleans it up at actual context unmount',async()=>{
  i18n.loadAndActivate({locale:'en',messages:{}});
  const on=vi.spyOn(i18n,'on');
  mounted=mount(Owner,{target:document.body});await tick();
  expect(on.mock.calls.filter(([event])=>event==='change')).toHaveLength(1);
  const remove=vi.spyOn(i18n,'removeListener');
  await unmount(mounted);mounted=undefined;
  expect(remove.mock.calls.filter(([event])=>event==='change')).toHaveLength(1);
});
