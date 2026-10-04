// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e, MIT; see notices/emdash-MIT.txt.
// Source keys are internal UI identities and are stripped exactly as pinned.


interface RepeaterSubFieldDef {
	slug: string;
	type: string;
	label: string;
	required?: boolean;
	options?: string[];
}

type RepeaterItem = Record<string, unknown> & { _key: string };

function ensureKeys(items: unknown[]): RepeaterItem[] {
	return items.map((item, i) => {
		const obj = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
		return { ...obj, _key: (obj._key as string) || `item-${i}-${Date.now()}` };
	});
}

function stripKeys(items: RepeaterItem[]): Record<string, unknown>[] {
	return items.map(({ _key, ...rest }) => rest);
}

export { ensureKeys, stripKeys };
export type { RepeaterSubFieldDef, RepeaterItem };
