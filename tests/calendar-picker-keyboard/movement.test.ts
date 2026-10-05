// Supplemental Native date-value controls for EmDash's compact Calendar picker.
// Source pin 913cb1bb / Kumo2.6.0's bundled DayPicker9.13.2 behavior,
// statically cross-checked against the frozen external react-day-picker9.14.0.
// These are not copied Source callbacks and establish no browser/auth/storage credit.
import { describe, expect, it } from 'vitest';
import { calendarFocusTarget, moveCalendarFocus, type CalendarPickerDirection } from '../../src/lib/calendar/picker-keyboard.ts';

type Movement = readonly [string, string, string, boolean, string, CalendarPickerDirection, string];
const movements: readonly Movement[] = [
  ['next day', '2030-10-15', 'ArrowRight', false, 'en', 'ltr', '2030-10-16'],
  ['previous day', '2030-10-15', 'ArrowLeft', false, 'en', 'ltr', '2030-10-14'],
  ['next week', '2030-10-15', 'ArrowDown', false, 'en', 'ltr', '2030-10-22'],
  ['previous week', '2030-10-15', 'ArrowUp', false, 'en', 'ltr', '2030-10-08'],
  ['shift next month', '2030-10-15', 'ArrowRight', true, 'en', 'ltr', '2030-11-15'],
  ['shift previous month', '2030-10-15', 'ArrowLeft', true, 'en', 'ltr', '2030-09-15'],
  ['shift next year', '2030-10-15', 'ArrowDown', true, 'en', 'ltr', '2031-10-15'],
  ['shift previous year', '2030-10-15', 'ArrowUp', true, 'en', 'ltr', '2029-10-15'],
  ['page previous month', '2030-10-15', 'PageUp', false, 'en', 'ltr', '2030-09-15'],
  ['page next month', '2030-10-15', 'PageDown', false, 'en', 'ltr', '2030-11-15'],
  ['shift page previous year', '2030-10-15', 'PageUp', true, 'en', 'ltr', '2029-10-15'],
  ['shift page next year', '2030-10-15', 'PageDown', true, 'en', 'ltr', '2031-10-15'],
  ['US week begins Sunday', '2030-10-16', 'Home', false, 'en', 'ltr', '2030-10-13'],
  ['US week ends Saturday', '2030-10-16', 'End', false, 'en', 'ltr', '2030-10-19'],
  ['GB week begins Monday', '2030-10-16', 'Home', false, 'en-GB', 'ltr', '2030-10-14'],
  ['GB week ends Sunday', '2030-10-16', 'End', false, 'en-GB', 'ltr', '2030-10-20'],
  ['Sunday belongs to preceding GB week', '2030-10-13', 'Home', false, 'en-GB', 'ltr', '2030-10-07'],
  ['Shift leaves week boundary unchanged', '2030-10-16', 'End', true, 'en-GB', 'ltr', '2030-10-20'],
  ['Persian week begins Saturday', '2030-10-16', 'Home', false, 'fa', 'rtl', '2030-10-12'],
  ['Persian week ends Friday', '2030-10-16', 'End', false, 'fa', 'rtl', '2030-10-18'],
  ['RTL right goes to previous day', '2030-10-15', 'ArrowRight', false, 'ar', 'rtl', '2030-10-14'],
  ['RTL left goes to next day', '2030-10-15', 'ArrowLeft', false, 'ar', 'rtl', '2030-10-16'],
  ['RTL shift right goes to previous month', '2030-10-15', 'ArrowRight', true, 'ar', 'rtl', '2030-09-15'],
  ['RTL shift left goes to next month', '2030-10-15', 'ArrowLeft', true, 'ar', 'rtl', '2030-11-15'],
  ['RTL page direction is unchanged', '2030-10-15', 'PageDown', false, 'ar', 'rtl', '2030-11-15'],
  ['next month clamps Jan31 to nonleap Feb28', '2031-01-31', 'PageDown', false, 'en', 'ltr', '2031-02-28'],
  ['next month clamps Jan31 to leap Feb29', '2032-01-31', 'ArrowRight', true, 'en', 'ltr', '2032-02-29'],
  ['previous month clamps May31 to Apr30', '2030-05-31', 'ArrowLeft', true, 'en', 'ltr', '2030-04-30'],
  ['next month crosses year boundary', '2030-12-31', 'ArrowRight', true, 'en', 'ltr', '2031-01-31'],
  ['next year clamps leap day', '2032-02-29', 'ArrowDown', true, 'en', 'ltr', '2033-02-28'],
  ['previous year clamps leap day', '2032-02-29', 'PageUp', true, 'en', 'ltr', '2031-02-28'],
  ['next day enters New York spring DST date', '2030-03-09', 'ArrowRight', false, 'en', 'ltr', '2030-03-10'],
  ['next day leaves New York spring DST date', '2030-03-10', 'ArrowRight', false, 'en', 'ltr', '2030-03-11'],
  ['next day enters New York autumn DST date', '2030-11-02', 'ArrowRight', false, 'en', 'ltr', '2030-11-03'],
  ['next day leaves New York autumn DST date', '2030-11-03', 'ArrowRight', false, 'en', 'ltr', '2030-11-04'],
];

describe('Native compact Calendar date movement', () => {
  it.each(movements)('%s', (_label, day, key, shiftKey, locale, direction, expected) => {
    expect(moveCalendarFocus(day, { key, shiftKey }, locale, direction)).toBe(expected);
  });
  it.each(['Enter', ' ', 'Tab', 'Escape', 'a'])('leaves %s to native button/default handling', key => {
    expect(moveCalendarFocus('2030-10-15', { key }, 'en')).toBeUndefined();
  });
  it('restores an available last-focused day after leaving and returning to its month', () => {
    // Active-over-last priority is an unaccepted Native adaptation. The Source
    // applies internal active focus after its custom-modifier tab-target pass.
    expect(calendarFocusTarget('2030-10', '2030-10-17', '2030-10-16', '2030-10-15')).toBe('2030-10-17');
    expect(calendarFocusTarget('2030-11', undefined, '2030-10-16', '2030-11-01')).toBe('2030-11-01');
    expect(calendarFocusTarget('2030-10', undefined, '2030-10-16', '2030-10-15')).toBe('2030-10-16');
  });
});
