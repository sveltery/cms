import { z } from "astro/zod";
/**
 * Select field - single choice from predefined options
 */
export function select(selectOptions) {
    const enumSchema = z.enum(selectOptions.options);
    // Apply default first, then optional
    let schema;
    if (selectOptions.default !== undefined) {
        schema = enumSchema.default(selectOptions.default);
    }
    else if (!selectOptions.required) {
        // Only make it optional if no default is provided
        schema = enumSchema.optional();
    }
    else {
        schema = enumSchema;
    }
    const ui = {
        widget: "select",
        placeholder: selectOptions.placeholder,
        helpText: selectOptions.helpText,
        options: selectOptions.options,
    };
    return {
        type: "select",
        columnType: "TEXT",
        schema,
        options: selectOptions,
        ui,
    };
}
