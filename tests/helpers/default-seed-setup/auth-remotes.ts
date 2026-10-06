// Test-only framework bindings for the actual current setup page. Query values
// come from the unchanged Original API mock; no enrollment action is supplied.
import { apiFetch } from '../../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/api/client';
export function getSetupStatus() {
  return apiFetch('/_emdash/api/setup/status').then(response => response.json()).then(body => body.data);
}
const field = { as(type: string, value?: string) { return { type, value }; } };
const unavailable = () => { throw new Error('Account enrollment is outside this controlled wizard baseline'); };
export const beginSetup = {
  fields: { email: field, name: field, allIssues: () => [] }, pending: 0, result: undefined,
  enhance: () => ({}), submit: unavailable
};
export const completeSetup = {
  fields: { credential: field }, pending: 0, result: undefined, submit: unavailable
};
