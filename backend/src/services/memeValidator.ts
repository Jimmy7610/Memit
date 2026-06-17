export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateMemeFile(
  mimetype: string,
  sizeBytes: number
): ValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    return {
      valid: false,
      reason: "Only JPEG, PNG, GIF, and WebP images are allowed.",
    };
  }
  if (sizeBytes > MAX_SIZE_BYTES) {
    return { valid: false, reason: "File too large. Max 10MB." };
  }
  return { valid: true };
}

export function getExtensionFromMime(mimetype: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mimetype] ?? "png";
}
