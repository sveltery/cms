import * as v from 'valibot';
import { z } from 'zod';

// EmDash 1.1.0 setup/auth DTOs use pinned Zod 4.5.4 z.email().
// Keep that decision while exposing native Valibot issue envelopes.
const sourceEmail = z.email();
export const emailInput = v.pipe(v.string(), v.check(email => sourceEmail.safeParse(email).success, 'Invalid email'));

const transports = v.array(v.picklist(['usb', 'nfc', 'ble', 'internal', 'hybrid']));
const attachment = v.optional(v.picklist(['platform', 'cross-platform']));
export const setupAdminInput = v.object({ email: emailInput, name: v.optional(v.string()) });
export const registrationCredential = v.object({ id: v.string(), rawId: v.string(), type: v.literal('public-key'),
  response: v.object({ clientDataJSON: v.string(), attestationObject: v.string(), transports: v.optional(transports) }),
  authenticatorAttachment: attachment });
export const authenticationCredential = v.object({ id: v.string(), rawId: v.string(), type: v.literal('public-key'),
  response: v.object({ clientDataJSON: v.string(), authenticatorData: v.string(), signature: v.string(), userHandle: v.optional(v.string()) }),
  authenticatorAttachment: attachment });
export const setupVerifyInput = v.object({ credential: registrationCredential });
export const loginOptionsInput = v.object({ email: v.optional(emailInput) });
export const loginVerifyInput = v.object({ credential: authenticationCredential });
