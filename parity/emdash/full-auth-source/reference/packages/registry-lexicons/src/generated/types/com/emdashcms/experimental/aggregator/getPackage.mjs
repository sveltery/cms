import * as v from "@atcute/lexicons/validations";
import * as ComEmdashcmsExperimentalAggregatorDefs from "./defs.js";
const _mainSchema = /*#__PURE__*/ v.query("com.emdashcms.experimental.aggregator.getPackage", {
    params: /*#__PURE__*/ v.object({
        /**
         * Publisher DID.
         */
        did: /*#__PURE__*/ v.didString(),
        /**
         * Package slug.
         * @minLength 1
         * @maxLength 64
         */
        slug: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
            /*#__PURE__*/ v.stringLength(1, 64),
        ]),
    }),
    output: {
        type: "lex",
        get schema() {
            return ComEmdashcmsExperimentalAggregatorDefs.packageViewSchema;
        },
    },
});
export const mainSchema = _mainSchema;
