import { resolve } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition, ensureBrowser } from '@remotion/renderer';
import type { Settings, Word } from '../src/lib/types.ts';

const ENTRY = resolve(process.cwd(), 'src/remotion/index.ts');
const COMPOSITION_ID = 'Captions';

let bundlePromise: Promise<string> | null = null;

/**
 * Bundle the caption composition once per process. It only depends on source
 * files, never on the project being rendered.
 */
export function captionBundle(onProgress?: (percent: number) => void): Promise<string> {
  bundlePromise ??= bundle({
    entryPoint: ENTRY,
    onProgress: percent => onProgress?.(percent),
  });
  return bundlePromise;
}

/**
 * Render the caption layer and hand each frame to `onFrame` **in order**.
 *
 * Frames are streamed, never staged on disk. Writing a PNG per frame cost about
 * 74 KB each, which is 5 GB of temporary files for a twenty-minute export — the
 * longest clip this app accepts. Remotion renders frames concurrently and so
 * delivers them out of order; they are held in a small map until the next
 * expected index arrives, and because `onFrameBuffer` may return a promise,
 * awaiting the drain also applies backpressure so a slow consumer cannot make
 * that map grow without bound.
 */
export async function streamCaptionFrames(options: {
  words: Word[];
  settings: Settings;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  onFrame: (index: number, png: Buffer) => Promise<void>;
  concurrency?: number;
  onProgress?: (rendered: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { words, settings, width, height, fps, frameCount, onFrame } = options;
  await ensureBrowser();
  const serveUrl = await captionBundle();

  const inputProps = {
    words,
    settings,
    background: 'transparent',
    width,
    height,
    durationInFrames: frameCount,
  } as unknown as Record<string, unknown>;

  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });

  const pending = new Map<number, Buffer>();
  let next = 0;
  let failure: unknown;

  const drain = async () => {
    while (pending.has(next)) {
      const png = pending.get(next)!;
      pending.delete(next);
      const index = next;
      next += 1;
      await onFrame(index, png);
    }
  };

  await renderFrames({
    composition: { ...composition, width, height, fps, durationInFrames: frameCount },
    serveUrl,
    inputProps,
    outputDir: null,
    imageFormat: 'png',
    onFrameBuffer: async (buffer: Buffer, frameIndex: number) => {
      if (failure) throw failure;
      pending.set(frameIndex, buffer);
      try {
        await drain();
      } catch (error) {
        failure ??= error;
        throw error;
      }
    },
    onFrameUpdate: rendered => options.onProgress?.(rendered),
    onStart: () => undefined,
    concurrency: options.concurrency ?? null,
    cancelSignal: options.signal as never,
  });

  if (failure) throw failure;
  // Anything still held back means Remotion delivered fewer frames than the
  // composition declares; surface it rather than writing a short video.
  await drain();
  if (next !== frameCount) {
    throw new Error(`The caption renderer produced ${next} of ${frameCount} frames.`);
  }
}
