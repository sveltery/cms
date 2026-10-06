import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
export function DateInputElementComponent({ element, onAction, onChange, }) {
    const [value, setValue] = useState(element.initial_value ?? "");
    useEffect(() => {
        setValue(element.initial_value ?? "");
    }, [element.initial_value]);
    const handleChange = useCallback((e) => {
        const newValue = e.target.value;
        setValue(newValue);
        if (onChange) {
            onChange(element.action_id, newValue);
        }
    }, [onChange, element.action_id]);
    const handleBlur = useCallback((e) => {
        if (!onChange) {
            onAction({
                type: "block_action",
                action_id: element.action_id,
                value: e.target.value,
            });
        }
    }, [onChange, onAction, element.action_id]);
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-sm font-medium text-kumo-text", children: element.label }), _jsx("input", { type: "date", value: value, onChange: handleChange, onBlur: handleBlur, placeholder: element.placeholder, className: "h-9 rounded-lg border border-kumo-line bg-kumo-bg px-3 text-sm text-kumo-text outline-none focus:ring-2 focus:ring-kumo-ring" })] }));
}
