// EmDash1.1.0 compact Calendar local-date mapping, pin913cb1bb; MIT Cloudflare2026.
// Keyboard map follows Kumo2.6.0's bundled DayPicker9.13.2 (MIT), statically
// cross-checked against external DayPicker9.14.0. See notices/calendar-picker/.
import { addDays, addMonths, addWeeks, addYears, startOfWeek, endOfWeek } from 'date-fns';
import { getDayPickerLocale } from '../ui/date-time-locales.ts';

export type CalendarPickerDirection = 'ltr' | 'rtl';
export type CalendarPickerKey = Readonly<{ key: string; shiftKey?: boolean }>;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Source CalendarMonth uses local noon to keep day keys stable across DST. */
function dayKeyToLocalDate(day: string): Date {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
}

function localDateToDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Focus movement does not select a date; Enter/Space retain native activation. */
export function moveCalendarFocus(
  day: string,
  keyboard: CalendarPickerKey,
  locale: string,
  direction: CalendarPickerDirection = 'ltr',
): string | undefined {
  const reference = dayKeyToLocalDate(day);
  const before = direction === 'rtl' ? 1 : -1;
  const after = -before;
  const options = { locale: getDayPickerLocale(locale) };
  let next: Date;
  switch (keyboard.key) {
    case 'ArrowLeft': next = keyboard.shiftKey ? addMonths(reference, before) : addDays(reference, before); break;
    case 'ArrowRight': next = keyboard.shiftKey ? addMonths(reference, after) : addDays(reference, after); break;
    case 'ArrowUp': next = keyboard.shiftKey ? addYears(reference, -1) : addWeeks(reference, -1); break;
    case 'ArrowDown': next = keyboard.shiftKey ? addYears(reference, 1) : addWeeks(reference, 1); break;
    case 'PageUp': next = keyboard.shiftKey ? addYears(reference, -1) : addMonths(reference, -1); break;
    case 'PageDown': next = keyboard.shiftKey ? addYears(reference, 1) : addMonths(reference, 1); break;
    case 'Home': next = startOfWeek(reference, options); break;
    case 'End': next = endOfWeek(reference, options); break;
    default: return;
  }
  return localDateToDayKey(next);
}
