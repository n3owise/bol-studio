import { resolve } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderFrames, renderMedia, selectComposition, ensureBrowser, makeCancelSignal } from '@remotion/renderer';
import { availableParallelism } from 'node:os';
import type { Settings, Word } from '../src/lib/types.ts';

const ENTRY = resolve(process.cwd(), 'src/remotion/index.ts');
const COMPOSITION_ID = 'Captions';

let bundlePromise: Promise<string> | null = null;

export function captionRenderConcurrency(width: number, height: number): number {
  return width * height > 1920 * 1080 ? 1 : 2;
}

// Prefer the matching Remotion browser so lossless shared-memory capture is available.
export function captionBrowserExecutable(): string | undefined {
  return process.env.BOL_BROWSER_EXECUTABLE || undefined;
}

export function directCaptionConcurrency(): number {
  const configured = Number(process.env.BOL_RENDER_CONCURRENCY ?? Math.min(process.platform === 'linux' ? 2 : 4, availableParallelism()));
  if (!Number.isInteger(configured) || configured < 1 || configured > 4) {
    throw new Error('BOL_RENDER_CONCURRENCY must be between 1 and 4.');
  }
  return configured;
}

/** The matching Remotion browser and encoder exchange lossless pixel buffers. */
export async function renderGreenCaptionVideo(options: {
  words: Word[]; settings: Settings; width: number; height: number; fps: number;
  frameCount: number; output: string;
  onProgress?: (progress: number) => void; onStage?: (stage: string) => void;
}) {
  const { words, settings, width, height, fps, frameCount, output } = options;
  const browserExecutable = captionBrowserExecutable();
  options.onStage?.('browser');
  await ensureBrowser({ browserExecutable });
  options.onStage?.('bundling');
  const serveUrl = await captionBundle();
  const inputProps = { words, settings, background: '#00ff00', width, height, durationInFrames: frameCount };
  options.onStage?.('composition');
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable });
  options.onStage?.('frames');
  await renderMedia({
    composition: { ...composition, width, height, fps, durationInFrames: frameCount },
    serveUrl, inputProps, browserExecutable, outputLocation: output,
    codec: 'h264', crf: 18, pixelFormat: 'yuv420p', x264Preset: 'veryfast',
    imageFormat: 'png', muted: true, concurrency: directCaptionConcurrency(),
    onProgress: ({ progress }) => options.onProgress?.(7 + Math.floor(progress * 91)),
    ffmpegOverride: ({ args }) => [...args.slice(0, -1), '-threads', '2', args[args.length - 1]],
    envVariables: process.env.BOL_LOCAL_FONTS === '1' ? { BOL_LOCAL_FONTS: '1' } : {},
  });
  options.onProgress?.(100);
}

/**
 * Bundle the caption composition once per process. It only depends on source
 * files, never on the project being rendered.
 */
export function captionBundle(onProgress?: (percent: number) => void): Promise<string> {
  bundlePromise ??= bundle({
    entryPoint: ENTRY,
    // Named explicitly. Remotion did not pick the project's own public/ up from
    // the entry point's location, so files referenced by runtime URL — the
    // local-only faces — 404ed inside the renderer and every frame came out in
    // a fallback face, which looks like nothing at all going wrong.
    publicDir: resolve(process.cwd(), 'public'),
    onProgress: percent => onProgress?.(percent),
  });
  return bundlePromise;
}

/**
 * Deliver frames to `onFrame` in index order, one at a time.
 *
 * Remotion renders frames concurrently and delivers them out of order, so they
 * are held until the next expected index arrives. The subtle part is the "one
 * at a time": an earlier version ran the same loop directly inside each
 * concurrent delivery, which dispatched frames in the right order but left
 * several `onFrame` bodies running at once as soon as one of them awaited.
 *
 * That is not merely untidy — the consumer composites every frame onto a single
 * shared canvas, so a second call reaching `clearRect` while the first was
 * awaiting its caption image wiped a half-drawn frame. Roughly one frame in
 * twenty came out blank or missing its caption, scattered irregularly through
 * the export, which is exactly how a race looks from the outside.
 *
 * Chaining onto `queue` keeps exactly one `onFrame` in flight. Callers await
 * what `push` returns, which also applies backpressure: a slow consumer stops
 * the renderer rather than letting the held map grow without bound.
 */
export function createOrderedDispatcher(onFrame: (index: number, png: Buffer) => Promise<void>) {
  const pending = new Map<number, Buffer>();
  let next = 0;
  let queue: Promise<void> = Promise.resolve();
  let failure: unknown;

  const push = (index: number, png: Buffer): Promise<void> => {
    if (failure) return Promise.reject(failure);
    pending.set(index, png);
    queue = queue.then(async () => {
      if (failure) return;
      while (pending.has(next)) {
        const buffer = pending.get(next)!;
        pending.delete(next);
        const current = next;
        next += 1;
        await onFrame(current, buffer);
      }
    }).catch(error => { failure ??= error; });
    return queue.then(() => { if (failure) throw failure; });
  };

  return {
    push,
    /** Wait for everything already pushed to finish being delivered. */
    settle: () => queue.then(() => { if (failure) throw failure; }),
    /** How many frames have been handed to `onFrame`. */
    get delivered() { return next; },
    /** How many arrived early and are still waiting their turn. */
    get held() { return pending.size; },
  };
}

/**
 * Render the caption layer and hand each frame to `onFrame` **in order**.
 *
 * Frames are streamed, never staged on disk. Writing a PNG per frame cost about
 * 74 KB each, which is 5 GB of temporary files for a twenty-minute export — the
 * longest clip this app accepts.
 */
export async function streamCaptionFrames(options: {
  words: Word[];
  settings: Settings;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  background?: string;
  onFrame: (index: number, png: Buffer) => Promise<void>;
  concurrency?: number;
  onProgress?: (rendered: number) => void;
  signal?: AbortSignal;
  onStage?: (stage: 'browser' | 'bundling' | 'composition' | 'frames') => void;
}): Promise<void> {
  const { words, settings, width, height, fps, frameCount, onFrame } = options;
  const browserExecutable = captionBrowserExecutable();
  options.onStage?.('browser');
  await ensureBrowser({ browserExecutable });
  options.onStage?.('bundling');
  const serveUrl = await captionBundle();

  const inputProps = {
    words,
    settings,
    background: options.background ?? 'transparent',
    width,
    height,
    durationInFrames: frameCount,
  } as unknown as Record<string, unknown>;

  options.onStage?.('composition');
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable });

  const dispatcher = createOrderedDispatcher(onFrame);
  const { cancelSignal, cancel } = makeCancelSignal();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();

  options.onStage?.('frames');
  try {
    await renderFrames({
      composition: { ...composition, width, height, fps, durationInFrames: frameCount },
      serveUrl,
      browserExecutable,
      inputProps,
      outputDir: null,
      imageFormat: 'png',
      // Awaiting the push is what applies backpressure: Remotion will not run
      // ahead of the encoder at 4K, where only one browser page is used.
      onFrameBuffer: (buffer: Buffer, frameIndex: number) => dispatcher.push(frameIndex, buffer),
      onFrameUpdate: rendered => options.onProgress?.(rendered),
      onStart: () => undefined,
      concurrency: options.concurrency ?? captionRenderConcurrency(width, height),
      cancelSignal,
      // Faces licensed for this machine only, if this machine says so. The bundle
      // reads nothing else to decide, so a deployment that does not set the
      // variable renders without them however it was built.
      envVariables: process.env.BOL_LOCAL_FONTS === '1' ? { BOL_LOCAL_FONTS: '1' } : {},
    });
  } finally {
    options.signal?.removeEventListener('abort', cancel);
  }

  // Anything still held back means Remotion delivered fewer frames than the
  // composition declares; surface it rather than writing a short video.
  await dispatcher.settle();
  if (dispatcher.delivered !== frameCount) {
    throw new Error(`The caption renderer produced ${dispatcher.delivered} of ${frameCount} frames.`);
  }
}
