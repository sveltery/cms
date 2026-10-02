import * as v from 'valibot';
import { createInput, updateInput } from './schema.ts';

/** Private UI hint only: never identity, authorization or a concurrency token. */
function editorInput<T>(schema: v.GenericSchema<unknown, T>, creation = false) {
  return v.pipe(v.looseObject({ editorMode: v.optional(v.picklist(['native', 'changed']), 'changed') }),
    v.rawTransform(({ dataset, addIssue, NEVER }) => {
      const { editorMode, ...value } = dataset.value;
      if (creation && Object.hasOwn(value, 'id')) {
        if (value.id !== JSON.stringify([value.collection, value.locale ?? 'en'])) {
          addIssue({ message: 'Form instance must match the collection and locale',
            path: [{ type: 'object', origin: 'value', input: value, key: 'id', value: value.id }] });
          return NEVER;
        }
        delete value.id;
      }
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
export const createEditorInput = editorInput(createInput, true);
export const saveEditorInput = editorInput(updateInput);
