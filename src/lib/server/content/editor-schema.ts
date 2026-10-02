import * as v from 'valibot';
import { createInput, updateInput } from './schema.ts';

/** Private UI hint only: never identity, authorization or a concurrency token. */
function editorInput<T>(schema: v.GenericSchema<unknown, T>) {
  return v.pipe(v.looseObject({ editorMode: v.optional(v.picklist(['native', 'changed']), 'changed') }),
    v.rawTransform(({ dataset, addIssue, NEVER }) => {
      const { editorMode, ...value } = dataset.value;
      const parsed = v.safeParse(schema, value);
      if (!parsed.success) {
        for (const issue of parsed.issues) addIssue({ message: issue.message, path: issue.path });
        return NEVER;
      }
      return { ...parsed.output, editorMode };
    })) as v.GenericSchema<Record<string, any>, T & { editorMode: 'native' | 'changed' }>;
}

// Dynamic HTML field typing is isolated here; the exact shared bounded/strict
// content schemas still validate every non-hint key and produce domain values.
export const createEditorInput = editorInput(createInput);
export const saveEditorInput = editorInput(updateInput);
