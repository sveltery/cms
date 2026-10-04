interface EntryIdentity { id: string; slug: string | null; locale: string | null }

export function publicLocaleHref(path: string, locale: string | null | undefined): string {
  return locale ? `${path}?${new URLSearchParams({ locale })}` : path;
}

export function publicEntryHref(entry: EntryIdentity, type: 'posts' | 'pages', base = ''): string {
  // Match the pinned loader's nonempty-slug-or-ID fallback; preserve each
  // persisted variant even when the archive itself has no locale filter.
  return publicLocaleHref(`${base}/${type}/${encodeURIComponent(entry.slug || entry.id)}`, entry.locale);
}
