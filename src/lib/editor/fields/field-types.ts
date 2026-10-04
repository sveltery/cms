// Native data-control interface. Published EditorField descriptors are consumed
// without rewriting the schema or its validation/options contract.
export interface ChoiceOption { value: string; label: string }
export interface DataField {
  id?: string;
  type: string;
  kind?: string;
  label: string;
  required?: boolean;
  translatable?: boolean;
  unsupportedType?: unknown;
  widget?: string;
  options?: object | null;
  validation?: {
    min?: unknown; max?: unknown; minLength?: unknown; maxLength?: unknown;
    subFields?: unknown; minItems?: unknown; maxItems?: unknown;
  } | null;
}
export interface FieldProps {
  name: string;
  field: DataField;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  timezone?: string;
  context?: 'field' | 'repeater';
}
export function choiceOptions(value: unknown): ChoiceOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(option => {
    if (typeof option === 'string') return [{ value: option, label: option }];
    if (typeof option === 'object' && option !== null &&
      typeof option.value === 'string' && typeof option.label === 'string') {
      return [{ value: option.value, label: option.label }];
    }
    return [];
  });
}
export const TYPED_FIELD_TYPES = new Set([
  'slug', 'url', 'number', 'integer', 'boolean', 'datetime',
  'select', 'multiSelect', 'json', 'repeater', 'portableText'
]);
