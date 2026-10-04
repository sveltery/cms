// Uniform Source API-shape bridge over existing real Native validation.
// It does not add a production schema or fabricate an unimplemented response contract.
import * as v from 'valibot';
import { collectionInput, collectionMetadataInput } from '../../../src/lib/server/database/validation.ts';
function contract<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T) {
  return {
    parse: (value: unknown) => v.parse(schema, value),
    safeParse(value: unknown) {
      const result = v.safeParse(schema, value);
      return result.success ? { success: true as const, data: result.output }
        : { success: false as const, error: result.issues };
    }
  };
}
export const createCollectionBody = contract(collectionInput);
export const updateCollectionBody = contract(collectionMetadataInput);
function missingResponseContract(_value: unknown): never {
  throw new Error('Native collection response validation is not implemented');
}
// Uniform missing real-product boundary, not an always-valid fixture validator.
export const collectionSchema = { parse: missingResponseContract, safeParse: missingResponseContract };
export const collectionResponseSchema = collectionSchema;
