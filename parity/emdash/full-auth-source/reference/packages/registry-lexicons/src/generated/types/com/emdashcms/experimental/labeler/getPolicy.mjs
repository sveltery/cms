import * as v from "@atcute/lexicons/validations";
import * as ComEmdashcmsExperimentalLabelerDefs from "./defs.js";
const _mainSchema = /*#__PURE__*/ v.query("com.emdashcms.experimental.labeler.getPolicy", {
    params: null,
    output: {
        type: "lex",
        get schema() {
            return ComEmdashcmsExperimentalLabelerDefs.labelerPolicySchema;
        },
    },
});
export const mainSchema = _mainSchema;
