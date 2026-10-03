/**
 * Native inputs submit every displayed control. Preserve stored values when
 * their browser-normalized display is unchanged; the lifecycle service still
 * validates all selected changes and checks the submitted revision token.
 * Enhanced dirty snapshots use their exact values instead of this adapter.
 */
export function changedNativeScalars(submitted: Record<string, unknown>, current: Record<string, unknown>,
  fields: readonly { slug: string; type: string }[]): Record<string, unknown> {
  const types = new Map(fields.map(field => [field.slug, field.type]));
  return Object.fromEntries(Object.entries(submitted).filter(([slug, value]) => {
    const type = types.get(slug);
    if (!['string', 'slug', 'text'].includes(type ?? '') || typeof value !== 'string') return true;
    const original = typeof current[slug] === 'string' ? current[slug] : '';
    if (type === 'text') return value.replace(/\r\n?/g, '\n') !== original.replace(/\r\n?/g, '\n');
    return value !== original.replace(/[\r\n]/g, '');
  }));
}
