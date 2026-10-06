import { jsx as _jsx } from "react/jsx-runtime";
import { ArrowRightIcon, CaretRightIcon } from "@phosphor-icons/react";
import { cn } from "../lib/utils";
/** Caret pointing in the "forward" direction — right in LTR, left in RTL. */
export function CaretNext({ className, ...props }) {
    return _jsx(CaretRightIcon, { className: cn("rtl:-scale-x-100", className), ...props });
}
/** Caret pointing in the "backward" direction — left in LTR, right in RTL. */
export function CaretPrev({ className, ...props }) {
    return _jsx(CaretRightIcon, { className: cn("rotate-180 rtl:rotate-0", className), ...props });
}
/** Arrow pointing in the "forward" direction — right in LTR, left in RTL. */
export function ArrowNext({ className, ...props }) {
    return _jsx(ArrowRightIcon, { className: cn("rtl:-scale-x-100", className), ...props });
}
/** Arrow pointing in the "backward" direction — left in LTR, right in RTL. */
export function ArrowPrev({ className, ...props }) {
    return _jsx(ArrowRightIcon, { className: cn("rotate-180 rtl:rotate-0", className), ...props });
}
