import { jsx as _jsx } from "react/jsx-runtime";
import { SensitiveInput } from "@cloudflare/kumo";
import { useCallback, useState } from "react";
export function SecretInputElementComponent({ element, onAction, onChange, }) {
    const [value, setValue] = useState("");
    const [editing, setEditing] = useState(!element.has_value);
    const handleValueChange = useCallback((v) => {
        setValue(v);
        if (onChange) {
            onChange(element.action_id, v);
        }
    }, [onChange, element.action_id]);
    const handleFocus = useCallback(() => {
        if (!editing) {
            setEditing(true);
            setValue("");
        }
    }, [editing]);
    const handleBlur = useCallback(() => {
        if (!onChange && value) {
            onAction({
                type: "block_action",
                action_id: element.action_id,
                value,
            });
        }
        if (!value && element.has_value) {
            setEditing(false);
        }
    }, [onChange, onAction, element.action_id, value, element.has_value]);
    if (!editing) {
        return (_jsx(SensitiveInput, { label: element.label, value: "••••••••", readOnly: true, onFocus: handleFocus, placeholder: element.placeholder }));
    }
    return (_jsx(SensitiveInput, { label: element.label, value: value, onValueChange: handleValueChange, onFocus: handleFocus, onBlur: handleBlur, placeholder: element.placeholder }));
}
