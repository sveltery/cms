import type { RequestEvent } from '@sveltejs/kit';

// Exact existing bare-render behavior extracted before its context regression.
// This introduces no storage, migrations, principal or cache implementation.
export function withQueryRenderRequest<T>(
  _event: Pick<RequestEvent, 'locals'>,
  render: () => T
): T {
  return render();
}
