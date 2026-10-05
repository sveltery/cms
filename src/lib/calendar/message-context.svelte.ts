// Native Svelte context for Source Lingui descriptors. EmDash pin913cb1bb; MIT.
// One production CalendarPage owns this subscription; isolated components use
// the same existing singleton without creating another subscription or owner.
import { getContext, onMount, setContext } from 'svelte';
import { createCalendarMessageAdapter, translateCalendarMessage, type CalendarTranslate } from './messages.ts';
import { syncCalendarDocumentLocale } from './locale-browser.ts';

const calendarMessages = Symbol('calendar-messages');

export function useCalendarMessages(): CalendarTranslate {
  return getContext<CalendarTranslate | undefined>(calendarMessages) ?? translateCalendarMessage;
}

export function provideCalendarMessages() {
  let revision = $state(0);
  function changed() {
    revision++;
    if (typeof document !== 'undefined') syncCalendarDocumentLocale(document.documentElement, adapter.locale);
  }
  const adapter = createCalendarMessageAdapter(changed);
  const translate: CalendarTranslate = (message, values) => {
    revision;
    return adapter.translate(message, values);
  };
  setContext(calendarMessages, translate);
  onMount(() => {
    const unsubscribe = adapter.subscribe();
    // Also reconcile catalog changes between server rendering and mounting.
    changed();
    return unsubscribe;
  });
  return { translate, get locale() { revision; return adapter.locale; } };
}
