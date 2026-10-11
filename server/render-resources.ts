export class RenderResourceError extends Error {
  constructor(public readonly resourceError: 'visual_assets' | 'video_decoders' | 'rgba_pixels', message: string) { super(message); }
}
/** Limits describe compositor RGBA frames, separately from codec-internal memory. */
export type VideoResource = { id: string; width: number; height: number; startFrame: number; endFrame: number };
export type RenderResourceLimits = { decoders: number; pixels: number; visualAssets?: number };
export function renderResourceLimits(env: Record<string, string | undefined> = process.env): RenderResourceLimits {
  const positive = (name: string, fallback: number) => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
    return value;
  };
  return { decoders: positive('BOL_MAX_RENDER_VIDEO_DECODERS', 8), pixels: positive('BOL_MAX_RENDER_DECODED_PIXELS', 24000000), visualAssets: positive('BOL_MAX_RENDER_VISUAL_ASSETS', 64) };
}
export function fitDecodedVideo(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) {
  if (![sourceWidth, sourceHeight, maxWidth, maxHeight].every(n => Number.isFinite(n) && n >= 2)) throw new Error('Media has invalid video dimensions.');
  const ratio = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  return { width: Math.max(2, Math.floor(sourceWidth * ratio)), height: Math.max(2, Math.floor(sourceHeight * ratio)) };
}
/** endFrame is exclusive. Remotion timestamps are integer frames, avoiding boundary ambiguity. */
export function validateRenderResources(outputWidth: number, outputHeight: number, videos: VideoResource[], limits = renderResourceLimits(), images: Array<{ width: number; height: number }> = []) {
  const visualCount = videos.length + images.length;
  if (visualCount > (limits.visualAssets ?? 64)) throw new RenderResourceError('visual_assets', `This export has ${visualCount} visual assets; the limit is ${limits.visualAssets ?? 64}. Remove unused layers or split the scene.`);
  // Images are preloaded at native dimensions; count all of them, including sequential placements.
  const outputPixels = outputWidth * outputHeight + images.reduce((sum, image) => sum + image.width * image.height, 0);
  const events = videos.flatMap(video => video.endFrame > video.startFrame ? [
    { frame: video.startFrame, count: 1, pixels: video.width * video.height },
    { frame: video.endFrame, count: -1, pixels: -video.width * video.height },
  ] : []).sort((a, b) => a.frame - b.frame || a.count - b.count);
  let count = 0, pixels = outputPixels, maxCount = 0, maxPixels = outputPixels;
  for (const event of events) {
    count += event.count; pixels += event.pixels;
    maxCount = Math.max(maxCount, count); maxPixels = Math.max(maxPixels, pixels);
  }
  if (maxCount > limits.decoders) throw new RenderResourceError('video_decoders', `This export needs ${maxCount} simultaneous video decoders; the limit is ${limits.decoders}. Reduce overlapping video layers or split the scene.`);
  if (maxPixels > limits.pixels) throw new RenderResourceError('rgba_pixels', `This export needs ${maxPixels} RGBA frame pixels; the limit is ${limits.pixels}. Choose a lower export resolution, reduce video layer scale, or reduce overlapping videos, or use smaller images.`);
  return { maxDecoders: maxCount, maxPixels };
}
