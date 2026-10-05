// Source DialogError.tsx:getMutationError, EmDash1.1.0 pin913cb1bb; MIT.
// Native descriptor data preserves the complete guard/message branches without
// resolving translated inline errors before the reactive render. No Source test credit.
import type { CalendarMessage } from './message-descriptors.ts';
import { translateCalendarMessage, type CalendarTranslate } from './messages.ts';

export type CalendarInlineError = string | { message: CalendarMessage };
export function calendarMutationError(error: unknown): CalendarInlineError | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return { message: 'An error occurred' };
}
export function calendarMutationErrorMessage(error: unknown, translate: CalendarTranslate = translateCalendarMessage): string | null {
  const message = calendarMutationError(error);
  return message === null ? null : typeof message === 'string' ? message : translate(message.message);
}
