import type { LlmModelProfile, LlmProfile } from "./client";

export interface LlmSettingsData {
  profiles: LlmProfile[];
  models: LlmModelProfile[];
}

export interface EncryptedLlmSettings {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const iterations = 310_000;

const bufferOf = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function keyFromPassphrase(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bufferOf(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptLlmSettings(data: LlmSettingsData, passphrase: string): Promise<EncryptedLlmSettings> {
  if (passphrase.length < 12) throw new Error("Passphrase must contain at least 12 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromPassphrase(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: bufferOf(iv) }, key, bufferOf(encoder.encode(JSON.stringify(data))));
  return { version: 1, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

export async function decryptLlmSettings(backup: EncryptedLlmSettings, passphrase: string): Promise<LlmSettingsData> {
  if (backup.version !== 1) throw new Error("Unsupported backup version");
  const key = await keyFromPassphrase(passphrase, base64ToBytes(backup.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bufferOf(base64ToBytes(backup.iv)) },
    key,
    bufferOf(base64ToBytes(backup.ciphertext)),
  );
  const value = JSON.parse(decoder.decode(plaintext)) as Partial<LlmSettingsData>;
  if (!Array.isArray(value.profiles) || !Array.isArray(value.models)) throw new Error("Invalid backup contents");
  return { profiles: value.profiles as LlmProfile[], models: value.models as LlmModelProfile[] };
}
