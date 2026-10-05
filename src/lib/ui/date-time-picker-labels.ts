// Native label normalization follows frozen Kumo's internal DayPicker getLabels.
// DayPicker MIT: notices/calendar-picker/react-day-picker-9.14.0-MIT.txt.
import { labelDayButton, labelGrid, labelNav, labelNext, labelPrevious, labelWeekday } from 'react-day-picker';
import type { DayPickerLocale } from 'react-day-picker/locale';

function resolveLabel<Args extends unknown[]>(fallback: (...args: Args) => string,
  localized: string | ((...args: Args) => string) | undefined): (...args: Args) => string {
  if (localized) return typeof localized === 'function' ? localized : () => localized;
  return fallback;
}

export function getPublishingDatePickerLabels(locale: DayPickerLocale) {
  return {
    labelDayButton: resolveLabel(labelDayButton, locale.labels?.labelDayButton),
    labelGrid: resolveLabel(labelGrid, locale.labels?.labelGrid),
    labelNav: resolveLabel(labelNav, locale.labels?.labelNav),
    labelNext: resolveLabel(labelNext, locale.labels?.labelNext),
    labelPrevious: resolveLabel(labelPrevious, locale.labels?.labelPrevious),
    labelWeekday: resolveLabel(labelWeekday, locale.labels?.labelWeekday),
  };
}
