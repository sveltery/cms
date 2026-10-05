// Native extraction of Calendar's prior Error/non-Error presentation boundary.
// Exact Source suppression guard is required by supplemental preparation tests.
import type { CalendarMessage } from './message-descriptors.ts';
import { translateCalendarMessage, type CalendarTranslate } from './messages.ts';

export type CalendarInlineError = string | { message: CalendarMessage };
export function calendarMutationError(error: unknown): CalendarInlineError | null {
  if (error instanceof Error) return error.message;
  return { message: 'An error occurred' };
}
export function calendarMutationErrorMessage(error: unknown, translate: CalendarTranslate = translateCalendarMessage): string | null {
  const message = calendarMutationError(error);
  return message === null ? null : typeof message === 'string' ? message : translate(message.message);
}
