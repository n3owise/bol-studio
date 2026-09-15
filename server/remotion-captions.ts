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

  const dispatcher = createOrderedDispatcher(onFrame);

  await renderFrames({
    composition: { ...composition, width, height, fps, durationInFrames: frameCount },
    serveUrl,
    inputProps,
    outputDir: null,
    imageFormat: 'png',
    // Awaiting the push is what applies backpressure: Remotion will not run
    // ahead of the encoder, so the held map stays small.
    onFrameBuffer: (buffer: Buffer, frameIndex: number) => dispatcher.push(frameIndex, buffer),
    onFrameUpdate: rendered => options.onProgress?.(rendered),
    onStart: () => undefined,
    concurrency: options.concurrency ?? null,
    cancelSignal: options.signal as never,
  });

  // Anything still held back means Remotion delivered fewer frames than the
  // composition declares; surface it rather than writing a short video.
  await dispatcher.settle();
  if (dispatcher.delivered !== frameCount) {
    throw new Error(`The caption renderer produced ${dispatcher.delivered} of ${frameCount} frames.`);
  }
}
