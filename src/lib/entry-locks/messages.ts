import { i18n } from '@lingui/core';
import { MESSAGE_IDS } from '../ui/locales/ids.ts';

/** Use the existing browser catalog owner; SSR does not change its locale. */
export function translateEntryLock(message: string): string {
  return i18n.locale ? i18n._({id: MESSAGE_IDS[message] ?? message, message}) : message;
}
