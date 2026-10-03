// Original requirements from full pinned Widgets.tsx palette data, not copied Source callbacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getWidgetPalette } from '../src/lib/sections-widgets/palette.ts';
import { getWidgetComponents } from '../src/lib/server/sections-widgets/widgets/components.ts';
test('content palette insertion carries the pinned default title', () => {
  assert.deepEqual(getWidgetPalette([])[0].input, { type: 'content', title: 'Content Block' });
});
test('menu palette insertion carries the pinned default title', () => {
  assert.deepEqual(getWidgetPalette([])[1].input, { type: 'menu', title: 'Menu' });
});
test('component palette insertion leaves prop defaults to the renderer until actually edited', () => {
  const components = getWidgetComponents();
  assert.deepEqual(getWidgetPalette(components).slice(2).map(item => item.input), components.map(component => ({ type: 'component', title: component.label, componentId: component.id })));
});
