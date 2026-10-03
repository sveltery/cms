// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/api/redirect.ts
// blob133b0477ac6e450f2aed830beb334722e4e10678; predicate copied unchanged.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
export function isSafeRedirect(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') &&
    !url.includes('\\') && !CONTROL_CHARACTERS.test(url);
}
