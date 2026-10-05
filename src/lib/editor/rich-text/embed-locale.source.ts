// Immutable EmDash locales/config.ts exact enabled-locale direction lookup.
// Only enabled ar/fa use RTL; unknown tags (including ar-EG) default to LTR.
// The caller supplies the same existing authoring provider's interface locale.
export function embedLocaleDirection(locale: string): 'ltr' | 'rtl' {
  return locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr';
}
