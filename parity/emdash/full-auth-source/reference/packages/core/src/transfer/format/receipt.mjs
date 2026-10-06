/**
 * Import receipts. A receipt exists only for a verified import; its
 * `receiptDigest` is the digest of the receipt without that property
 * (see `format/digest.ts`), so anyone holding the JSON can check it.
 */
import { z } from "zod";
import { isSha256Digest, receiptDigest } from "./digest.js";
import { portableIdSchema } from "./kinds.js";
import { SITE_PACKAGE_FORMAT_VERSION } from "./version.js";
const digest = z.custom(isSha256Digest, "Expected a sha256: digest");
export const siteImportReceiptSchema = z.strictObject({
    operationId: portableIdSchema,
    packageDigest: digest,
    planDigest: digest,
    targetSiteId: portableIdSchema,
    originSiteId: portableIdSchema,
    formatVersion: z.literal(SITE_PACKAGE_FORMAT_VERSION),
    importerEmDashVersion: z.string().min(1).max(128),
    completedAt: z.string().min(1).max(64),
    logicalDigest: digest,
    counts: z.record(z.string().max(64), z.number().int().nonnegative()),
    warnings: z
        .array(z.strictObject({ code: z.string().max(64), message: z.string().max(1024) }))
        .max(500),
    verification: z.literal("verified"),
    receiptDigest: digest,
});
export async function sealReceipt(receipt) {
    return { ...receipt, receiptDigest: await receiptDigest(receipt) };
}
export async function verifyReceiptDigest(receipt) {
    return (await receiptDigest(receipt)) === receipt.receiptDigest;
}
