import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createRawSnippet } from 'svelte';
import Editor from '../../../src/lib/schema-admin/ContentTypeEditor.svelte';
import * as client from '../../../src/lib/schema-admin/client';
import { FieldEditor } from './FieldEditor';
import { nativeMount } from './mount';
export function ContentTypeEditor(props: object) {
  const fieldEditor = createRawSnippet<[object]>(getProps => ({
    render: () => '<div></div>', setup(element) {
      const root = createRoot(element); root.render(React.createElement(FieldEditor, getProps())); return () => root.unmount();
    }
  }));
  return nativeMount(Editor, { ...props, client, fieldEditor });
}
