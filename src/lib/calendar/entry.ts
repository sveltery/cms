// EmDash1.1.0 CalendarEntry.tsx:isPlainClick, pin913cb1bb; MIT.
export function isPlainClick(event: Pick<MouseEvent, 'defaultPrevented'|'button'|'metaKey'|'ctrlKey'|'shiftKey'|'altKey'>): boolean {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
export const stateLabels = { published: 'Published', scheduled: 'Scheduled', update: 'Update scheduled', overdue: 'Overdue' };
