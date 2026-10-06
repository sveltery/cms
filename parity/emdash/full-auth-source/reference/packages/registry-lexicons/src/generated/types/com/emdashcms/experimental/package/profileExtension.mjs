import * as v from "@atcute/lexicons/validations";
const _mainSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.profileExtension")),
    get releasePolicy() {
        return /*#__PURE__*/ v.optional(releasePolicySchema);
    },
    /**
     * Canonical HTTPS source repository URL. Lexicon validates URI syntax and length; consumers must require HTTPS and canonicalization.
     * @maxLength 1024
     */
    repository: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.genericUriString(), [
        /*#__PURE__*/ v.stringLength(0, 1024),
    ]),
});
const _releasePolicySchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.profileExtension#releasePolicy")),
    /**
     * Atproto DIDs authorized to approve releases. Lexicon validates DID syntax and the 32-item cap; consumers must reject duplicate DIDs.
     * @maxLength 32
     */
    approvers: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(
    /*#__PURE__*/ v.array(/*#__PURE__*/ v.didString()), [/*#__PURE__*/ v.arrayLength(0, 32)])),
    /**
     * When a release requires human confirmation. The generated TypeScript type exposes escalation-only and always; Lexicon runtime validators do not enforce knownValues, so consumers must reject other values.
     */
    confirmation: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.string()),
    /**
     * Whether releases require a verifiable provenance reference.
     */
    requireProvenance: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
});
export const mainSchema = _mainSchema;
export const releasePolicySchema = _releasePolicySchema;
