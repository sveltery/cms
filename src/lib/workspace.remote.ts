import { getRequestEvent, query } from '$app/server';
import { workspaceNavigation } from '$lib/server/ui/navigation';
export const getWorkspaceNavigation = query(() => workspaceNavigation(getRequestEvent()));
