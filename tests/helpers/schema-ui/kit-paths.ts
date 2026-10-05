// Controlled framework path transport only; no API or authorization result.
export let base = '';
export function setBase(value: string) { base = value; }
export function resolve(path: string, parameters: Record<string, string> = {}) {
  return base + Object.entries(parameters).reduce((result, [key, value]) => result.replace(`[${key}]`, encodeURIComponent(value)), path);
}
