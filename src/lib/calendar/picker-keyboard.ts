import { shiftDay } from './calendar.ts';

export type CalendarPickerDirection = 'ltr' | 'rtl';
export type CalendarPickerKey = Readonly<{ key: string; shiftKey?: boolean }>;

/** The compact Calendar's current movement calculation, extracted before repair. */
export function moveCalendarFocus(
  day: string,
  keyboard: CalendarPickerKey,
  _locale: string,
  _direction: CalendarPickerDirection = 'ltr',
): string | undefined {
  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
  if (!(keyboard.key in step)) return;
  return shiftDay(day, step[keyboard.key]!);
}
