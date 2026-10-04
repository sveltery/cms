// Public Kit types for this test-only entry into the exact installed module.
declare module 'sveltery-test:installed-kit-form' {
  import type { RemoteForm } from '@sveltejs/kit';
  export function form(id: string): RemoteForm<Record<string, string>, { id: string; type: string; locale: string; _rev: string }>;
}
