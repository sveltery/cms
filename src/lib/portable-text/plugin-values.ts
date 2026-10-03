// Adapted from pinned EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// MIT Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
export interface PluginBlockDef {type:string;pluginId:string;label:string;description?:string;icon?:string;category?:string;fields?:Array<{action_id:string;initial_value?:unknown;[key:string]:unknown}>;}
type Element=NonNullable<PluginBlockDef['fields']>[number];
function getPluginBlockDefaultValues(fields?: Element[]): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};

	for (const field of fields ?? []) {
		const initialValue = "initial_value" in field ? field.initial_value : undefined;
		if (initialValue !== undefined) {
			defaults[field.action_id] = initialValue;
		}
	}

	return defaults;
}

export function buildPluginBlockFormValues(
	block: PluginBlockDef | null,
	initialValues?: Record<string, unknown>,
): Record<string, unknown> {
	const defaults = getPluginBlockDefaultValues(block?.fields);
	return initialValues ? { ...defaults, ...initialValues } : defaults;
}

export function hasPluginBlockFormData(values: Record<string, unknown>): boolean {
	return Object.values(values).some(
		(value) => value !== undefined && value !== null && value !== "",
	);
}

