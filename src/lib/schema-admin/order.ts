// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// EmDash 1.1.0 ContentTypeList.tsx whole pure ordering helper.
export function moveCollection(slugs: string[], activeSlug: string, overSlug: string): string[] {
  const from = slugs.indexOf(activeSlug), to = slugs.indexOf(overSlug);
  if (from === -1 || to === -1 || from === to) return slugs;
  const next = [...slugs]; next.splice(to, 0, next.splice(from, 1)[0]!); return next;
}
