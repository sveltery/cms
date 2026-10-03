import type { Transporter } from '@sveltejs/kit';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

// Devalue reserves __proto__ in ordinary objects. A supported custom transport
// can carry a JSON object as text and safely restore its own keys with JSON.parse.
// Reject every value JSON.stringify would omit or coerce, including accessors.
function isJsonValue(value: unknown, ancestors = new Set<object>()): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  if (array ? Object.getPrototypeOf(value) !== Array.prototype
    : ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string')) return false;
  if (array && (keys.length !== value.length + 1 || keys.some(key => key !== 'length'
    && (!/^(0|[1-9]\d*)$/.test(String(key)) || Number(key) >= value.length)))) return false;
  ancestors.add(value);
  try {
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !('value' in descriptor) || !isJsonValue(descriptor.value, ancestors)) return false;
    }
    return true;
  } finally { ancestors.delete(value); }
}

function isOwnKeyObject(value: unknown): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.hasOwn(value, '__proto__') && isJsonValue(value);
}

export const jsonOwnKeys: Transporter<unknown, string> = {
  encode(value) {
    try { return isOwnKeyObject(value) ? JSON.stringify(value) : false; }
    catch { return false; }
  },
  decode(encoded) {
    try {
      if (typeof encoded === 'string') {
        const value: unknown = JSON.parse(encoded);
        if (isOwnKeyObject(value)) return value;
      }
    } catch { /* Invalid encodings never enter the native input schema. */ }
    throw new TypeError('Invalid JSON transport value');
  }
};
