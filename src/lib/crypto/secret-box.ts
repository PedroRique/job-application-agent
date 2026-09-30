import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";

function encryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new AppError("Token encryption is not configured.", 503, "encryption_not_configured");
  }
  return key;
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string) {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) {
    throw new AppError("Outlook session expired. Connect Outlook again.", 401, "oauth_expired");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Outlook session expired. Connect Outlook again.", 401, "oauth_expired");
  }
}
