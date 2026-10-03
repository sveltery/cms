// Source-derived paired assertions execute pinned wrappers, not an upstream test inventory.
import { afterEach, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { createElement } from '../helpers/ui-source-react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Reference from './reference/card';
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from '../../src/lib/ui/vendor/sveltery/card/index.ts';
import Fixture from './CardFixture.svelte';
const parts = { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };
const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const component of mounted.splice(0)) await unmount(component); document.body.replaceChildren(); });
function target() { const node = document.createElement('section'); document.body.append(node); return node; }
function attributes(actual: HTMLElement, expected: HTMLElement) {
  expect(actual.tagName).toBe(expected.tagName); expect(actual.tagName).toBe('DIV');
  expect(actual.getAttributeNames().sort()).toEqual(expected.getAttributeNames().sort());
  for (const name of expected.getAttributeNames()) expect(name === 'style' ? actual.style.cssText : actual.getAttribute(name), name).toBe(name === 'style' ? expected.style.cssText : expected.getAttribute(name));
}
for (const [name, Local] of Object.entries(parts)) {
  for (const attrs of [{}, { class: 'block grid grid-cols-3 items-end self-end row-start-3 px-6', 'data-slot': 'custom', title: 'Card & <draft>', 'aria-label': 'Card details', tabIndex: 2, dir: 'rtl' as const, hidden: true, style: 'color: red;' }]) {
    it(`${name} matches pinned native div, classes and spread precedence: ${JSON.stringify(attrs)}`, async () => {
      const node = target(); mounted.push(mount(Local, { target: node, props: attrs })); await tick();
      const { class: className, style, ...props } = attrs;
      const reference = document.createElement('section'); reference.innerHTML = renderToStaticMarkup(createElement(Reference[name as keyof typeof parts], { ...props, className, style: style ? { color: 'red' } : undefined }));
      attributes(node.firstElementChild as HTMLElement, reference.firstElementChild as HTMLElement);
      expect(node.querySelector('[role]')).toBeNull(); expect(node.firstElementChild!.hasAttribute('ref')).toBe(false);
    });
  }
}
for (const props of [{ size: undefined }, { size: 'default' }, { size: 'sm' }, { size: null }, { size: 'sm', 'data-size': 'custom', 'data-slot': 'consumer-card' }, { size: 'sm', 'data-size': undefined }, { size: 'sm', 'data-size': null }]) {
  it(`Card retains pinned size default and native data-size spread: ${JSON.stringify(props)}`, async () => {
    const node = target(); mounted.push(mount(Card, { target: node, props: props as never })); await tick();
    const reference = document.createElement('section'); reference.innerHTML = renderToStaticMarkup(createElement(Reference.Card, props as never));
    attributes(node.firstElementChild as HTMLElement, reference.firstElementChild as HTMLElement);
    expect(node.firstElementChild!.hasAttribute('size')).toBe(false);
  });
}
it('Svelte class arrays/objects retain pinned class-conflict resolution', async () => {
  const node = target(); mounted.push(mount(Card, { target: node, props: { class: ['grid', { 'flex-row': true, 'px-3': false }, 'flex-col px-6'] } })); await tick();
  expect(node.firstElementChild!.className).toBe('cn-card group/card grid flex-col px-6');
});
it('all seven hosts accept undefined/null refs, symbol attachments, reactive declarations, children and native events with complete cleanup', async () => {
  const component = mount(Fixture, { target: target() }); mounted.push(component); await tick();
  const hosts = [...document.querySelectorAll<HTMLDivElement>('[id^=bound-card-]')];
  expect(hosts).toHaveLength(7); expect(component.snapshot()).toEqual({ refs: hosts, attached: 7, detached: 0, clicks: [] });
  for (const [index, host] of hosts.entries()) { expect(host.textContent).toBe(`Initial & <Card> ${index}`); expect(host.title).toBe(`Initial & <Card> ${index}`); expect(host.dataset.attached).toBe('true'); host.click(); }
  expect(component.snapshot().clicks).toEqual(hosts.map(host => host.id));
  component.update(); await tick();
  expect(component.snapshot().refs).toEqual(hosts); expect(component.snapshot().attached).toBe(7);
  for (const [index, host] of hosts.entries()) { expect(host.textContent).toBe(`Updated & <Card> ${index}`); expect(host.title).toBe(`Updated & <Card> ${index}`); expect(host.classList.contains('px-6')).toBe(true); expect(host.classList.contains('px-3')).toBe(false); }
  component.remove(); await tick(); expect(component.snapshot().refs).toEqual(Array(7).fill(null)); expect(component.snapshot().detached).toBe(7);
  component.show(); await tick(); const next = [...document.querySelectorAll<HTMLDivElement>('[id^=bound-card-]')];
  expect(component.snapshot().refs).toEqual(next); expect(component.snapshot().attached).toBe(14); for (const [index, host] of next.entries()) expect(host).not.toBe(hosts[index]);
  await unmount(component); mounted.pop(); expect(component.snapshot().refs).toEqual(Array(7).fill(null)); expect(component.snapshot().detached).toBe(14);
});
