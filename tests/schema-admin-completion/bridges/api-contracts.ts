// Uniform Source API-shape bridge over existing real Native validation.
// Production response contracts validate the original supplied Source values.
import * as v from 'valibot';
import { collectionInput, collectionMetadataInput } from '../../../src/lib/server/database/validation.ts';
import { collectionSchema as nativeCollectionSchema, collectionResponseSchema as nativeCollectionResponseSchema }
  from '../../../src/lib/server/schema/response-contracts.ts';
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
// The uniform Source parse/safeParse envelope remains framework transport only.
// All validation is owned by the actual production Valibot schemas.
export const collectionSchema = contract(nativeCollectionSchema);
export const collectionResponseSchema = contract(nativeCollectionResponseSchema);
