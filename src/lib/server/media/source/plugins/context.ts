// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete selected declarations 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/plugins/context.ts; blob ee05129cc8b217ec64f96e92a412947712fc3473.
import type {Kysely} from 'kysely';
import type {Database} from '../database/types.ts';
import {MediaRepository} from '../database/repositories/media.ts';
import {toPluginMediaItem} from './media.ts';
import type {MediaAccess,MediaItem,MediaListOptions,PaginatedResult} from './types.ts';
export function createMediaAccess(db: Kysely<Database>): MediaAccess {
	const mediaRepo = new MediaRepository(db);

	return {
		async get(id: string): Promise<MediaItem | null> {
			const item = await mediaRepo.findById(id);
			return item?.status === "ready" ? toPluginMediaItem(item) : null;
		},

		async list(options?: MediaListOptions): Promise<PaginatedResult<MediaItem>> {
			const result = await mediaRepo.findMany({
				limit: options?.limit ?? 50,
				cursor: options?.cursor,
				mimeType: options?.mimeType,
			});

			return {
				items: result.items.map(toPluginMediaItem),
				cursor: result.nextCursor,
				hasMore: !!result.nextCursor,
			};
		},
	};
}
