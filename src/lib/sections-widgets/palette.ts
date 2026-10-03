// Pinned EmDash Widgets.tsx palette payloads; MIT Cloudflare2026, notices/emdash-MIT.txt.
import type { WidgetComponent, CreateWidgetInput } from './widgets.ts';
export function getWidgetPalette(components: WidgetComponent[]) {
  return [
    { label: 'Content Block', description: 'Rich text content', input: { type: 'content', title: 'Content Block' } as CreateWidgetInput },
    { label: 'Menu', description: 'Display a navigation menu', input: { type: 'menu', title: 'Menu' } as CreateWidgetInput },
    ...components.map(component => ({ label: component.label, description: component.description,
      input: { type: 'component', title: component.label, componentId: component.id } as CreateWidgetInput }))
  ];
}
