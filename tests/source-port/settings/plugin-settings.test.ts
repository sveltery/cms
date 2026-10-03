// @ts-nocheck -- unchanged complete source callbacks; native versioned options fixture.
// EmDash1.1.0 MIT Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import {describe,beforeEach,afterEach,it,expect,vi} from 'vitest';
import {openSqlite} from '../../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {OptionsRepository} from '../../../src/lib/server/settings/options.ts';
import {settingsDb,getPluginSettingWithDb,getPluginSettingsWithDb} from '../../../src/lib/server/settings/index.ts';
import {generateEncryptionKey,parseEncryptionKeys} from '../../../src/lib/server/settings/vendor/encryption-keys.ts';
import {encryptPluginSetting} from '../../../src/lib/server/settings/vendor/plugin-settings.ts';
describe('Plugin settings public helpers: complete pinned callbacks',()=>{
 let database,db;
 beforeEach(async()=>{database=openSqlite(':memory:');await migrateCms(database);db=settingsDb(database);});
 afterEach(async()=>{vi.unstubAllEnvs();await database.close();});
		it("should return undefined for unset plugin settings", async () => {
			await expect(getPluginSettingWithDb("demo-plugin", "title", db)).resolves.toBeUndefined();
		});
		it("should return stored plugin settings", async () => {
			const options = new OptionsRepository(db);
			await options.set("plugin:demo-plugin:settings:title", "Hello world");
			await options.set("plugin:demo-plugin:settings:enabled", true);

			await expect(getPluginSettingWithDb("demo-plugin", "title", db)).resolves.toBe("Hello world");
			await expect(getPluginSettingsWithDb("demo-plugin", db)).resolves.toEqual({
				title: "Hello world",
				enabled: true,
			});
		});
		it("returns versioned plugin JSON that is not an encryption envelope", async () => {
			const versioned = { v: 1, kid: "oauth-key", payload: { enabled: true } };
			const encryptedByPlugin = {
				kid: "plugin-managed-key",
				iv: "plugin-managed-iv",
				ciphertext: "plugin-managed-ciphertext",
			};
			const namespaced = { $emdash: "layout-metadata", columns: 3 };
			const options = new OptionsRepository(db);
			await options.set("plugin:demo-plugin:settings:metadata", versioned);
			await options.set("plugin:demo-plugin:settings:token", encryptedByPlugin);
			await options.set("plugin:demo-plugin:settings:layout", namespaced);

			await expect(getPluginSettingWithDb("demo-plugin", "metadata", db)).resolves.toEqual(
				versioned,
			);
			await expect(getPluginSettingWithDb("demo-plugin", "token", db)).resolves.toEqual(
				encryptedByPlugin,
			);
			await expect(getPluginSettingWithDb("demo-plugin", "layout", db)).resolves.toEqual(
				namespaced,
			);
			await expect(getPluginSettingsWithDb("demo-plugin", db)).resolves.toEqual({
				layout: namespaced,
				metadata: versioned,
				token: encryptedByPlugin,
			});
		});
		it("decrypts encrypted plugin settings from the public read helpers", async () => {
			const encryptionKey = generateEncryptionKey();
			vi.stubEnv("EMDASH_ENCRYPTION_KEY", encryptionKey);
			const keys = await parseEncryptionKeys(encryptionKey);
			const options = new OptionsRepository(db);
			await options.set(
				"plugin:demo-plugin:settings:apiKey",
				await encryptPluginSetting("demo-plugin", "apiKey", "secret-value", keys),
			);
			await options.set("plugin:demo-plugin:settings:enabled", true);

			await expect(getPluginSettingWithDb<string>("demo-plugin", "apiKey", db)).resolves.toBe(
				"secret-value",
			);
			await expect(getPluginSettingsWithDb("demo-plugin", db)).resolves.toEqual({
				apiKey: "secret-value",
				enabled: true,
			});
		});
		it("rejects structurally malformed encrypted settings instead of returning envelopes", async () => {
			const encryptionKey = generateEncryptionKey();
			vi.stubEnv("EMDASH_ENCRYPTION_KEY", encryptionKey);
			const keys = await parseEncryptionKeys(encryptionKey);
			const envelope = await encryptPluginSetting("demo-plugin", "apiKey", "secret-value", keys);
			const options = new OptionsRepository(db);
			await options.set("plugin:demo-plugin:settings:apiKey", {
				...envelope,
				unexpected: true,
			});

			await expect(getPluginSettingWithDb("demo-plugin", "apiKey", db)).rejects.toMatchObject({
				code: "PLUGIN_SETTING_DECRYPTION_FAILED",
			});

			const { ciphertext: _ciphertext, ...missingCiphertext } = envelope;
			await options.set("plugin:demo-plugin:settings:apiKey", missingCiphertext);
			await expect(getPluginSettingWithDb("demo-plugin", "apiKey", db)).rejects.toMatchObject({
				code: "PLUGIN_SETTING_DECRYPTION_FAILED",
			});

			await options.set("plugin:demo-plugin:settings:apiKey", {
				...envelope,
				iv: "not+base64url",
			});
			await expect(getPluginSettingsWithDb("demo-plugin", db)).rejects.toMatchObject({
				code: "PLUGIN_SETTING_DECRYPTION_FAILED",
			});

			const { kid: _kid, ...missingKid } = envelope;
			await options.set("plugin:demo-plugin:settings:apiKey", missingKid);
			await expect(getPluginSettingsWithDb("demo-plugin", db)).rejects.toMatchObject({
				code: "PLUGIN_SETTING_DECRYPTION_FAILED",
			});
		});
		it("treats wildcard characters in plugin IDs as literal prefix text", async () => {
			const options = new OptionsRepository(db);
			await options.set("plugin:alpha%beta:settings:title", "literal-percent");
			await options.set("plugin:alphaxbeta:settings:title", "wrong-percent-match");
			await options.set("plugin:alpha_beta:settings:title", "literal-underscore");
			await options.set("plugin:alphazbeta:settings:title", "wrong-underscore-match");

			await expect(getPluginSettingsWithDb("alpha%beta", db)).resolves.toEqual({
				title: "literal-percent",
			});
			await expect(getPluginSettingsWithDb("alpha_beta", db)).resolves.toEqual({
				title: "literal-underscore",
			});
		});
});
