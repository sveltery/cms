import * as v from "@atcute/lexicons/validations";
import * as ComEmdashcmsExperimentalLabelerDefs from "./defs.js";
const _mainSchema = /*#__PURE__*/ v.query("com.emdashcms.experimental.labeler.getCurrentAssessment", {
    params: /*#__PURE__*/ v.object({
        cid: /*#__PURE__*/ v.cidString(),
        kind: /*#__PURE__*/ v.string(),
        uri: /*#__PURE__*/ v.resourceUriString(),
    }),
    output: {
        type: "lex",
        get schema() {
            return ComEmdashcmsExperimentalLabelerDefs.currentAssessmentViewSchema;
        },
    },
});
export const mainSchema = _mainSchema;
