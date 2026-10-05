// Whole immutable Source resolveBylineFilter function; Native type/import transport only.
// EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import type {ContentBylineFilter} from '../database/lifecycle/upstream/database/repositories/types.ts';

function resolveBylineFilter(
	params: { bylines?: string[]; bylinesNone?: boolean; includeInferredBylines?: boolean },
	locale: string | undefined,
): ContentBylineFilter | undefined {
	const includeInferred = params.includeInferredBylines === true;

	if (params.bylinesNone) return { mode: "none", includeInferred, locale };

	const bylineIds = params.bylines ?? [];
	if (bylineIds.length === 0) return undefined;

	return { mode: "any", bylineIds, includeInferred, locale };
}

export {resolveBylineFilter};
