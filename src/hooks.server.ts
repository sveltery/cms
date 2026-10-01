import { createCmsHandle } from '$lib/server/auth/composition';

// Hosting composition supplies an already-migrated request adapter here in a later slice.
// No storage, login, anonymous principal or write opt-in is configured by default.
export const handle = createCmsHandle(() => undefined);
