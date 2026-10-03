import { z } from 'zod';
import { LOCALE_CODE_PATTERN } from './i18n-config.ts';
// Source common.ts localeCode only. No auth/role boundary is introduced here.
export const localeCode = z.string().regex(LOCALE_CODE_PATTERN, 'Invalid locale code');
export const localeFilterQuery = z.object({ locale: localeCode.optional() }).meta({ id: 'LocaleFilterQuery' });
