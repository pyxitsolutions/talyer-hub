const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

export const MAX_LOGO_SIZE = 2 * 1024 * 1024;

export function getLogoExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

export function normalizeLogoMimeType(file: File): string {
  if (file.type && ALLOWED_LOGO_TYPES.has(file.type)) {
    return file.type === "image/jpg" ? "image/jpeg" : file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return file.type || "image/png";
  }
}

export function validateLogoFile(file: File): string | null {
  if (file.size === 0) {
    return "Please choose a logo file.";
  }

  if (
    !ALLOWED_LOGO_TYPES.has(file.type) &&
    !file.name.match(/\.(png|jpe?g|webp|svg)$/i)
  ) {
    return "Invalid file type. Use PNG, JPG, WEBP, or SVG.";
  }

  if (file.size > MAX_LOGO_SIZE) {
    return "Logo must be 2MB or smaller.";
  }

  return null;
}
