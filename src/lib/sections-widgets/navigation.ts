import { base } from '$app/paths';
export const sectionsHref = `${base}/sections`;
export function navigateSection(slug: string): void {
  window.location.href = `${base}/sections/${encodeURIComponent(slug)}`;
}
