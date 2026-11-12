import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import CryptoJS from "crypto-js";

const VERSION_PREFIX = "enc:v1:";

function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET must be configured on the server.");
  }
  return secret;
}

function getEncryptionKey(): Buffer {
  return createHash("sha256").update(getEncryptionSecret(), "utf8").digest();
}

export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function decrypt(ciphertext: string): string {
  if (ciphertext.startsWith(VERSION_PREFIX)) {
    const payload = Buffer.from(ciphertext.slice(VERSION_PREFIX.length), "base64");
    if (payload.length < 28) throw new Error("Invalid encrypted value.");
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }

  // Existing records use CryptoJS passphrase encryption. Keep them readable
  // while deployments move from NEXT_PUBLIC_ENCRYPTION_SECRET to ENCRYPTION_SECRET.
  // Basic share links created before at-rest encryption stored plaintext values.
  if (!ciphertext.startsWith("U2Fsd")) return ciphertext;
  const plaintext = CryptoJS.AES.decrypt(ciphertext, getEncryptionSecret()).toString(CryptoJS.enc.Utf8);
  if (!plaintext && ciphertext) throw new Error("Unable to decrypt stored value.");
  return plaintext;
}
