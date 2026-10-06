import { resolvePluginEncryptionKeys } from "../config/secrets.js";
import { decodeBase64url, encodeBase64url } from "../utils/base64.js";
import { assertStorageKey } from "./conditional-storage.js";
export { createPluginSecretRedactor } from "./secret-redactor.js";
const ENVELOPE_VERSION = 1;
const ENVELOPE_MARKER = "plugin-setting";
const IV_BYTES = 12;
const KEY_ID_PATTERN = /^[0-9a-f]{8}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
export class PluginSettingEncryptionError extends Error {
    name = "PluginSettingEncryptionError";
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
export function isEncryptedPluginSetting(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    return (Object.keys(value).length === 5 &&
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
        BASE64URL_PATTERN.test(value.ciphertext));
}
function additionalData(pluginId, key) {
    return textEncoder.encode(JSON.stringify(["emdash-plugin-setting", ENVELOPE_VERSION, pluginId, key]));
}
function exactBuffer(bytes) {
    return bytes.slice().buffer;
}
async function importEncryptionKey(key, usage) {
    return crypto.subtle.importKey("raw", exactBuffer(key.key), "AES-GCM", false, [usage]);
}
async function keysOrDefault(keys) {
    return keys === undefined ? resolvePluginEncryptionKeys() : keys;
}
export async function encryptPluginSetting(pluginId, key, value, keys) {
    const resolved = await keysOrDefault(keys);
    const primary = resolved?.[0];
    if (!primary) {
        throw new PluginSettingEncryptionError("PLUGIN_SETTING_ENCRYPTION_KEY_MISSING", "Plugin secret settings require EMDASH_ENCRYPTION_KEY");
    }
    try {
        const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
        const cryptoKey = await importEncryptionKey(primary, "encrypt");
        const ciphertext = await crypto.subtle.encrypt({
            name: "AES-GCM",
            iv: exactBuffer(iv),
            additionalData: exactBuffer(additionalData(pluginId, key)),
        }, cryptoKey, exactBuffer(textEncoder.encode(value)));
        return {
            $emdash: ENVELOPE_MARKER,
            v: ENVELOPE_VERSION,
            kid: primary.kid,
            iv: encodeBase64url(iv),
            ciphertext: encodeBase64url(new Uint8Array(ciphertext)),
        };
    }
    catch (error) {
        if (error instanceof PluginSettingEncryptionError)
            throw error;
        throw new PluginSettingEncryptionError("PLUGIN_SETTING_ENCRYPTION_FAILED", "Plugin secret setting could not be encrypted");
    }
}
export async function decryptPluginSetting(pluginId, key, envelope, keys) {
    const resolved = await keysOrDefault(keys);
    if (!resolved?.length) {
        throw new PluginSettingEncryptionError("PLUGIN_SETTING_ENCRYPTION_KEY_MISSING", "Plugin secret setting cannot be decrypted because its encryption key is unavailable");
    }
    const matched = resolved.find((candidate) => candidate.kid === envelope.kid);
    if (!matched) {
        throw new PluginSettingEncryptionError("PLUGIN_SETTING_ENCRYPTION_KEY_UNKNOWN", "Plugin secret setting was encrypted with an unavailable key");
    }
    try {
        const iv = decodeBase64url(envelope.iv);
        const ciphertext = decodeBase64url(envelope.ciphertext);
        if (iv.byteLength !== IV_BYTES || ciphertext.byteLength < 16)
            throw new Error("invalid envelope");
        const cryptoKey = await importEncryptionKey(matched, "decrypt");
        const plaintext = await crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: exactBuffer(iv),
            additionalData: exactBuffer(additionalData(pluginId, key)),
        }, cryptoKey, exactBuffer(ciphertext));
        return textDecoder.decode(plaintext);
    }
    catch {
        throw new PluginSettingEncryptionError("PLUGIN_SETTING_DECRYPTION_FAILED", "Plugin secret setting could not be decrypted");
    }
}
function isSecretField(schema, key) {
    return schema[key]?.type === "secret";
}
export async function encodePluginSettingValue(pluginId, key, value, schema, keys, onSecret) {
    if (!isSecretField(schema, key))
        return value;
    if (typeof value !== "string") {
        throw new PluginSettingEncryptionError("PLUGIN_SETTING_ENCRYPTION_FAILED", "Plugin secret settings must be strings");
    }
    onSecret?.(key, value);
    return encryptPluginSetting(pluginId, key, value, keys);
}
export async function decodePluginSettingValue(pluginId, key, value, schema, keys, onSecret) {
    if (!isSecretField(schema, key)) {
        if (isEncryptedPluginSetting(value)) {
            throw new PluginSettingEncryptionError("PLUGIN_SETTING_DECRYPTION_FAILED", "Encrypted plugin setting is not declared as a secret");
        }
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- caller supplies the expected non-secret setting type
        return value;
    }
    if (typeof value === "string") {
        onSecret?.(key, value);
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- secret schema guarantees a string and caller supplies its compatible type
        return value;
    }
    if (!isEncryptedPluginSetting(value)) {
        throw new PluginSettingEncryptionError("PLUGIN_SETTING_DECRYPTION_FAILED", "Plugin secret setting has an invalid encrypted envelope");
    }
    const decrypted = await decryptPluginSetting(pluginId, key, value, keys);
    onSecret?.(key, decrypted);
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- secret schema guarantees a string and caller supplies its compatible type
    return decrypted;
}
export function createSettingsAccess(optionsRepo, pluginId, schema = {}, keys, onSecret) {
    const prefix = `plugin:${pluginId}:settings:`;
    const optionKey = (key) => {
        assertStorageKey(key);
        return `${prefix}${key}`;
    };
    return {
        async get(key) {
            const value = await optionsRepo.get(optionKey(key));
            return value === null
                ? null
                : decodePluginSettingValue(pluginId, key, value, schema, keys, onSecret);
        },
        async getVersioned(key) {
            const value = await optionsRepo.getVersioned(optionKey(key));
            if (!value)
                return null;
            return {
                value: await decodePluginSettingValue(pluginId, key, value.value, schema, keys, onSecret),
                revision: value.revision,
            };
        },
        async compareAndSet(key, expectedRevision, value) {
            return optionsRepo.compareAndSet(optionKey(key), expectedRevision, await encodePluginSettingValue(pluginId, key, value, schema, keys, onSecret));
        },
        compareAndDelete(key, expectedRevision) {
            return optionsRepo.compareAndDelete(optionKey(key), expectedRevision);
        },
        async set(key, value) {
            await optionsRepo.set(optionKey(key), await encodePluginSettingValue(pluginId, key, value, schema, keys, onSecret));
        },
        delete(key) {
            return optionsRepo.delete(optionKey(key));
        },
        async list(keyPrefix = "") {
            assertStorageKey(keyPrefix || "_");
            const values = await optionsRepo.getByPrefix(`${prefix}${keyPrefix}`);
            const result = [];
            for (const [fullKey, value] of values) {
                const key = fullKey.slice(prefix.length);
                result.push({
                    key,
                    value: await decodePluginSettingValue(pluginId, key, value, schema, keys, onSecret),
                });
            }
            return result;
        },
    };
}
