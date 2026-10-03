// Native transport for the pinned validation-error contract. MIT; see
// parity/emdash/writable-editor-source/packages/admin/src/lib/api/client.ts.
export class EditorResponseError extends Error {
  constructor(public status: number, public code: string, message: string,
    public details?: Record<string, unknown>) { super(message); this.name = 'EditorResponseError'; }
}

export interface LabeledEditorField {
  kind: string;
  label?: string;
  validation?: Record<string, unknown>;
}

/** The current preview has no field-aware rejection presenter. */
export function describeContentValidationError(_error: unknown,
  _fields: Record<string, LabeledEditorField>): string | undefined { return undefined; }
