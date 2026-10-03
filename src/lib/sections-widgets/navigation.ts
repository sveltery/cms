// Native section navigation, extracted without changing the existing behavior.
export const sectionsHref = '/sections';
export function navigateSection(slug: string): void {
  window.location.href = `/sections/${encodeURIComponent(slug)}`;
}
