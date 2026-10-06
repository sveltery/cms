import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Combobox } from "@cloudflare/kumo";
import { useCallback, useEffect, useMemo, useState } from "react";
export function ComboboxElementComponent({ element, onAction, onChange, }) {
    const initialOption = useMemo(() => element.options.find((o) => o.value === element.initial_value) ?? null, [element.options, element.initial_value]);
    const [selected, setSelected] = useState(initialOption);
    useEffect(() => {
        setSelected(initialOption);
    }, [initialOption]);
    const handleChange = useCallback((newValue) => {
        const opt = newValue;
        setSelected(opt);
        const val = opt?.value ?? null;
        if (onChange) {
            onChange(element.action_id, val);
        }
        else {
            onAction({
                type: "block_action",
                action_id: element.action_id,
                value: val,
            });
        }
    }, [onChange, onAction, element.action_id]);
    return (_jsxs(Combobox, { label: element.label, items: element.options, value: selected, onValueChange: handleChange, children: [_jsx(Combobox.TriggerInput, { placeholder: element.placeholder ?? "Search..." }), _jsxs(Combobox.Content, { children: [_jsx(Combobox.List, { children: (item) => (_jsx(Combobox.Item, { value: item, children: item.label })) }), _jsx(Combobox.Empty, { children: "No results" })] })] }));
}
