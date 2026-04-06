import crypto from "crypto";

const IV_LENGTH = 16;

function normalizeKey(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(plainText: string, secret: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", normalizeKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptText(cipherText: string, secret: string) {
  const [ivHex, encryptedHex] = cipherText.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted value.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    normalizeKey(secret),
    Buffer.from(ivHex, "hex")
  );

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
