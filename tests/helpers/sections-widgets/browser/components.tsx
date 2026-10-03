// Test-only framework boundary: unchanged React Source fixtures mount actual
// production Svelte components. No original callback or assertion is adapted.
import * as React from 'react';
import { mount, unmount, type Component } from 'svelte';
import { useParams, useNavigate } from '@tanstack/react-router';
import * as api from '../../../../src/lib/sections-widgets/api.ts';
import NativeSections from '../../../../src/lib/ui/sections-widgets/Sections.svelte';
import NativePicker from '../../../../src/lib/ui/sections-widgets/SectionPickerModal.svelte';
import NativeWidgets from '../../../../src/lib/ui/sections-widgets/Widgets.svelte';
import EditorFixture from './EditorFixture.svelte';
import { PortableTextEditor } from './editor-unavailable.tsx';
import { nativeProps } from './props.svelte.ts';

function Native<P extends Record<string, unknown>>({ component, props }: { component: Component<P>; props: P }) {
  const element = React.useRef<HTMLDivElement>(null);
  const current = React.useRef<Record<string, unknown> | null>(null);
  const instance = React.useRef<Record<string, unknown> | null>(null);
  React.useLayoutEffect(() => {
    if (!element.current) return;
    const reactiveProps = nativeProps(props);
    current.current = reactiveProps;
    instance.current = mount(component, { target: element.current, props: reactiveProps });
    return () => { if (instance.current) void unmount(instance.current); current.current = null; instance.current = null; };
  }, [component]);
  React.useLayoutEffect(() => { if (current.current) Object.assign(current.current, props); });
  return <div ref={element} />;
}
export function Sections() {
  const navigate = useNavigate();
  return <Native component={NativeSections} props={{ api, navigate: (slug: string) => { void navigate({ to: '/sections/$slug', params: { slug } }); } }} />;
}
export function SectionEditor() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const navigate = useNavigate();
  return <Native component={EditorFixture} props={{ api, slug, editorComponent: PortableTextEditor, navigate: (next: string) => { void navigate({ to: '/sections/$slug', params: { slug: next } }); } }} />;
}
export function SectionPickerModal(props: { open: boolean; onOpenChange: (open: boolean) => void; onSelect: (section: api.Section) => void }) {
  return <Native component={NativePicker} props={{ ...props, api }} />;
}
export function Widgets() { return <Native component={NativeWidgets} props={{ api }} />; }
