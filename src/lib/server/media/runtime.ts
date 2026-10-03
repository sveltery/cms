// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Three complete runtime methods from 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/emdash-runtime.ts; blob 055ed1307ba4029e120cad989bc9b0e8c2d72afe.
import type {Kysely} from 'kysely';
import type {Database} from './source/database/types.ts';
import type {Storage} from './source/storage/types.ts';
import {handleMediaList,handleMediaGet,handleMediaCreate,handleMediaUpdate,handleMediaReplaceMetadata,handleMediaDelete} from './source/api/handlers/media.ts';
import {invalidateMediaCache as invalidateSiteSettingsCache} from './cache.ts';

/** Native composition; plugin upload hooks and actual ME3 usage remain separately incomplete. */
export class NativeMediaRuntime {
 readonly db:Kysely<Database>;readonly storage:Storage|undefined;readonly config:{maxUploadSize?:number};
 constructor(db:Kysely<Database>,storage?:Storage,config:{maxUploadSize?:number}={}){this.db=db;this.storage=storage;this.config=config;}
 handleMediaList(input:Parameters<typeof handleMediaList>[1]){return handleMediaList(this.db,input);}
 handleMediaGet(id:string){return handleMediaGet(this.db,id);}
 handleMediaCreate(input:Parameters<typeof handleMediaCreate>[1]){return handleMediaCreate(this.db,input);}
 async handleMediaUpdate(
		id: string,
		input: {
			alt?: string;
			caption?: string;
			width?: number;
			height?: number;
			folderId?: string | null;
			focalX?: number | null;
			focalY?: number | null;
		},
	) {
		const result = await handleMediaUpdate(this.db, id, input);
		// Resolved media references in site settings (`logo`, `favicon`,
		// `seo.defaultOgImage`) bake in the media row's `contentType`,
		// `width`, and `height`. A metadata edit invalidates that snapshot
		// for every entry point: REST routes, MCP tools, plugin code, and
		// any future caller of `handleMediaUpdate`. Cross-isolate staleness
		// remains bounded by isolate lifetime.
		if (result.success) {
			invalidateSiteSettingsCache();
		}
		return result;
	}
 async handleMediaReplaceMetadata(
		id: string,
		expectedStorageKey: string,
		input: { size: number; width: number; height: number; contentHash: string },
	) {
		const result = await handleMediaReplaceMetadata(this.db, id, expectedStorageKey, input);
		if (result.success) {
			invalidateSiteSettingsCache();
		}
		return result;
	}
 async handleMediaDelete(id: string) {
		const result = await handleMediaDelete(this.db, id, this.storage);
		// Same reasoning as `handleMediaUpdate`: if the deleted media row
		// was referenced by a setting, the cached resolved URL now points
		// at a 404. Invalidation is unconditional on success — cheaper than
		// querying which settings reference the id.
		if (result.success) {
			invalidateSiteSettingsCache();
		}
		return result;
	}
}
