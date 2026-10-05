// Finite constructor-only Node syntax transports; no general normalization or skipped nodes.
const transports = new Map([
  ['EmDashValidationError', {
    source: 'export class EmDashValidationError extends Error {\n\tconstructor(\n\t\tmessage: string,\n\t\tpublic details?: unknown,\n\t) {\n\t\tsuper(message);\n\t\tthis.name = "EmDashValidationError";\n\t}\n}',
    native: 'export class EmDashValidationError extends Error {\n\tdetails?: unknown;\n\tconstructor(\n\t\tmessage: string,\n\t\tdetails?: unknown,\n\t) {\n\t\tsuper(message);\n\t\tthis.details = details;\n\t\tthis.name = "EmDashValidationError";\n\t}\n}',
  }],
  ['EmDashStorageError', {
    source: 'export class EmDashStorageError extends Error {\n\tconstructor(\n\t\tmessage: string,\n\t\tpublic code: string,\n\t\tpublic override cause?: unknown,\n\t) {\n\t\tsuper(message);\n\t\tthis.name = "EmDashStorageError";\n\t}\n}',
    native: 'export class EmDashStorageError extends Error {\n\tpublic code: string;\n\tpublic override cause?: unknown;\n\tconstructor(\n\t\tmessage: string,\n\t\tcode: string,\n\t\tcause?: unknown,\n\t) {\n\t\tsuper(message);\n\t\tthis.code = code;\n\t\tthis.cause = cause;\n\t\tthis.name = "EmDashStorageError";\n\t}\n}',
  }],
]);

export function verifyErrorConstructorTransport(source, native, name) {
  const transport = transports.get(name);
  if (!transport || source !== transport.source || native !== transport.native) {
    throw new Error('Finite error constructor transport changed: ' + name);
  }
  return transport.native;
}
