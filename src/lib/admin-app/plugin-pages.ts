// EmDash 1.1.0 packages/admin/src/lib/plugin-context.tsx path algorithm.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Generic types preserve component identity without declaring React exports to
// be Svelte components. Full trusted plugin mounting is a separate integration.
function togglePagePathTrailingSlash(path: string): string {
 if (path === '/') return path;
 return path.endsWith('/') ? path.slice(0, -1) : `${path}/`;
}
export function resolvePluginPagePath<Component>(pages: Record<string, Component> | undefined, path: string): Component | null {
 if (!pages) return null;
 const match = pages[path] ?? pages[togglePagePathTrailingSlash(path)];
 if (match) return match;
 if (path === '/') return Object.values(pages)[0] ?? null;
 return null;
}
