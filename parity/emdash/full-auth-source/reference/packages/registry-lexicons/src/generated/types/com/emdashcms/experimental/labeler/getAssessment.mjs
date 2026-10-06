import * as v from "@atcute/lexicons/validations";
import * as ComEmdashcmsExperimentalLabelerDefs from "./defs.js";
const _mainSchema = /*#__PURE__*/ v.query("com.emdashcms.experimental.labeler.getAssessment", {
    params: /*#__PURE__*/ v.object({
        /**
         * @minLength 1
         * @maxLength 100
         */
        id: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
            /*#__PURE__*/ v.stringLength(1, 100),
        ]),
    }),
    output: {
        type: "lex",
        get schema() {
            return ComEmdashcmsExperimentalLabelerDefs.publicAssessmentSchema;
        },
    },
});
export const mainSchema = _mainSchema;
