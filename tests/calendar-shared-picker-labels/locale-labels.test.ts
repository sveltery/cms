// Native output controls against whole pinned EmDash getter / frozen 9.14 locale functions.
// EmDash MIT, Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { getDayPickerLocale as sourceLocale } from '../../parity/emdash/calendar-shared-picker-labels/source/packages/admin/src/locales/day-picker.ts';
import { getDayPickerLocale as nativeLocale } from '../../src/lib/ui/date-time-locales.ts';
import Fields from '../../src/lib/ui/PublishingDateTimeFields.svelte';
import { DateLib } from 'react-day-picker';

const locales = ['en', 'ar', 'eu', 'bn', 'ca', 'zh-CN', 'zh-TW', 'cs', 'da', 'nl', 'en-GB', 'fa', 'fr', 'ka', 'de', 'hi', 'hu', 'id', 'ja', 'nb', 'pl', 'pt-BR', 'sr-Latn', 'es-419', 'es-ES', 'sv', 'th', 'tr', 'uk'];
const day = new Date(2026, 9, 5, 12);
const props = { date: day, time: '09:05', dateAriaLabel: 'Publication date' };
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it.each(locales)('retains the complete Source locale label object for %s', locale => {
  expect((nativeLocale(locale) as ReturnType<typeof sourceLocale>).labels).toEqual(sourceLocale(locale).labels);
});
it.each(locales)('renders Source vendor labels for today and selected day in %s', locale => {
  vi.useFakeTimers(); vi.setSystemTime(day);
  const localeObject = sourceLocale(locale), options = { locale: localeObject };
  const labels = localeObject.labels!;
  const html = render(Fields, { props: { ...props, locale } }).body;
  const label = labels.labelDayButton as (date: Date, modifiers: Record<string, boolean>, options: { locale: ReturnType<typeof sourceLocale> }) => string;
  expect(html).toContain(`aria-label="${escape(label(day, { today: true, selected: true }, options))}"`);
  expect(html).toContain(`aria-label="${escape(String(labels.labelPrevious))}"`);
  expect(html).toContain(`aria-label="${escape(String(labels.labelNext))}"`);
  expect(html).toContain(`aria-label="${escape(String(labels.labelNav))}"`);
  const grid = labels.labelGrid as (date: Date, options: { locale: ReturnType<typeof sourceLocale> }) => string;
  expect(html).toContain(`role="grid" aria-label="${escape(grid(day, options))}"`);
  const weekday = labels.labelWeekday as (date: Date, options: { locale: ReturnType<typeof sourceLocale> }) => string;
  expect(html).toContain(`aria-label="${escape(weekday(day, options))}"`);
});
it.each(['ko', 'pseudo', 'not-a-supported-locale'])('preserves Source en-US fallback for %s', locale => {
  expect(nativeLocale(locale).code).toBe(sourceLocale(locale).code);
  expect(nativeLocale(locale).options).toEqual(sourceLocale(locale).options);
});
it.each(['en', 'eu', 'hu', 'ja', 'zh-CN', 'zh-TW'])('preserves Source vendor month/year ordering for %s', locale => {
  const expected = new DateLib({ locale: sourceLocale(locale) }).formatMonthYear(day);
  const html = render(Fields, { props: { ...props, locale } }).body;
  expect(html.match(/aria-live="polite"[^>]*>(.*?)<\/span>/)?.[1]).toBe(escape(expected));
});
it.each([[false, false], [false, true], [true, false], [true, true]])('preserves Source day-button today=%s selected=%s output', (today, selected) => {
  vi.useFakeTimers(); vi.setSystemTime(today ? day : new Date(2026, 9, 6, 12));
  const locale = sourceLocale('en'), label = locale.labels!.labelDayButton as (date: Date, modifiers: Record<string, boolean>, options: {locale: typeof locale}) => string;
  const html = render(Fields, { props: { ...props, date: selected ? day : undefined } }).body;
  expect(html).toContain(`aria-label="${escape(label(day, { today, selected }, { locale }))}"`);
});
it.each(['Time', 'Hour', 'Minute', 'Period', 'Timezone', 'Local time'])('uses caller-owned translated Source %s label', message => {
  if (message === 'Local time') {
    const actual = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function () {
      return { ...actual.call(this), timeZone: '' };
    });
  }
  const translate = (value: string) => `CONTROLLED ${value}`;
  const translatedProps = { ...props, translate };
  const html = render(Fields, { props: translatedProps }).body;
  expect(html).toContain(`CONTROLLED ${message}`);
});
it('preserves English field labels for callers that provide no translator', () => {
  const html = render(Fields, { props }).body;
  expect(html).toContain('>Time</legend>');
  expect(html).toContain('aria-label="Hour"');
  expect(html).toContain('aria-label="Minute"');
  expect(html).toContain('aria-label="Period"');
  expect(html).toContain('>Timezone:</span>');
});
