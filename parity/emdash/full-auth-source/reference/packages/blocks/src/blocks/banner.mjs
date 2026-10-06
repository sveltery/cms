import { jsx as _jsx } from "react/jsx-runtime";
import { Banner } from "@cloudflare/kumo";
import { Info, Warning, WarningCircle } from "@phosphor-icons/react";
import { useMemo } from "react";
function useVariantIcon(variant) {
    return useMemo(() => {
        switch (variant) {
            case "alert":
                return _jsx(Warning, { weight: "fill", size: 20 });
            case "error":
                return _jsx(WarningCircle, { weight: "fill", size: 20 });
            default:
                return _jsx(Info, { weight: "fill", size: 20 });
        }
    }, [variant]);
}
export function BannerBlockComponent({ block }) {
    const variant = block.variant ?? "default";
    const icon = useVariantIcon(variant);
    return (_jsx(Banner, { variant: variant, icon: icon, title: block.title, description: block.description }));
}
