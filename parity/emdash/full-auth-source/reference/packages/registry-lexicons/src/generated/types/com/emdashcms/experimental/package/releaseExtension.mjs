import * as v from "@atcute/lexicons/validations";
const _adminAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#adminAccess")),
    /**
     * Plugin may propose selected unsaved field changes for host validation and review.
     */
    get editorDraftPatch() {
        return /*#__PURE__*/ v.optional(adminEditorDraftPatchConstraintsSchema);
    },
    /**
     * Plugin may receive selected unsaved field values after an explicit editor interaction.
     */
    get editorDraftRead() {
        return /*#__PURE__*/ v.optional(adminEditorDraftReadConstraintsSchema);
    },
});
const _adminEditorDraftPatchConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#adminEditorDraftPatchConstraints")),
});
const _adminEditorDraftReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#adminEditorDraftReadConstraints")),
});
const _bylinesAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#bylinesAccess")),
    /**
     * Plugin may read public byline profiles and the bylines credited on content entries.
     */
    get read() {
        return /*#__PURE__*/ v.optional(bylinesReadConstraintsSchema);
    },
});
const _bylinesReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#bylinesReadConstraints")),
});
const _commentsAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#commentsAccess")),
    /**
     * Plugin may change comment status with an expected-state precondition. Implies `read`.
     */
    get moderate() {
        return /*#__PURE__*/ v.optional(commentsModerateConstraintsSchema);
    },
    /**
     * Plugin may read non-trashed comments and their personal and moderation data.
     */
    get read() {
        return /*#__PURE__*/ v.optional(commentsReadConstraintsSchema);
    },
});
const _commentsModerateConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#commentsModerateConstraints")),
});
const _commentsReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#commentsReadConstraints")),
});
const _contentAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#contentAccess")),
    /**
     * Plugin may inspect and reject publication, scheduling, and unpublication. Does not imply content read or write access.
     */
    get policy() {
        return /*#__PURE__*/ v.optional(contentPolicyConstraintsSchema);
    },
    /**
     * Plugin may publish, unpublish, schedule, and unschedule content. Implies `read`.
     */
    get publish() {
        return /*#__PURE__*/ v.optional(contentPublishConstraintsSchema);
    },
    /**
     * Plugin may read content records.
     */
    get read() {
        return /*#__PURE__*/ v.optional(contentReadConstraintsSchema);
    },
    /**
     * Plugin may read and restore trashed content.
     */
    get restore() {
        return /*#__PURE__*/ v.optional(contentRestoreConstraintsSchema);
    },
    /**
     * Plugin may read retained content revision history. Implies `read`.
     */
    get revisionsRead() {
        return /*#__PURE__*/ v.optional(contentRevisionsReadConstraintsSchema);
    },
    /**
     * Plugin may create, update, or delete content records. Implies `read`.
     */
    get write() {
        return /*#__PURE__*/ v.optional(contentWriteConstraintsSchema);
    },
});
const _contentPolicyConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#contentPolicyConstraints")),
});
const _contentPublishConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#contentPublishConstraints")),
});
const _contentReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#contentReadConstraints")),
});
const _contentRestoreConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#contentRestoreConstraints")),
});
const _contentRevisionsReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#contentRevisionsReadConstraints")),
});
const _contentWriteConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#contentWriteConstraints")),
});
const _declaredAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#declaredAccess")),
    /**
     * Access to selected unsaved content in the authenticated editor.
     */
    get admin() {
        return /*#__PURE__*/ v.optional(adminAccessSchema);
    },
    /**
     * Read access to public byline profiles and the bylines credited on content entries.
     */
    get bylines() {
        return /*#__PURE__*/ v.optional(bylinesAccessSchema);
    },
    /**
     * Access to comment text, author contact and request metadata, and moderation state.
     */
    get comments() {
        return /*#__PURE__*/ v.optional(commentsAccessSchema);
    },
    /**
     * Access to site content (posts, pages, custom collections).
     */
    get content() {
        return /*#__PURE__*/ v.optional(contentAccessSchema);
    },
    /**
     * Sending mail through the host's mail service, and participating in its delivery pipeline.
     */
    get email() {
        return /*#__PURE__*/ v.optional(emailAccessSchema);
    },
    /**
     * Access to uploaded media assets.
     */
    get media() {
        return /*#__PURE__*/ v.optional(mediaAccessSchema);
    },
    /**
     * Outbound HTTP requests.
     */
    get network() {
        return /*#__PURE__*/ v.optional(networkAccessSchema);
    },
    /**
     * Participation in rendered page output.
     */
    get page() {
        return /*#__PURE__*/ v.optional(pageAccessSchema);
    },
    /**
     * Access to visitor redirect rules.
     */
    get redirects() {
        return /*#__PURE__*/ v.optional(redirectsAccessSchema);
    },
    /**
     * Read access to collection and field definitions.
     */
    get schema() {
        return /*#__PURE__*/ v.optional(schemaAccessSchema);
    },
    /**
     * Access to taxonomy definitions and terms.
     */
    get taxonomies() {
        return /*#__PURE__*/ v.optional(taxonomiesAccessSchema);
    },
    /**
     * Access to site user records.
     */
    get users() {
        return /*#__PURE__*/ v.optional(usersAccessSchema);
    },
});
const _emailAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#emailAccess")),
    /**
     * Plugin observes and may mutate every outgoing message (before and/or after send), including mail from the host and other plugins.
     */
    get events() {
        return /*#__PURE__*/ v.optional(emailEventsConstraintsSchema);
    },
    /**
     * Plugin may send mail.
     */
    get send() {
        return /*#__PURE__*/ v.optional(emailSendConstraintsSchema);
    },
    /**
     * Plugin becomes the host's mail transport; every message the site sends is delivered through it. Exclusive: installing replaces the current transport.
     */
    get transport() {
        return /*#__PURE__*/ v.optional(emailTransportConstraintsSchema);
    },
});
const _emailEventsConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#emailEventsConstraints")),
});
const _emailSendConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#emailSendConstraints")),
});
const _emailTransportConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#emailTransportConstraints")),
});
const _mainSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension")),
    /**
     * Structured per-category access manifest. The sandbox enforces every operation declared here at runtime.
     */
    get declaredAccess() {
        return declaredAccessSchema;
    },
    /**
     * Optional reference to a provenance document for this release.
     */
    get provenance() {
        return /*#__PURE__*/ v.optional(provenanceSchema);
    },
});
const _mediaAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#mediaAccess")),
    /**
     * Plugin may read bounded bytes and content hashes for ready media.
     */
    get bytesRead() {
        return /*#__PURE__*/ v.optional(mediaBytesReadConstraintsSchema);
    },
    /**
     * Plugin may change alt text, captions, and focal points on ready media.
     */
    get metadataWrite() {
        return /*#__PURE__*/ v.optional(mediaMetadataWriteConstraintsSchema);
    },
    /**
     * Plugin may read ready media metadata. Storage keys, author identity, content hashes, and file bytes are excluded.
     */
    get read() {
        return /*#__PURE__*/ v.optional(mediaReadConstraintsSchema);
    },
    /**
     * Plugin may upload, modify, or delete media. Implies `read`.
     */
    get write() {
        return /*#__PURE__*/ v.optional(mediaWriteConstraintsSchema);
    },
});
const _mediaBytesReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#mediaBytesReadConstraints")),
});
const _mediaMetadataWriteConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#mediaMetadataWriteConstraints")),
});
const _mediaReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#mediaReadConstraints")),
});
const _mediaWriteConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#mediaWriteConstraints")),
});
const _networkAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#networkAccess")),
    /**
     * Plugin may make outbound HTTP requests. Constraints scope the access; an empty object grants unrestricted requests.
     */
    get request() {
        return /*#__PURE__*/ v.optional(networkRequestConstraintsSchema);
    },
});
const _networkRequestConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#networkRequestConstraints")),
    /**
     * Allow-list of outbound host patterns. Each entry is a hostname pattern with no scheme, path, or port; a leading '*.' wildcard is permitted for subdomains. Field absent means no host restriction; an empty array MUST NOT appear in records.
     * @minLength 1
     * @maxLength 64
     */
    allowedHosts: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(
    /*#__PURE__*/ v.array(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringLength(0, 256),
    ])), [/*#__PURE__*/ v.arrayLength(1, 64)])),
});
const _pageAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#pageAccess")),
    /**
     * Plugin injects script and/or style fragments into rendered pages.
     */
    get fragments() {
        return /*#__PURE__*/ v.optional(pageFragmentsConstraintsSchema);
    },
});
const _pageFragmentsConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#pageFragmentsConstraints")),
});
const _provenanceSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#provenance")),
    /**
     * @maxLength 1024
     */
    builderId: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.genericUriString(), [
        /*#__PURE__*/ v.stringLength(0, 1024),
    ]),
    /**
     * Multibase-encoded multihash of the provenance document bytes. Consumers validate the multibase-multihash syntax and supported hash function.
     * @maxLength 256
     */
    checksum: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringLength(0, 256),
    ]),
    /**
     * @maxLength 1024
     */
    predicateType: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringLength(0, 1024),
    ]),
    /**
     * @maxLength 1024
     */
    sourceRepository: /*#__PURE__*/ v.constrain(
    /*#__PURE__*/ v.genericUriString(), [/*#__PURE__*/ v.stringLength(0, 1024)]),
    /**
     * @maxLength 2048
     */
    url: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.genericUriString(), [
        /*#__PURE__*/ v.stringLength(0, 2048),
    ]),
});
const _redirectsAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#redirectsAccess")),
    /**
     * Plugin may read redirect rules.
     */
    get read() {
        return /*#__PURE__*/ v.optional(redirectsReadConstraintsSchema);
    },
    /**
     * Plugin may create, update, or delete redirect rules and change where visitors are sent. Implies `read`.
     */
    get write() {
        return /*#__PURE__*/ v.optional(redirectsWriteConstraintsSchema);
    },
});
const _redirectsReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#redirectsReadConstraints")),
});
const _redirectsWriteConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#redirectsWriteConstraints")),
});
const _schemaAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#schemaAccess")),
    /**
     * Plugin may read public collection and field definitions.
     */
    get read() {
        return /*#__PURE__*/ v.optional(schemaReadConstraintsSchema);
    },
});
const _schemaReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#schemaReadConstraints")),
});
const _taxonomiesAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#taxonomiesAccess")),
    /**
     * Plugin may read taxonomy definitions, their terms, and the terms assigned to content entries.
     */
    get read() {
        return /*#__PURE__*/ v.optional(taxonomiesReadConstraintsSchema);
    },
    /**
     * Plugin may create terms and add or remove term assignments. Implies `read`.
     */
    get write() {
        return /*#__PURE__*/ v.optional(taxonomiesWriteConstraintsSchema);
    },
});
const _taxonomiesReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#taxonomiesReadConstraints")),
});
const _taxonomiesWriteConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#taxonomiesWriteConstraints")),
});
const _usersAccessSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#usersAccess")),
    /**
     * Plugin may read site user records.
     */
    get read() {
        return /*#__PURE__*/ v.optional(usersReadConstraintsSchema);
    },
});
const _usersReadConstraintsSchema = /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.emdashcms.experimental.package.releaseExtension#usersReadConstraints")),
});
export const adminAccessSchema = _adminAccessSchema;
export const adminEditorDraftPatchConstraintsSchema = _adminEditorDraftPatchConstraintsSchema;
export const adminEditorDraftReadConstraintsSchema = _adminEditorDraftReadConstraintsSchema;
export const bylinesAccessSchema = _bylinesAccessSchema;
export const bylinesReadConstraintsSchema = _bylinesReadConstraintsSchema;
export const commentsAccessSchema = _commentsAccessSchema;
export const commentsModerateConstraintsSchema = _commentsModerateConstraintsSchema;
export const commentsReadConstraintsSchema = _commentsReadConstraintsSchema;
export const contentAccessSchema = _contentAccessSchema;
export const contentPolicyConstraintsSchema = _contentPolicyConstraintsSchema;
export const contentPublishConstraintsSchema = _contentPublishConstraintsSchema;
export const contentReadConstraintsSchema = _contentReadConstraintsSchema;
export const contentRestoreConstraintsSchema = _contentRestoreConstraintsSchema;
export const contentRevisionsReadConstraintsSchema = _contentRevisionsReadConstraintsSchema;
export const contentWriteConstraintsSchema = _contentWriteConstraintsSchema;
export const declaredAccessSchema = _declaredAccessSchema;
export const emailAccessSchema = _emailAccessSchema;
export const emailEventsConstraintsSchema = _emailEventsConstraintsSchema;
export const emailSendConstraintsSchema = _emailSendConstraintsSchema;
export const emailTransportConstraintsSchema = _emailTransportConstraintsSchema;
export const mainSchema = _mainSchema;
export const mediaAccessSchema = _mediaAccessSchema;
export const mediaBytesReadConstraintsSchema = _mediaBytesReadConstraintsSchema;
export const mediaMetadataWriteConstraintsSchema = _mediaMetadataWriteConstraintsSchema;
export const mediaReadConstraintsSchema = _mediaReadConstraintsSchema;
export const mediaWriteConstraintsSchema = _mediaWriteConstraintsSchema;
export const networkAccessSchema = _networkAccessSchema;
export const networkRequestConstraintsSchema = _networkRequestConstraintsSchema;
export const pageAccessSchema = _pageAccessSchema;
export const pageFragmentsConstraintsSchema = _pageFragmentsConstraintsSchema;
export const provenanceSchema = _provenanceSchema;
export const redirectsAccessSchema = _redirectsAccessSchema;
export const redirectsReadConstraintsSchema = _redirectsReadConstraintsSchema;
export const redirectsWriteConstraintsSchema = _redirectsWriteConstraintsSchema;
export const schemaAccessSchema = _schemaAccessSchema;
export const schemaReadConstraintsSchema = _schemaReadConstraintsSchema;
export const taxonomiesAccessSchema = _taxonomiesAccessSchema;
export const taxonomiesReadConstraintsSchema = _taxonomiesReadConstraintsSchema;
export const taxonomiesWriteConstraintsSchema = _taxonomiesWriteConstraintsSchema;
export const usersAccessSchema = _usersAccessSchema;
export const usersReadConstraintsSchema = _usersReadConstraintsSchema;
