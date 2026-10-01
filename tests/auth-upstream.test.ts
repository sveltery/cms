// Adapted from EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.
// Source: 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/auth/src/rbac.test.ts
// See notices/emdash-MIT.txt. Assertion semantics and fixtures are unchanged.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
	hasPermission,
	requirePermission,
	canActOnOwn,
	requirePermissionOnResource,
	PermissionError,
} from "../src/lib/server/auth/permissions.ts";
import { Role } from "../src/lib/server/auth/roles.ts";

describe("rbac", () => {
	describe("hasPermission", () => {
		it("returns false for null user [rbac.ts:15]", () => {
			assert.equal(hasPermission(null, "content:read"), false);
		});

		it("returns false for undefined user [rbac.ts:19]", () => {
			assert.equal(hasPermission(undefined, "content:read"), false);
		});

		it("allows subscriber to read content [rbac.ts:23]", () => {
			assert.equal(hasPermission({ role: Role.SUBSCRIBER }, "content:read"), true);
		});

		it("denies subscriber from creating content [rbac.ts:27]", () => {
			assert.equal(hasPermission({ role: Role.SUBSCRIBER }, "content:create"), false);
		});

		it("allows contributor to create content [rbac.ts:31]", () => {
			assert.equal(hasPermission({ role: Role.CONTRIBUTOR }, "content:create"), true);
		});

		it("allows admin to do anything [rbac.ts:35]", () => {
			const admin = { role: Role.ADMIN };
			assert.equal(hasPermission(admin, "content:read"), true);
			assert.equal(hasPermission(admin, "content:create"), true);
			assert.equal(hasPermission(admin, "users:manage"), true);
			assert.equal(hasPermission(admin, "schema:manage"), true);
		});

		it("denies editor from managing users [rbac.ts:43]", () => {
			assert.equal(hasPermission({ role: Role.EDITOR }, "users:manage"), false);
		});

		it("allows author to edit own media [rbac.ts:47]", () => {
			assert.equal(hasPermission({ role: Role.AUTHOR }, "media:edit_own"), true);
		});

		it("denies contributor from editing media [rbac.ts:51]", () => {
			assert.equal(hasPermission({ role: Role.CONTRIBUTOR }, "media:edit_own"), false);
		});

		it("allows editor to edit any media [rbac.ts:55]", () => {
			assert.equal(hasPermission({ role: Role.EDITOR }, "media:edit_any"), true);
		});

		it("denies author from editing any media [rbac.ts:59]", () => {
			assert.equal(hasPermission({ role: Role.AUTHOR }, "media:edit_any"), false);
		});

		// content:read_drafts gates non-published content reads and editor-only
		// views (revisions, compare, trash, preview-url).
		it("denies subscriber from reading drafts [rbac.ts:65]", () => {
			assert.equal(hasPermission({ role: Role.SUBSCRIBER }, "content:read_drafts"), false);
		});

		it("allows contributor to read drafts [rbac.ts:69]", () => {
			assert.equal(hasPermission({ role: Role.CONTRIBUTOR }, "content:read_drafts"), true);
		});

		it("allows editor to read drafts [rbac.ts:73]", () => {
			assert.equal(hasPermission({ role: Role.EDITOR }, "content:read_drafts"), true);
		});
	});

	describe("requirePermission", () => {
		it("throws for null user [rbac.ts:79]", () => {
			assert.throws(() => requirePermission(null, "content:read"), PermissionError);
		});

		it("throws unauthorized for missing user [rbac.ts:83]", () => {
			try {
				requirePermission(null, "content:read");
			} catch (e) {
				assert.ok(e instanceof PermissionError);
				assert.equal((e as PermissionError).code, "unauthorized");
			}
		});

		it("throws forbidden for insufficient permissions [rbac.ts:92]", () => {
			try {
				requirePermission({ role: Role.SUBSCRIBER }, "content:create");
			} catch (e) {
				assert.ok(e instanceof PermissionError);
				assert.equal((e as PermissionError).code, "forbidden");
			}
		});

		it("does not throw for sufficient permissions [rbac.ts:101]", () => {
			assert.doesNotThrow(() => requirePermission({ role: Role.ADMIN }, "content:create"));
		});
	});

	describe("canActOnOwn", () => {
		const user = { role: Role.AUTHOR, id: "user-1" };

		it("allows action on own resource with own permission [rbac.ts:109]", () => {
			assert.equal(canActOnOwn(user, "user-1", "content:edit_own", "content:edit_any"), true);
		});

		it("denies action on others resource without any permission [rbac.ts:113]", () => {
			assert.equal(canActOnOwn(user, "user-2", "content:edit_own", "content:edit_any"), false);
		});

		it("allows editor to edit any resource [rbac.ts:117]", () => {
			const editor = { role: Role.EDITOR, id: "editor-1" };
			assert.equal(canActOnOwn(editor, "user-2", "content:edit_own", "content:edit_any"), true);
		});

		it("allows author to edit own media [rbac.ts:122]", () => {
			assert.equal(canActOnOwn(user, "user-1", "media:edit_own", "media:edit_any"), true);
		});

		it("denies author from editing others media [rbac.ts:126]", () => {
			assert.equal(canActOnOwn(user, "user-2", "media:edit_own", "media:edit_any"), false);
		});

		it("denies contributor from editing any media (including own) [rbac.ts:130]", () => {
			const contributor = { role: Role.CONTRIBUTOR, id: "contrib-1" };
			assert.equal(canActOnOwn(contributor, "contrib-1", "media:edit_own", "media:edit_any"), false);
		});

		it("allows editor to edit any media [rbac.ts:135]", () => {
			const editor = { role: Role.EDITOR, id: "editor-1" };
			assert.equal(canActOnOwn(editor, "user-2", "media:edit_own", "media:edit_any"), true);
		});

		it("F17: empty-string ownerId is not treated as 'owned by user with id '' [rbac.ts:140]", () => {
			// A user with id="" and *:edit_own (but NOT *:edit_any) must NOT
			// be able to edit content with ownerId="" — that ownerId means
			// "no recorded owner" (e.g. seed-imported content), and granting
			// edit-own would be an accidental privilege escalation.
			const orphanedUser = { role: Role.AUTHOR, id: "" };
			assert.equal(canActOnOwn(orphanedUser, "", "content:edit_own", "content:edit_any"), false);
		});
	});



	describe("requirePermissionOnResource", () => {
		it("allows author to edit own content [rbac.ts:169]", () => {
			const user = { role: Role.AUTHOR, id: "user-1" };
			assert.doesNotThrow(() =>
				requirePermissionOnResource(user, "user-1", "content:edit_own", "content:edit_any"));
		});

		it("throws for author editing others content [rbac.ts:176]", () => {
			const user = { role: Role.AUTHOR, id: "user-1" };
			assert.throws(() =>
				requirePermissionOnResource(user, "user-2", "content:edit_own", "content:edit_any"), PermissionError);
		});
	});
});
