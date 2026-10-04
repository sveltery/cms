// Test-only native HTML descriptor host. It never sends requests or fabricates results.
function formDescriptor() {
  const values = new Map<string, unknown>();
  return {
    pending: 0, result: undefined,
    fields: new Proxy({ allIssues: () => [] }, {
      get(target, key) {
        if (key === 'allIssues') return target.allIssues;
        return {
          as(type: string, initial?: unknown) {
            if (initial !== undefined) values.set(String(key), initial);
            return { name: String(key), ...(type === 'text' || type === 'hidden' || type === 'checkbox' ? { type } : {}),
              ...(initial === undefined ? {} : { value: initial }) };
          },
          value: () => values.get(String(key))
        };
      }
    }),
    for: (_id: string) => formDescriptor()
  };
}
export const createSchemaCollection = formDescriptor();
export const updateSchemaCollection = formDescriptor();
export const addSchemaField = formDescriptor();
export const updateSchemaFieldLabel = formDescriptor();
export const updateSchemaFieldOptions = formDescriptor();

// Present for the component's value import; controlled DOM fixtures supply definition directly.
export function getSchemaCollection(_slug: string): never {
  throw new Error('Schema DOM descriptor host does not execute collection queries');
}
