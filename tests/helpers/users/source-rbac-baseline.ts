// Test-first bridge to actual public Native role helpers. The absent scope
// function throws explicitly; no expected policy result is fabricated.
import * as permissions from '../../../src/lib/server/auth/permissions.ts';
export { hasPermission, requirePermission, canActOnOwn, requirePermissionOnResource, PermissionError }
  from '../../../src/lib/server/auth/permissions.ts';
export function clampScopes(requested: string[], role: 10 | 20 | 30 | 40 | 50): string[] {
  const implementation = Reflect.get(permissions, 'clampScopes');
  if (typeof implementation !== 'function') throw new Error('Native Source clampScopes is not implemented');
  return implementation(requested, role);
}
