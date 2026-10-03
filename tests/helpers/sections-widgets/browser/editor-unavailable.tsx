import * as React from 'react';
import type { EditorProps } from '../../../../src/lib/sections-widgets/editor.ts';
// Source SectionEditor.test.tsx replaces this export with its unchanged mock.
// The unmocked Widgets fixture receives the same truthful unavailable surface
// as production, with no fake rich-content editing behavior or availability.
export function PortableTextEditor(_props: EditorProps) {
  return <p role="alert">Content editing is unavailable until a compatible rich-content editor is configured.</p>;
}
