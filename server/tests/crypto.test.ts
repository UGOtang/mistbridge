import { describe, expect, test } from "bun:test";

process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.INITIAL_ADMIN_PASSWORD = "Test-Initial-Only-123!";
process.env.FRP_AUTH_TOKEN = "test-frp-token";
process.env.FRP_PLUGIN_SECRET = "test-plugin-secret";

const cryptoModule = await import("../src/crypto");

describe("at-rest encryption", () => {
  test("round-trips secrets and rejects tampering", () => {
    const plaintext = "device-token-ABCDEFGHIJK";
    const encrypted = cryptoModule.encryptSecret(plaintext);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(cryptoModule.decryptSecret(encrypted)).toBe(plaintext);

    const parts = encrypted.split(".");
    const last = parts[3] ?? "";
    parts[3] = `${last.slice(0, -2)}AA`;
    expect(() => cryptoModule.decryptSecret(parts.join("."))).toThrow();
  });

  test("token hashing is deterministic and timing-safe comparison works", () => {
    const token = "a-random-device-token";
    const hash = cryptoModule.sha256(token);
    expect(cryptoModule.safeEqualHash(token, hash)).toBe(true);
    expect(cryptoModule.safeEqualHash(`${token}x`, hash)).toBe(false);
  });
});

describe("password policy", () => {
  test("accepts a strong password", () => {
    expect(cryptoModule.checkPasswordStrength("MistBridge!Ops2026", "admin").ok).toBe(true);
  });

  test("rejects short, common, and username-containing passwords", () => {
    expect(cryptoModule.checkPasswordStrength("Short1!", "admin").ok).toBe(false);
    expect(cryptoModule.checkPasswordStrength("Password12345", "admin").ok).toBe(false);
    expect(cryptoModule.checkPasswordStrength("Admin-123456789", "admin").ok).toBe(false);
    expect(cryptoModule.checkPasswordStrength("alllowercaseletters", "admin").ok).toBe(false);
  });

  test("generated passwords satisfy the policy and hash/verify with Argon2", async () => {
    const password = cryptoModule.generatePassword(20);
    expect(cryptoModule.checkPasswordStrength(password, "operator").ok).toBe(true);
    const hash = await cryptoModule.hashPassword(password);
    expect(await cryptoModule.verifyPassword(password, hash)).toBe(true);
    expect(await cryptoModule.verifyPassword(`${password}!`, hash)).toBe(false);
  });
});
