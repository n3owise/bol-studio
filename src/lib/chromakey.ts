import type { GreenScreenSettings } from './types';

/**
 * Parses a 6-character hex color "#RRGGBB" into RGB tuple [r, g, b].
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b];
}

/**
 * Converts RGB to hex string "#RRGGBB".
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Reusable offscreen canvas for frame processing
let offscreenCanvas: any = null;
let offscreenCtx: any = null;
type CanvasFactory = (width: number, height: number) => { canvas: any; ctx: any };
let customCanvasFactory: CanvasFactory | null = null;

export function setChromaKeyCanvasFactory(factory: CanvasFactory | null) {
  customCanvasFactory = factory;
  offscreenCanvas = null;
  offscreenCtx = null;
}

function getOffscreen(width: number, height: number): { canvas: any; ctx: any } {
  if (customCanvasFactory) {
    return customCanvasFactory(width, height);
  }
  if (!offscreenCanvas) {
    if (typeof document !== 'undefined') {
      offscreenCanvas = document.createElement('canvas');
    }
  }
  if (offscreenCanvas) {
    if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
    }
    if (!offscreenCtx) {
      offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true })!;
    }
    return { canvas: offscreenCanvas, ctx: offscreenCtx };
  }
  throw new Error('Canvas not supported in this environment without setChromaKeyCanvasFactory');
}

/**
 * Applies non-destructive chroma key filtering directly to an ImageData object.
 */
export function processChromaKeyData(
  imageData: ImageData,
  config: GreenScreenSettings
): void {
  const data = imageData.data;
  const [keyR, keyG, keyB] = hexToRgb(config.color);

  // Map tolerance (0-100) to Euclidean distance threshold (0 to 220)
  const tolDist = (config.tolerance / 100) * 220;
  const softness = config.smoothEdges ? 24 : 6;
  const spill = config.spillReduction;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr = r - keyR;
    const dg = g - keyG;
    const db = b - keyB;
    // Euclidean distance in color space
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist <= tolDist) {
      // Complete transparency
      data[i + 3] = 0;
    } else if (dist < tolDist + softness) {
      // Soft alpha interpolation
      const alphaFactor = (dist - tolDist) / softness;
      data[i + 3] = Math.round(data[i + 3] * alphaFactor);

      // Despill on soft boundary
      if (spill && g > (r + b) / 2) {
        data[i + 1] = Math.round((r + b) / 2);
      }
    } else if (spill && g > (r + b) / 2) {
      // Despill on surrounding hair/edge reflection
      data[i + 1] = Math.round((r + b) / 2);
    }
  }
}

/**
 * Applies chroma key to an existing Canvas 2D context in-place.
 */
export function applyChromaKey(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: GreenScreenSettings
): void {
  if (!config.enabled) return;
  const imgData = ctx.getImageData(0, 0, width, height);
  processChromaKeyData(imgData, config);
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Samples the color at normalized coordinate (xRatio, yRatio) from image or video.
 */
export function samplePixelColor(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  xRatio: number,
  yRatio: number
): string {
  const { ctx } = getOffscreen(1, 1);
  const px = Math.max(0, Math.min(sourceWidth - 1, Math.round(xRatio * sourceWidth)));
  const py = Math.max(0, Math.min(sourceHeight - 1, Math.round(yRatio * sourceHeight)));

  ctx.clearRect(0, 0, 1, 1);
  ctx.drawImage(source, px, py, 1, 1, 0, 0, 1, 1);
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  return rgbToHex(pixel[0], pixel[1], pixel[2]);
}

/**
 * Draws an image or video frame onto target canvas, applying chroma key if enabled.
 */
export function drawKeyedMedia(
  targetCtx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
  config?: GreenScreenSettings
): void {
  if (!config || !config.enabled) {
    targetCtx.drawImage(source, dx, dy, dWidth, dHeight);
    return;
  }

  const { canvas: offCanvas, ctx: offCtx } = getOffscreen(dWidth, dHeight);
  offCtx.clearRect(0, 0, dWidth, dHeight);
  offCtx.drawImage(source, 0, 0, dWidth, dHeight);

  const imgData = offCtx.getImageData(0, 0, dWidth, dHeight);
  processChromaKeyData(imgData, config);
  offCtx.putImageData(imgData, 0, 0);

  targetCtx.drawImage(offCanvas, dx, dy, dWidth, dHeight);
}
