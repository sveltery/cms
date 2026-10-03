// Adapted from pinned EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// MIT Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
import { z } from 'zod';
interface PortableTextBlock {_type:string;_key:string;[key:string]:unknown;}
interface FieldDefinition<T> {type:string;columnType:string;schema:z.ZodType<T>;options?:unknown;ui?:{widget:string};}
/**
 * Portable Text block schema
 */
const portableTextBlockSchema: z.ZodType<PortableTextBlock> = z
	.object({
		_type: z.string(),
		_key: z.string(),
	})
	.loose();

/**
 * Portable Text field
 * Stores structured content in Portable Text format
 */
export function portableText(options?: {
	required?: boolean;
}): FieldDefinition<PortableTextBlock[] | undefined> {
	const schema = z.array(portableTextBlockSchema);

	return {
		type: "portableText",
		columnType: "JSON",
		schema: options?.required === false ? schema.optional() : schema,
		options,
		ui: {
			widget: "portableText",
		},
	};
}
