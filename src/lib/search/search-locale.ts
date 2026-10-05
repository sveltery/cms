/** Native page locale hosts the pinned Astro.currentLocale default in both components. */
export function resolveSearchLocale(override: string | null | undefined, currentLocale: string | null | undefined): string {
  return (override === undefined ? currentLocale : override) ?? '';
}
