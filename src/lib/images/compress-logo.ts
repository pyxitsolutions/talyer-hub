import { MAX_LOGO_SIZE, normalizeLogoMimeType } from "@/lib/supabase/logo-file";

/** Max width/height after resize — enough for sidebar, PDF, and verify page. */
const MAX_LOGO_DIMENSION = 512;

/** Target compressed size; we iterate quality/size until under this when possible. */
const TARGET_MAX_BYTES = 500 * 1024;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to compress image"));
      },
      type,
      quality
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

function drawToCanvas(
  img: HTMLImageElement,
  maxDimension: number
): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to process image");
  }

  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

async function compressRasterLogo(file: File): Promise<File> {
  const img = await loadImage(file);
  const mime = normalizeLogoMimeType(file);
  const preferPng = mime === "image/png" || mime === "image/webp";
  let maxDimension = MAX_LOGO_DIMENSION;

  while (maxDimension >= 128) {
    const canvas = drawToCanvas(img, maxDimension);

    if (preferPng) {
      const pngBlob = await canvasToBlob(canvas, "image/png");
      if (pngBlob.size <= TARGET_MAX_BYTES || maxDimension === 128) {
        return new File([pngBlob], replaceExtension(file.name, "png"), {
          type: "image/png",
        });
      }
    } else {
      for (const quality of [0.88, 0.8, 0.72, 0.64, 0.56]) {
        const jpegBlob = await canvasToBlob(canvas, "image/jpeg", quality);
        if (jpegBlob.size <= TARGET_MAX_BYTES) {
          return new File([jpegBlob], replaceExtension(file.name, "jpg"), {
            type: "image/jpeg",
          });
        }
      }

      const fallback = await canvasToBlob(canvas, "image/jpeg", 0.5);
      if (fallback.size <= MAX_LOGO_SIZE || maxDimension === 128) {
        return new File([fallback], replaceExtension(file.name, "jpg"), {
          type: "image/jpeg",
        });
      }
    }

    maxDimension = Math.round(maxDimension * 0.75);
  }

  throw new Error("Could not compress image enough. Try a simpler logo.");
}

function replaceExtension(filename: string, extension: string): string {
  const base = filename.replace(/\.[^.]+$/, "") || "logo";
  return `${base}.${extension}`;
}

/**
 * Accepts large images, resizes/compresses raster logos in the browser,
 * then returns a file ready for Supabase Storage (≤ 2MB).
 */
export async function prepareLogoForUpload(file: File): Promise<File> {
  const mime = normalizeLogoMimeType(file);

  if (mime === "image/svg+xml") {
    if (file.size > MAX_LOGO_SIZE) {
      throw new Error("SVG logo must be 2MB or smaller.");
    }
    return file;
  }

  if (file.size <= TARGET_MAX_BYTES) {
    const img = await loadImage(file);
    if (img.width <= MAX_LOGO_DIMENSION && img.height <= MAX_LOGO_DIMENSION) {
      return file;
    }
  }

  return compressRasterLogo(file);
}
