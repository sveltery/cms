import { Role, sendMagicLink, verifyMagicLink } from "@emdash-cms/auth";
import { createKyselyAdapter } from "@emdash-cms/auth/adapters/kysely";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase } from "../../utils/test-db.js";
describe("Magic Link", () => {
    let db;
    let adapter;
    let mockEmailSend;
    let sentEmails;
    beforeEach(async () => {
        db = await setupTestDatabase();
        adapter = createKyselyAdapter(db);
        sentEmails = [];
        mockEmailSend = vi.fn(async (email) => {
            sentEmails.push(email);
        });
    });
    afterEach(async () => {
        await teardownTestDatabase(db);
    });
    it("sends verify links through the injected EmDash auth route", async () => {
        await adapter.createUser({
            email: "author@example.com",
            name: "Author",
            role: Role.AUTHOR,
            emailVerified: true,
        });
        await sendMagicLink({
            baseUrl: "https://example.com",
            siteName: "Test Site",
            email: mockEmailSend,
        }, adapter, "author@example.com");
        expect(mockEmailSend).toHaveBeenCalledOnce();
        expect(sentEmails[0].text).toContain("https://example.com/_emdash/api/auth/magic-link/verify?token=");
    });
    it("redeems a token only once when it is verified twice at the same time", async () => {
        const user = await adapter.createUser({
            email: "author@example.com",
            name: "Author",
            role: Role.AUTHOR,
            emailVerified: true,
        });
        await sendMagicLink({ baseUrl: "https://example.com", siteName: "Test Site", email: mockEmailSend }, adapter, "author@example.com");
        const token = new URL(sentEmails[0].text.match(/https:\/\/\S+/)[0]).searchParams.get("token");
        const results = await Promise.allSettled([
            verifyMagicLink(adapter, token),
            verifyMagicLink(adapter, token),
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toEqual([
            { status: "fulfilled", value: expect.objectContaining({ id: user.id }) },
        ]);
        expect(results.filter((r) => r.status === "rejected")).toMatchObject([
            { reason: { code: "invalid_token" } },
        ]);
    });
});
