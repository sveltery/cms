import { jsx as _jsx } from "react/jsx-runtime";
import { Meter } from "@cloudflare/kumo";
export function MeterBlockComponent({ block }) {
    return (_jsx(Meter, { label: block.label, value: block.value, max: block.max, min: block.min, customValue: block.custom_value }));
}
