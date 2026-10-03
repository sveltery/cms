// Selected exact EmDash1.1.0 source declarations: packages/core/src/plugins/settings.ts.
// Immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import { resolvePluginEncryptionKeys,type ParsedEncryptionKey } from "./encryption-keys.ts";

import { decodeBase64url, encodeBase64url } from "./base64.ts";





const ENVELOPE_VERSION = 1;
const ENVELOPE_MARKER = "plugin-setting";
const IV_BYTES = 12;
const KEY_ID_PATTERN = /^[0-9a-f]{8}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface EncryptedPluginSetting {
	$emdash: "plugin-setting";
	v: 1;
	kid: string;
	iv: string;
	ciphertext: string;
}

export class PluginSettingEncryptionError extends Error {
	override readonly name = "PluginSettingEncryptionError";
	readonly code:
		| "PLUGIN_SETTING_ENCRYPTION_KEY_MISSING"
		| "PLUGIN_SETTING_ENCRYPTION_KEY_UNKNOWN"
		| "PLUGIN_SETTING_ENCRYPTION_FAILED"
		| "PLUGIN_SETTING_DECRYPTION_FAILED";

	constructor(code: PluginSettingEncryptionError["code"], message: string) {
		super(message);
		this.code = code;
	}
}

export function isEncryptedPluginSetting(value: unknown): value is EncryptedPluginSetting {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	return (
		Object.keys(value).length === 5 &&
		"$emdash" in value &&
		value.$emdash === ENVELOPE_MARKER &&
		"v" in value &&
		value.v === ENVELOPE_VERSION &&
		"kid" in value &&
		typeof value.kid === "string" &&
		KEY_ID_PATTERN.test(value.kid) &&
		"iv" in value &&
		typeof value.iv === "string" &&
		BASE64URL_PATTERN.test(value.iv) &&
		"ciphertext" in value &&
		typeof value.ciphertext === "string" &&
		BASE64URL_PATTERN.test(value.ciphertext)
	);
}

function additionalData(pluginId: string, key: string): Uint8Array {
	return textEncoder.encode(
		JSON.stringify(["emdash-plugin-setting", ENVELOPE_VERSION, pluginId, key]),
	);
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer;
}

async function importEncryptionKey(key: ParsedEncryptionKey, usage: KeyUsage): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", exactBuffer(key.key), "AES-GCM", false, [usage]);
}

async function keysOrDefault(
	keys: ParsedEncryptionKey[] | null | undefined,
): Promise<ParsedEncryptionKey[] | null> {
	return keys === undefined ? resolvePluginEncryptionKeys() : keys;
}

export async function encryptPluginSetting(
	pluginId: string,
	key: string,
	value: string,
	keys?: ParsedEncryptionKey[] | null,
): Promise<EncryptedPluginSetting> {
	const resolved = await keysOrDefault(keys);
	const primary = resolved?.[0];
	if (!primary) {
		throw new PluginSettingEncryptionError(
			"PLUGIN_SETTING_ENCRYPTION_KEY_MISSING",
			"Plugin secret settings require EMDASH_ENCRYPTION_KEY",
		);
	}

	try {
		const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
		const cryptoKey = await importEncryptionKey(primary, "encrypt");
		const ciphertext = await crypto.subtle.encrypt(
			{
				name: "AES-GCM",
				iv: exactBuffer(iv),
				additionalData: exactBuffer(additionalData(pluginId, key)),
			},
			cryptoKey,
			exactBuffer(textEncoder.encode(value)),
		);
		return {
			$emdash: ENVELOPE_MARKER,
			v: ENVELOPE_VERSION,
			kid: primary.kid,
			iv: encodeBase64url(iv),
			ciphertext: encodeBase64url(new Uint8Array(ciphertext)),
		};
	} catch (error) {
		if (error instanceof PluginSettingEncryptionError) throw error;
		throw new PluginSettingEncryptionError(
			"PLUGIN_SETTING_ENCRYPTION_FAILED",
			"Plugin secret setting could not be encrypted",
		);
	}
}

export async function decryptPluginSetting(
	pluginId: string,
	key: string,
	envelope: EncryptedPluginSetting,
	keys?: ParsedEncryptionKey[] | null,
): Promise<string> {
	const resolved = await keysOrDefault(keys);
	if (!resolved?.length) {
		throw new PluginSettingEncryptionError(
			"PLUGIN_SETTING_ENCRYPTION_KEY_MISSING",
			"Plugin secret setting cannot be decrypted because its encryption key is unavailable",
		);
	}
	const matched = resolved.find((candidate) => candidate.kid === envelope.kid);
	if (!matched) {
		throw new PluginSettingEncryptionError(
			"PLUGIN_SETTING_ENCRYPTION_KEY_UNKNOWN",
			"Plugin secret setting was encrypted with an unavailable key",
		);
	}

	try {
		const iv = decodeBase64url(envelope.iv);
		const ciphertext = decodeBase64url(envelope.ciphertext);
		if (iv.byteLength !== IV_BYTES || ciphertext.byteLength < 16)
			throw new Error("invalid envelope");
		const cryptoKey = await importEncryptionKey(matched, "decrypt");
		const plaintext = await crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: exactBuffer(iv),
				additionalData: exactBuffer(additionalData(pluginId, key)),
			},
			cryptoKey,
			exactBuffer(ciphertext),
		);
		return textDecoder.decode(plaintext);
	} catch {
		throw new PluginSettingEncryptionError(
			"PLUGIN_SETTING_DECRYPTION_FAILED",
			"Plugin secret setting could not be decrypted",
		);
	}
}

