// Native transport for the pinned validation-error contract. MIT Copyright
// 2026 Cloudflare Inc.; see notices/emdash-MIT.txt and docs/writable-editor-source.json.
export class EditorResponseError extends Error {
  constructor(public status: number, public code: string, message: string,
    public details?: Record<string, unknown>) { super(message); this.name = 'EditorResponseError'; }
}

export interface LabeledEditorField {
  kind: string;
  label?: string;
  validation?: Record<string, unknown>;
}

interface Issue { path: string; code: string; origin?: unknown; minimum?: unknown; maximum?: unknown; format?: unknown }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
function name(path: string, fields: Record<string, LabeledEditorField>) {
  const [slug = path, row, subSlug] = path.split('.');
  const field = Object.hasOwn(fields, slug) ? fields[slug] : undefined;
  if (!field) return slug;
  const label = field.label || slug.charAt(0).toUpperCase() + slug.slice(1);
  const position = Number(row) + 1;
  if (field.kind === 'repeater' && subSlug && Number.isInteger(position) && Array.isArray(field.validation?.subFields)) {
    const subField = field.validation.subFields.find((item: unknown) => record(item) && item.slug === subSlug && typeof item.label === 'string');
    if (record(subField) && subField.label) return `${subField.label} (${label}, item ${position})`;
  }
  return label;
}
function sentence(issue: Issue, label: string): string {
  const minimum = typeof issue.minimum === 'number' ? issue.minimum : undefined;
  const maximum = typeof issue.maximum === 'number' ? issue.maximum : undefined;
  switch (issue.code) {
    case 'required': return `${label} is required.`;
    case 'unknown_field': return `${label} is not a field in this collection.`;
    case 'reference_not_found': return `${label} links to an entry that does not exist or is in the trash.`;
    case 'invalid_value': return `${label} has a value that is not one of its options.`;
    case 'invalid_format':
      if (issue.format === 'url') return `${label} must be a valid URL.`;
      if (issue.format === 'regex') return `${label} does not match the required format.`;
      break;
    case 'too_small':
      if (minimum === undefined) break;
      if (issue.origin === 'string') return `${label} needs at least ${minimum} character${minimum === 1 ? '' : 's'}.`;
      if (issue.origin === 'array') return `${label} needs at least ${minimum} item${minimum === 1 ? '' : 's'}.`;
      if (issue.origin === 'number') return `${label} must be at least ${new Intl.NumberFormat('en').format(minimum)}.`;
      break;
    case 'too_big':
      if (maximum === undefined) break;
      if (issue.origin === 'string') return `${label} can have at most ${maximum} character${maximum === 1 ? '' : 's'}.`;
      if (issue.origin === 'array') return `${label} can have at most ${maximum} item${maximum === 1 ? '' : 's'}.`;
      if (issue.origin === 'number') return `${label} must be at most ${new Intl.NumberFormat('en').format(maximum)}.`;
  }
  return `${label} has an invalid value.`;
}

/** Source field labels, de-duplication and bounds; native English presentation. */
export function describeContentValidationError(error: unknown,
  fields: Record<string, LabeledEditorField>): string | undefined {
  if (!(error instanceof EditorResponseError) || error.code !== 'VALIDATION_ERROR') return undefined;
  const issues = error.details?.issues;
  if (!Array.isArray(issues) || issues.length === 0 || !issues.every(value => record(value) && typeof value.path === 'string' && typeof value.code === 'string')) return undefined;
  const typed = issues as Issue[];
  const required = new Set(typed.filter(issue => issue.code === 'required').map(issue => issue.path));
  const sentences = new Set<string>();
  for (const issue of typed) {
    if (issue.code !== 'required' && required.has(issue.path)) continue;
    sentences.add(sentence(issue, name(issue.path, fields)));
  }
  return [...sentences].join(' ');
}

export function editorError(cause: unknown): EditorResponseError {
  if (cause instanceof EditorResponseError) return cause;
  if (record(cause)) {
    const body = record(cause.body) ? cause.body : cause;
    return new EditorResponseError(typeof cause.status === 'number' ? cause.status : 500,
      typeof body.code === 'string' ? body.code : 'UNKNOWN_ERROR',
      typeof body.message === 'string' ? body.message : 'Failed to save. Try again.',
      record(body.details) ? body.details : undefined);
  }
  return new EditorResponseError(500, 'UNKNOWN_ERROR', 'Failed to save. Try again.');
}
