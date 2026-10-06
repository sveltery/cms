import { jsx as _jsx } from "react/jsx-runtime";
import { Input } from "@cloudflare/kumo";
import { useCallback } from "react";
export function NumberInputElementComponent({ element, onAction, onChange, }) {
    const handleChange = useCallback((e) => {
        const val = e.target.value === "" ? undefined : Number(e.target.value);
        if (onChange) {
            onChange(element.action_id, val);
        }
    }, [onChange, element.action_id]);
    const handleBlur = useCallback((e) => {
        if (!onChange) {
            const val = e.target.value === "" ? undefined : Number(e.target.value);
            onAction({
                type: "block_action",
                action_id: element.action_id,
                value: val,
            });
        }
    }, [onChange, onAction, element.action_id]);
    return (_jsx(Input, { label: element.label, type: "number", min: element.min, max: element.max, defaultValue: element.initial_value, onChange: handleChange, onBlur: handleBlur }));
}
