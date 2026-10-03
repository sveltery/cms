// Ported complete EmDash 1.1.0 module at 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
export interface BlockValue {
	_type: string;
	_version: number;
	_key: string;
}

export interface BlockComponentProps<T extends BlockValue = BlockValue> {
	value: T;
	index: number;
	blockKey: string;
}

export type BlockComponent<T extends BlockValue = BlockValue> = (
	props: BlockComponentProps<T>,
) => unknown;

export type BlockComponents<T extends BlockValue> = {
	[Type in T["_type"]]: BlockComponent<Extract<T, { _type: Type }>>;
};

export function defineBlockComponents<T extends BlockValue>(
	components: BlockComponents<T>,
): BlockComponents<T> {
	return components;
}

export type BlockRendererResolution<T extends BlockValue> =
	| { kind: "component"; component: BlockComponent<T> }
	| { kind: "diagnostic" }
	| { kind: "fallback"; component: BlockComponent<T> }
	| { kind: "none" };

export function resolveBlockRenderer<T extends BlockValue>(
	block: T,
	components: Partial<BlockComponents<T>>,
	fallback: BlockComponent<T> | undefined,
	development: boolean,
): BlockRendererResolution<T> {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the mapped component key and block discriminant come from the same T union
	const component = components[block._type as T["_type"]] as BlockComponent<T> | undefined;
	if (component) return { kind: "component", component };
	if (development) return { kind: "diagnostic" };
	return fallback ? { kind: "fallback", component: fallback } : { kind: "none" };
}
