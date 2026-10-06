import { isModerationFindingCategory } from "./policy.js";
import { record, runtimeSchema, stringArray, stringValue } from "./schema.js";
function parseFinding(value) {
    const finding = record(value, "finding", [
        "category",
        "recommendation",
        "confidence",
        "summary",
        "evidenceRefs",
    ]);
    const category = finding["category"];
    if (!isModerationFindingCategory(category)) {
        throw new TypeError("finding.category is not recognized");
    }
    if (finding["recommendation"] !== "none" && finding["recommendation"] !== "review") {
        throw new TypeError("finding.recommendation must be none or review");
    }
    if (typeof finding["confidence"] !== "number" ||
        !Number.isFinite(finding["confidence"]) ||
        finding["confidence"] < 0 ||
        finding["confidence"] > 1) {
        throw new TypeError("finding.confidence must be between zero and one");
    }
    return {
        category,
        recommendation: finding["recommendation"],
        confidence: finding["confidence"],
        summary: stringValue(finding["summary"], "finding.summary", 500),
        evidenceRefs: stringArray(finding["evidenceRefs"], "finding.evidenceRefs", 32),
    };
}
export const NormalizedModerationFindingSchema = runtimeSchema(parseFinding);
