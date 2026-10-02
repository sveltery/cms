import type { EditorField } from '$lib/server/content/manifest';
import type { Field } from '$lib/server/database/contract';

export type PreviewField = Pick<Field, 'id' | 'slug' | 'label' | 'type' | 'required' | 'validation' | 'defaultValue'>;

export function previewFields(fields: Record<string, EditorField>): PreviewField[] {
  return Object.entries(fields).map(([slug, field]) => ({
    ...field,
    slug,
    type: field.kind === 'richText' ? 'text' : 'string',
    validation: field.validation ?? null
  }));
}
