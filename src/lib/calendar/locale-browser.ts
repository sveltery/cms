// Extracted existing Native browser bootstrap; SSR never calls this function.
// One existing Lingui singleton owns all catalogs/current locale.
import { i18n } from '@lingui/core';

export async function bootstrapCalendarLocale(_locale = 'en'): Promise<void> {
  if (!i18n.locale) i18n.loadAndActivate({ locale: 'en', messages: {} });
}
