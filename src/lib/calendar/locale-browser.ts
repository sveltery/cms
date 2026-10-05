// Extracted existing Native browser bootstrap; SSR never calls this function.
// One existing Lingui singleton owns all catalogs/current locale.
import { i18n } from '@lingui/core';
import { loadMessages } from '../ui/locales/loadMessages.ts';
import { getLocaleDir } from '../ui/locales/config.ts';

export async function bootstrapCalendarLocale(locale = 'en'): Promise<void> {
  const current = i18n.locale || locale;
  // Establish the display locale before any browser client request. The exact
  // qualified catalog replaces this temporary fallback through the same owner.
  if (!i18n.locale) i18n.loadAndActivate({ locale: current, messages: {} });
  const messages = await loadMessages(current);
  i18n.loadAndActivate({ locale: current, messages });
}

export function syncCalendarDocumentLocale(element: Pick<HTMLElement, 'setAttribute'>, locale: string): void {
  if (!locale) return;
  element.setAttribute('lang', locale);
  element.setAttribute('dir', getLocaleDir(locale));
}
