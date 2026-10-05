// EmDash1.1.0 calendar UI contracts, pin913cb1bb; MIT notices/emdash-MIT.txt.
import type { CalendarDisplay, CalendarItem } from './calendar.ts';
import type { QueryClient } from '@tanstack/react-query';
export type CalendarSelectHandler = (item: CalendarItem, element: HTMLElement) => void;
export interface CalendarNotice { title:string;description:string;type?:'error' }
export interface CalendarUser { id: string; email: string; role: number }
export interface CalendarContent {
  id: string; type: string; locale: string; authorId?: string | null; _rev?: string;
  slug?: string | null; updatedAt: string; publishedAt?: string | null; translationGroup?: string | null;
  bylines?: { byline: { displayName: string }; sortOrder: number; roleLabel: string | null }[];
}
export interface CalendarClient {
  fetchContent(collection: string, id: string, options?: { locale?: string }): Promise<CalendarContent>;
  publishContent(collection: string, id: string, options: { locale: string; _rev?: string }): Promise<unknown>;
  scheduleContent(collection: string, id: string, at: string, options: { locale: string }): Promise<unknown>;
  unscheduleContent(collection: string, id: string, options: { locale: string }): Promise<unknown>;
  fetchTranslations?(collection:string,id:string):Promise<{translationGroup:string|null;translations:{id:string;locale:string;status:string}[]}>;
  getPreviewUrl?(collection:string,id:string):Promise<{url:string}|null>;
}
export interface EntryProps { item: CalendarItem; display: CalendarDisplay; now: number; selected?: boolean; onSelect?: CalendarSelectHandler; chip?: boolean }
export interface DayListProps { items: readonly CalendarItem[]; display: CalendarDisplay; now: number; label: string; nowAt?: number; selectedKey?: string; onSelect?: CalendarSelectHandler }
export interface CalendarManifest {
  timezone?: string; collections: Record<string, { label: string; hidden?: boolean; icon?: string; urlPattern?: string }>;
  i18n?: { locales: string[]; defaultLocale: string; prefixDefaultLocale?:boolean };
}
export type CalendarQueryClient = QueryClient;
