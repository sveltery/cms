import { jsx as _jsx } from "react/jsx-runtime";
import { AccordionBlockComponent } from "./blocks/accordion.js";
import { ActionsBlockComponent } from "./blocks/actions.js";
import { BannerBlockComponent } from "./blocks/banner.js";
import { ChartBlockComponent } from "./blocks/chart.js";
import { CodeBlockComponent } from "./blocks/code.js";
import { ColumnsBlockComponent } from "./blocks/columns.js";
import { ContextBlockComponent } from "./blocks/context.js";
import { DividerBlockComponent } from "./blocks/divider.js";
import { EmptyBlockComponent } from "./blocks/empty.js";
import { FieldsBlockComponent } from "./blocks/fields.js";
import { FormBlockComponent } from "./blocks/form.js";
import { HeaderBlockComponent } from "./blocks/header.js";
import { ImageBlockComponent } from "./blocks/image.js";
import { MeterBlockComponent } from "./blocks/meter.js";
import { SectionBlockComponent } from "./blocks/section.js";
import { StatsBlockComponent } from "./blocks/stats.js";
import { TabBlockComponent } from "./blocks/tab.js";
import { TableBlockComponent } from "./blocks/table.js";
function renderBlock(block, onAction, resolveLinkTarget) {
    switch (block.type) {
        case "header":
            return _jsx(HeaderBlockComponent, { block: block });
        case "section":
            return (_jsx(SectionBlockComponent, { block: block, onAction: onAction, resolveLinkTarget: resolveLinkTarget }));
        case "divider":
            return _jsx(DividerBlockComponent, {});
        case "fields":
            return _jsx(FieldsBlockComponent, { block: block });
        case "table":
            return (_jsx(TableBlockComponent, { block: block, onAction: onAction, resolveLinkTarget: resolveLinkTarget }));
        case "actions":
            return (_jsx(ActionsBlockComponent, { block: block, onAction: onAction, resolveLinkTarget: resolveLinkTarget }));
        case "stats":
            return _jsx(StatsBlockComponent, { block: block });
        case "form":
            return _jsx(FormBlockComponent, { block: block, onAction: onAction });
        case "image":
            return _jsx(ImageBlockComponent, { block: block });
        case "context":
            return _jsx(ContextBlockComponent, { block: block });
        case "columns":
            return (_jsx(ColumnsBlockComponent, { block: block, onAction: onAction, resolveLinkTarget: resolveLinkTarget }));
        case "chart":
            return _jsx(ChartBlockComponent, { block: block });
        case "meter":
            return _jsx(MeterBlockComponent, { block: block });
        case "banner":
            return _jsx(BannerBlockComponent, { block: block });
        case "code":
            return _jsx(CodeBlockComponent, { block: block });
        case "tab":
            return (_jsx(TabBlockComponent, { block: block, onAction: onAction, resolveLinkTarget: resolveLinkTarget }));
        case "empty":
            return (_jsx(EmptyBlockComponent, { block: block, onAction: onAction, resolveLinkTarget: resolveLinkTarget }));
        case "accordion":
            return (_jsx(AccordionBlockComponent, { block: block, onAction: onAction, resolveLinkTarget: resolveLinkTarget }));
        default: {
            const _exhaustive = block;
            return null;
        }
    }
}
export function BlockRenderer({ blocks, onAction, resolveLinkTarget }) {
    return (_jsx("div", { className: "flex flex-col gap-4", children: blocks.map((block, i) => (_jsx("div", { children: renderBlock(block, onAction, resolveLinkTarget) }, block.block_id ?? i))) }));
}
