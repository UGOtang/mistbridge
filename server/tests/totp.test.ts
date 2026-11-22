import { describe, expect, test } from "bun:test";
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  totpCode,
  verifyTotp,
} from "../src/totp";

describe("base32", () => {
  test("round-trips arbitrary bytes", () => {
    const input = Buffer.from("MistBridge-TOTP-0123456789");
    expect(base32Decode(base32Encode(input)).toString("utf8")).toBe(input.toString("utf8"));
  });
});

describe("TOTP", () => {
  // RFC 6238 SHA-1 test secret for the ASCII string "12345678901234567890".
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  test("matches the RFC 6238 six-digit vector", () => {
    expect(totpCode(secret, 59_000)).toBe("287082");
  });

  test("accepts the adjacent time window but rejects bad input", () => {
    const now = 1_700_000_000_000;
    const code = totpCode(secret, now);
    expect(verifyTotp(secret, code, 1, now)).toBe(true);
    expect(verifyTotp(secret, "12345", 1, now)).toBe(false);
    expect(verifyTotp(secret, "not-a-code", 1, now)).toBe(false);
  });
});

describe("recovery codes", () => {
  test("creates ten unique, formatted, normalizable codes", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      expect(normalizeRecoveryCode(code.toLowerCase().replace("-", " "))).toMatch(/^[A-Z2-9]{10}$/);
    }
  });
});
