// EmDash 1.1.0 setup UI request loop, MIT, Copyright 2026 Cloudflare Inc.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; SetupWizard.tsx siteMutation.
import type { SeedProgress, SetupClient, SiteRequest, SiteResult } from './types';

/** Request each real seed batch; persistence/application belongs to the backend. */
export async function continueSeed(
  client: Pick<SetupClient, 'site'>,
  data: SiteRequest,
  onProgress: (progress: SeedProgress) => void
): Promise<SiteResult> {
  // Source restarts the progress comparison on each submit, including retries.
  let lastDone = -1;
  for (;;) {
    const result = await client.site(data);
    if (result.seedComplete !== false) return result;
    if (!result.seedProgress || result.seedProgress.done <= lastDone) throw new Error('Setup failed');
    lastDone = result.seedProgress.done;
    onProgress(result.seedProgress);
  }
}
