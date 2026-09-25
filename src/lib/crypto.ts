import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encryption at rest for secrets we must be able to read back: a seller's
// gateway credentials, card number and Sheba (docs/phase2/README.md, rule 1).
//
// AES-256-GCM with a random 12-byte IV per value. The auth tag makes any
// change to the stored value (or the wrong key) fail loudly instead of
// decrypting to garbage. Format: "v1." + base64url(iv | tag | ciphertext);
// the version prefix leaves room for key rotation.

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(): Buffer {
  const raw = process.env.SECRETS_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (buf.length !== 32) {
    throw new Error("SECRETS_KEY must be 32 bytes, base64-encoded (see .env.example)");
  }
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

/** Throws if the value was changed, was encrypted with another key, or isn't ours. */
export function decryptSecret(stored: string): string {
  const [version, payload] = stored.split(".");
  if (version !== VERSION || !payload) throw new Error("Unknown secret format");
  const raw = Buffer.from(payload, "base64url");
  if (raw.length < IV_BYTES + TAG_BYTES) throw new Error("Secret is too short");

  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, IV_BYTES));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}

/** "6037991234567890" -> "•••• 7890": the most a secret may ever show after saving. */
export function lastFour(value: string): string {
  return `•••• ${value.slice(-4)}`;
}
