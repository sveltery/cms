import { i18n } from '@lingui/core';
import { MESSAGE_IDS } from '../ui/locales/ids.ts';

/** Use the existing browser catalog owner; SSR does not change its locale. */
export function translateEntryLock(message: string): string {
  return i18n.locale ? i18n._({id: MESSAGE_IDS[message] ?? message, message}) : message;
}

export type EntryLockRichPart=string|{holder:true};
/** Retain Source rich-message IDs and place the account name through a text node. */
export function translateEntryLockRich(message:string):EntryLockRichPart[] {
  const marker='\uE000entry-lock-holder\uE001';
  const text=i18n.locale?i18n._({id:MESSAGE_IDS[message]??message,message,values:{name:marker}}):message.replace('{name}',marker);
  return text.split('<0>'+marker+'</0>').flatMap((part,index)=>index===0?[part]:[{holder:true} as const,part]);
}
