// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc. See notices/emdash-MIT.txt.
// Native module boundary: Source React providers and email composition are not imported.
export { loadMessages } from './loadMessages.js';
export {
  SUPPORTED_LOCALES,
  SUPPORTED_LOCALE_CODES,
  DEFAULT_LOCALE,
  getLocaleLabel,
  getLocaleDir,
  matchLocale,
  resolveLocale,
} from './config.js';
export type { SupportedLocale } from './config.js';
export { LOCALES, SOURCE_LOCALE, LOCALE_CODES, TARGET_LOCALES, ENABLED_LOCALES } from './locales.js';
export type { LocaleDefinition } from './locales.js';
export { MESSAGE_IDS, MESSAGE_IDS_BY_CONTEXT } from './ids.js';
