import * as v from "@atcute/lexicons/validations";
import * as ComEmdashcmsExperimentalLabelerDefs from "./defs.js";
const _mainSchema = /*#__PURE__*/ v.query("com.emdashcms.experimental.labeler.listAssessments", {
    params: /*#__PURE__*/ v.object({
        cid: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.cidString()),
        /**
         * @maxLength 1024
         */
        cursor: /*#__PURE__*/ v.optional(
        /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
            /*#__PURE__*/ v.stringLength(0, 1024),
        ])),
        kind: /*#__PURE__*/ v.optional(
        /*#__PURE__*/ v.string()),
        /**
         * @minimum 1
         * @maximum 100
         * @default 50
         */
        limit: /*#__PURE__*/ v.optional(
        /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.integer(), [
            /*#__PURE__*/ v.integerRange(1, 100),
        ]), 50),
        state: /*#__PURE__*/ v.optional(
        /*#__PURE__*/ v.string()),
        uri: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.resourceUriString()),
    }),
    output: {
        type: "lex",
        schema: /*#__PURE__*/ v.object({
            /**
             * @maxLength 100
             */
            get assessments() {
                return /*#__PURE__*/ v.constrain(
                /*#__PURE__*/ v.array(ComEmdashcmsExperimentalLabelerDefs.publicAssessmentSchema), [/*#__PURE__*/ v.arrayLength(0, 100)]);
            },
            /**
             * @maxLength 1024
             */
            cursor: /*#__PURE__*/ v.optional(
            /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
                /*#__PURE__*/ v.stringLength(0, 1024),
            ])),
        }),
    },
});
export const mainSchema = _mainSchema;
