// Native adapter for exact Calendar descriptors. EmDash pin913cb1bb; MIT.
import { i18n } from '@lingui/core';
import { CALENDAR_MESSAGE_DESCRIPTORS, type CalendarMessage } from './message-descriptors.ts';
import { CALENDAR_MESSAGE_FALLBACKS } from './message-fallbacks.ts';

export type CalendarValues = Record<string, unknown>;
export type CalendarTranslate = (message: CalendarMessage, values?: CalendarValues) => string;

// Explicit retained Native English SSR templates. These are not an ICU parser
// or locale producer; they keep the prior display when bootstrap has not run.
const number = (value: unknown) => new Intl.NumberFormat('en').format(Number(value));
const englishTemplates: Partial<Record<CalendarMessage, (values: CalendarValues) => string>> = {
  '{0, plural, one {# entry} other {# entries}}': v => `${number(v['0'])} ${Number(v['0']) === 1 ? 'entry' : 'entries'}`,
  '{dayLabel}, {entries}': v => `${v.dayLabel}, ${v.entries}`,
  '{earlierCount, plural, one {Show # earlier entry} other {Show # earlier entries}}': v => `Show ${number(v.earlierCount)} earlier ${Number(v.earlierCount) === 1 ? 'entry' : 'entries'}`,
  '{hidden, plural, one {# more entry on {date}} other {# more entries on {date}}}': v => `${number(v.hidden)} more ${Number(v.hidden) === 1 ? 'entry' : 'entries'} on ${v.date}`,
  '{hidden, plural, one {+# more} other {+# more}}': v => `+${number(v.hidden)} more`,
  '{lateness} late': v => `${v.lateness} late`,
  '{siteZone} · Your time: {viewerZone}': v => `${v.siteZone} · Your time: ${v.viewerZone}`,
  '{state} · {when}': v => `${v.state} · ${v.when}`,
  '{state}, {time}:': v => `${v.state}, ${v.time}:`,
  '{title} is a draft again.': v => `${v.title} is a draft again.`,
  '{title} is now live.': v => `${v.title} is now live.`,
  '{title} now goes live {when}.': v => `${v.title} now goes live ${v.when}.`,
  'Filter: {activeCount} selected': v => `Filter: ${v.activeCount} selected`,
  'Go live {countdown}': v => `Go live ${v.countdown}`,
  'Goes live {countdown}': v => `Goes live ${v.countdown}`,
  'Nothing published or scheduled in {monthTitle}': v => `Nothing published or scheduled in ${v.monthTitle}`,
  'Now · {time}': v => `Now · ${v.time}`,
  'Overdue · {lateness}': v => `Overdue · ${v.lateness}`,
  'Published {liveSince}': v => `Published ${v.liveSince}`,
  'The calendar shows the first {maxEntries}, which end on {cutOffDay}.': v => `The calendar shows the first ${v.maxEntries}, which end on ${v.cutOffDay}.`,
  'The calendar shows the first {maxEntries}.': v => `The calendar shows the first ${v.maxEntries}.`,
  'The scheduled changes to {title} stay as a draft.': v => `The scheduled changes to ${v.title} stay as a draft.`,
  "This entry was due {lateness} but hasn't published. Scheduled publishing may not be running.": v => `This entry was due ${v.lateness} but hasn't published. Scheduled publishing may not be running.`,
  'This range has more than {maxEntries} entries': v => `This range has more than ${v.maxEntries} entries`,
  'Times are in {zoneName}.': v => `Times are in ${v.zoneName}.`,
  'Times are in {zoneName}. Your browser uses {viewerZoneName}.': v => `Times are in ${v.zoneName}. Your browser uses ${v.viewerZoneName}.`,
  'Your time: {viewerTime}': v => `Your time: ${v.viewerTime}`,
};

export const translateCalendarMessage: CalendarTranslate = (message, values = {}) => {
  if (!i18n.locale) return englishTemplates[message]?.(values) ?? message;
  const descriptor = CALENDAR_MESSAGE_DESCRIPTORS[message];
  // Frozen core's runtime accepts compiled fallback arrays, while the public
  // MessageDescriptor type narrows message to string. Isolate that Native type
  // bridge here: loaded public translations still take precedence by exact ID.
  const fallback = CALENDAR_MESSAGE_FALLBACKS[message] as unknown as string;
  return i18n._({ id: descriptor.id, message: fallback, values });
};

export function createCalendarMessageAdapter(onChange: () => void) {
  return { translate: translateCalendarMessage, get locale() { return i18n.locale; }, subscribe() { return i18n.on('change', onChange); } };
}
