// Exact context-free descriptors from pinned EmDash PublishingDateTimeEditor.
// MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
export const PUBLISHING_DATE_TIME_MESSAGES = {
  'Local time': { id: '9YjY73', message: 'Local time' },
  Time: { id: 'LhMjLm', message: 'Time' },
  Hour: { id: '6XgEPi', message: 'Hour' },
  Minute: { id: '6UYTy8', message: 'Minute' },
  Period: { id: 'NtQvjo', message: 'Period' },
  Timezone: { id: '40Gx0U', message: 'Timezone' },
} as const;

export type PublishingDateTimeMessage = keyof typeof PUBLISHING_DATE_TIME_MESSAGES;
// The caller owns locale/catalog reactivity. This shared field has no listener.
export type PublishingDateTimeTranslate = (message: PublishingDateTimeMessage) => string;
export const publishingDateTimeEnglish: PublishingDateTimeTranslate = message => message;
