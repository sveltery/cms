// Adapted from EmDash 1.1.0 packages/admin/src/lib/content-validation-errors.ts
// at 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. MIT Copyright 2026 Cloudflare Inc.
// See notices/emdash-MIT.txt and docs/native-content-editor.md.
import { isHttpError } from '@sveltejs/kit';

interface FieldLabel {
  kind?: string;
  label?: string;
  validation?: { subFields?: unknown };
}
type ManifestFields = Record<string, FieldLabel>;
interface ContentValidationIssue {
  path: string;
  code: string;
  origin?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  format?: unknown;
}
const number = new Intl.NumberFormat('en');

function isContentValidationIssue(value: unknown): value is ContentValidationIssue {
  return typeof value === 'object' && value !== null && 'path' in value &&
    typeof value.path === 'string' && 'code' in value && typeof value.code === 'string';
}
function isLabeledSubField(value: unknown): value is { slug: string; label: string } {
  return typeof value === 'object' && value !== null && 'slug' in value &&
    typeof value.slug === 'string' && 'label' in value && typeof value.label === 'string';
}
function subFieldLabel(field: FieldLabel, slug: string): string | undefined {
  const subFields = field.validation?.subFields;
  if (!Array.isArray(subFields)) return undefined;
  const match: unknown = subFields.find((subField: unknown) => isLabeledSubField(subField) && subField.slug === slug);
  return isLabeledSubField(match) && match.label ? match.label : undefined;
}
function fieldName(path: string, fields: ManifestFields): string {
  const [slug = path, row, subSlug] = path.split('.');
  const field = fields[slug];
  if (!field) return slug;
  const label = field.label || slug.charAt(0).toUpperCase() + slug.slice(1);
  const position = Number(row) + 1;
  if (field.kind === 'repeater' && subSlug && Number.isInteger(position)) {
    const subLabel = subFieldLabel(field, subSlug);
    if (subLabel) return `${subLabel} (${label}, item ${position})`;
  }
  return label;
}
function quantity(value: number, unit: string): string {
  return `${number.format(value)} ${unit}${value === 1 ? '' : 's'}`;
}
function describeIssue(issue: ContentValidationIssue, name: string): string {
  const minimum = typeof issue.minimum === 'number' ? issue.minimum : undefined;
  const maximum = typeof issue.maximum === 'number' ? issue.maximum : undefined;
  switch (issue.code) {
    case 'required': return `${name} is required.`;
    case 'unknown_field': return `${name} is not a field in this collection.`;
    case 'reference_not_found': return `${name} links to an entry that does not exist or is in the trash.`;
    case 'invalid_value': return `${name} has a value that is not one of its options.`;
    case 'invalid_format':
      if (issue.format === 'url') return `${name} must be a valid URL.`;
      if (issue.format === 'regex') return `${name} does not match the required format.`;
      break;
    case 'too_small':
      if (minimum === undefined) break;
      if (issue.origin === 'string') return `${name} needs at least ${quantity(minimum, 'character')}.`;
      if (issue.origin === 'array') return `${name} needs at least ${quantity(minimum, 'item')}.`;
      if (issue.origin === 'number') return `${name} must be at least ${number.format(minimum)}.`;
      break;
    case 'too_big':
      if (maximum === undefined) break;
      if (issue.origin === 'string') return `${name} can have at most ${quantity(maximum, 'character')}.`;
      if (issue.origin === 'array') return `${name} can have at most ${quantity(maximum, 'item')}.`;
      if (issue.origin === 'number') return `${name} must be at most ${number.format(maximum)}.`;
      break;
  }
  return `${name} has an invalid value.`;
}

/** Describe trusted native per-field issues; other errors keep their server message. */
export function describeContentValidationError(error: unknown, fields: ManifestFields): string | undefined {
  if (!isHttpError(error) || error.body.code !== 'VALIDATION_ERROR') return undefined;
  const issues = (error.body as { details?: { issues?: unknown } }).details?.issues;
  if (!Array.isArray(issues) || issues.length === 0 || !issues.every(isContentValidationIssue)) return undefined;
  const requiredPaths = new Set(issues.filter(issue => issue.code === 'required').map(issue => issue.path));
  const sentences = new Set<string>();
  for (const issue of issues) {
    if (issue.code !== 'required' && requiredPaths.has(issue.path)) continue;
    sentences.add(describeIssue(issue, fieldName(issue.path, fields)));
  }
  return [...sentences].join(' ');
}
