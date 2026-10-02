// TDD API scaffold. Replaced by the pinned implementation after source-red evidence.
const schema = { shape: {}, parse(value: unknown) { return value; },
  safeParse(value: unknown) { return { success: true, data: value }; },
  partial() { return this; } };
export const generateFieldSchema = (..._args: unknown[]) => schema;
export const generateZodSchema = (..._args: unknown[]) => schema;
export const validateContent = (..._args: unknown[]) => ({ success: true });
export const generateTypeScript = (..._args: unknown[]) => '';
export const generateTypesFile = (..._args: unknown[]) => '';
export const clearSchemaCache = () => {};
