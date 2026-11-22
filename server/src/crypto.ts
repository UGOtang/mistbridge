import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config";

const KEY = Buffer.from(config.encryptionKey, "base64");

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomId(prefix: string, bytes = 9): string {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function safeEqualHash(value: string, expectedHash: string): boolean {
  return safeEqual(sha256(value), expectedHash);
}

/** AES-256-GCM at rest; output is versioned so the format can evolve. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  const [version, ivRaw, tagRaw, payloadRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !payloadRaw) throw new Error("invalid encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payloadRaw, "base64url")), decipher.final()]).toString("utf8");
}

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "123456789012",
  "qwertyuiop12",
  "adminadmin12",
  "letmein12345",
  "welcome12345",
  "password12345",
  "password123456",
  "qwerty123456",
  "admin123456",
]);

export function checkPasswordStrength(password: string, username: string): PasswordCheck {
  if (password.length < 12) return { ok: false, message: "密码至少 12 位" };
  if (password.length > 128) return { ok: false, message: "密码不能超过 128 位" };
  if (password.toLowerCase().includes(username.toLowerCase())) {
    return { ok: false, message: "密码不能包含用户名" };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: "这个密码太常见了，请换一个" };
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes < 3) {
    return { ok: false, message: "密码需包含大写字母、小写字母、数字、符号中的至少三类" };
  }
  return { ok: true };
}

export function generatePassword(length = 18): string {
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@%+_-";
  const all = lowercase + uppercase + digits + symbols;
  const pick = (alphabet: string): string => {
    const byte = randomBytes(1)[0] ?? 0;
    return alphabet[byte % alphabet.length] ?? alphabet[0]!;
  };
  const chars = [pick(lowercase), pick(uppercase), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = (randomBytes(1)[0] ?? 0) % (index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex]!, chars[index]!];
  }
  return chars.join("");
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 3,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}
