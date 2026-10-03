import type { WidgetComponent, CreateWidgetInput } from './widgets.ts';
export function getWidgetPalette(components: WidgetComponent[]) {
  return [
    { label: 'Content Block', description: 'Rich text content', input: { type: 'content' } as CreateWidgetInput },
    { label: 'Menu', description: 'Display a navigation menu', input: { type: 'menu' } as CreateWidgetInput },
    ...components.map(component => ({ label: component.label, description: component.description,
      input: { type: 'component', componentId: component.id, componentProps: Object.fromEntries(Object.entries(component.props).map(([key, def]) => [key, def.default ?? ''])) } as CreateWidgetInput }))
  ];
}
