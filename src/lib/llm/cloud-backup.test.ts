import { describe, expect, test } from "bun:test";
import { decryptLlmSettings, encryptLlmSettings } from "./cloud-backup";

const settings = {
  profiles: [{ id: "provider-1", name: "OpenAI", type: "openai-responses" as const, token: "secret-key", baseUrl: "https://api.openai.com/v1" }],
  models: [{ id: "model-1", name: "GPT", modelId: "gpt-5", providerId: "provider-1" }],
};

describe("LLM settings cloud encryption", () => {
  test("round-trips without exposing plaintext in the backup", async () => {
    const encrypted = await encryptLlmSettings(settings, "a strong test passphrase");
    expect(JSON.stringify(encrypted)).not.toContain("secret-key");
    expect(await decryptLlmSettings(encrypted, "a strong test passphrase")).toEqual(settings);
  });

  test("rejects an incorrect passphrase", async () => {
    const encrypted = await encryptLlmSettings(settings, "a strong test passphrase");
    await expect(decryptLlmSettings(encrypted, "a different passphrase")).rejects.toThrow();
  });
});
