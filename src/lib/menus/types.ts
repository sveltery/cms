export type * from './client.ts';
import type { createMenuClient } from './client.ts';
export type MenuClient = ReturnType<typeof createMenuClient>;
export interface ContentChoice { collection: string; id: string; title: string }
export interface ContentClient { collections(): Promise<{slug:string;label:string}[]>; entries(collection: string, locale?: string): Promise<ContentChoice[]> }
