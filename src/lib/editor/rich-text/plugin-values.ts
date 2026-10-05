// Ported from EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/admin/src/components/PortableTextEditor.tsx; MIT, see notices/emdash-MIT.txt.

import type { PluginBlockDef, BlockField } from './types';
type Element = BlockField;


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

function buildPluginBlockFormValues(
	block: PluginBlockDef | null,
	initialValues?: Record<string, unknown>,
): Record<string, unknown> {
	const defaults = getPluginBlockDefaultValues(block?.fields);
	return initialValues ? { ...defaults, ...initialValues } : defaults;
}

function hasPluginBlockFormData(values: Record<string, unknown>): boolean {
	return Object.values(values).some(
		(value) => value !== undefined && value !== null && value !== "",
	);
}

export { buildPluginBlockFormValues, hasPluginBlockFormData, buildPluginBlockFormValues as _buildPluginBlockFormValues, hasPluginBlockFormData as _hasPluginBlockFormData };
