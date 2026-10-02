// Ported EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
export function serializeValue(value: unknown): unknown {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}
	if (typeof value === "object") {
		return JSON.stringify(value);
	}
	return value;
}

export function deserializeValue(value: unknown): unknown {
	if (typeof value === "string") {
		// Try to parse if it looks like JSON
		if (value.startsWith("{") || value.startsWith("[")) {
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		}
	}
	return value;
}
