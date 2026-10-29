import sharp from 'sharp';

const OUT_W = 600;
const OUT_H = 400;

/**
 * Crops and resizes an uploaded image into the exact 600x400 PNG the
 * business requires, using Sharp's high-quality resampling — this is the
 * server-side replacement for the Canvas-based logic in the original POC.
 *
 * @param {Buffer} inputBuffer - the original uploaded file's bytes
 * @param {{left:number, top:number, width:number, height:number}} crop
 *   The exact source-pixel rectangle to keep, already computed by the
 *   browser's crop editor (same 3:2 math as the POC). For images that were
 *   already 3:2, the browser sends the full image as the "crop" (left:0,
 *   top:0, width: originalWidth, height: originalHeight) — so this
 *   function never needs to guess or branch on aspect ratio itself.
 * @returns {Promise<{ buffer: Buffer, originalMeta: sharp.Metadata }>}
 */
export async function processImage(inputBuffer, crop) {
  const source = sharp(inputBuffer, { failOn: 'none' });
  const originalMeta = await source.metadata();

  if (
    !crop ||
    typeof crop.left !== 'number' ||
    typeof crop.top !== 'number' ||
    typeof crop.width !== 'number' ||
    typeof crop.height !== 'number' ||
    crop.width <= 0 ||
    crop.height <= 0
  ) {
    throw new Error('Invalid crop rectangle received from the browser.');
  }

  // Clamp the crop rectangle to the image bounds so a rounding error
  // client-side can never ask Sharp to read outside the actual image.
  const left = Math.max(0, Math.min(Math.round(crop.left), originalMeta.width - 1));
  const top = Math.max(0, Math.min(Math.round(crop.top), originalMeta.height - 1));
  const width = Math.max(1, Math.min(Math.round(crop.width), originalMeta.width - left));
  const height = Math.max(1, Math.min(Math.round(crop.height), originalMeta.height - top));

  const buffer = await sharp(inputBuffer, { failOn: 'none' })
    .extract({ left, top, width, height })
    .resize(OUT_W, OUT_H, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer();

  return { buffer, originalMeta };
}

export const OUTPUT_WIDTH = OUT_W;
export const OUTPUT_HEIGHT = OUT_H;
