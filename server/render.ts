import { fitDecodedVideo, renderResourceLimits, validateRenderResources, RenderResourceError } from './render-resources.ts';
import { spawn, execFile } from 'node:child_process';
import { readFile, access, mkdir, rm, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { orderedElements } from '../src/lib/media-scene.ts';
import { pathToFileURL } from 'node:url';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { dimensions, templates } from '../src/lib/captions.ts';
import { streamCaptionFrames, renderGreenCaptionVideo } from './remotion-captions.ts';
import { drawKeyedMedia, setChromaKeyCanvasFactory } from '../src/lib/chromakey.ts';
import type { Project, Settings, Word } from '../src/lib/types.ts';

setChromaKeyCanvasFactory((w, h) => {
  const c = createCanvas(w, h);
  return { canvas: c, ctx: c.getContext('2d') };
});

const require = createRequire(import.meta.url);
/**
 * Default and reference frame rate. Callers may pick 24/25/30/50/60, but 60 is
 * the default because captions enter word by word: a 0.42s preset entrance is
 * 25 frames at 60 and 12 at 30, where it reads as stepped.
 */
const FPS = 60;
const BACKGROUND = '#111315';
export type RenderMode = 'burned' | 'green';
export function canRenderGreenDirectly(project: Project, mode: RenderMode): boolean {
  return mode === 'green' && !(project.canvasElements ?? []).some(element => element.visible !== false);
}
let fontsRegistered = false;

/** Resolve only registered visual assets, and reject symlinks outside this project. */
export async function resolveCanvasAssetPath(project: Project, projectDir: string, assetId: string): Promise<string | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(assetId)) return null;
  const asset = project.mediaAssets?.find(a => a.id === assetId);
  if (!asset || !['image', 'video'].includes(asset.mediaType)) return null;
  const source = (asset as typeof asset & { sourceFile?: string }).sourceFile;
  if (!source || !new RegExp(`^assets/${assetId}\\.[a-zA-Z0-9]+$`).test(source)) return null;
  try {
    const root = await realpath(projectDir);
    const assets = await realpath(resolve(root, 'assets'));
    if (assets !== resolve(root, 'assets')) return null;
    const path = await realpath(resolve(root, source));
    return path.startsWith(assets + sep) ? path : null;
  } catch { return null; }
}

/** Use the same bundled font files as the browser, including Hindi glyphs. */
export function registerRenderFonts() {
  if (fontsRegistered) return;
  const fonts = [
    ['@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff', 'DM Sans'],
    ['@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff', 'Noto Sans Devanagari'],
    ['@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff', 'Space Grotesk'],
    ['@fontsource/oswald/files/oswald-latin-700-normal.woff', 'Oswald'],
    ['@fontsource/montserrat/files/montserrat-latin-900-normal.woff', 'Montserrat'],
    ['@fontsource/stix-two-text/files/stix-two-text-latin-600-normal.woff', 'STIX Two Text'],
    ['@fontsource/montserrat/files/montserrat-latin-900-normal.woff', 'Montserrat'],
    ['@fontsource/montserrat/files/montserrat-latin-800-normal.woff', 'Montserrat'],
  ];
  for (const [file, family] of fonts) {
    try {
      GlobalFonts.registerFromPath(require.resolve(file), family);
    } catch {
      // Non-critical if secondary font file not found
    }
  }
  fontsRegistered = true;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteBetween(value: unknown, low: number, high: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
}

/** Validate a saved snapshot before allocating canvases or starting FFmpeg. */
export function validateRenderProject(value: unknown): Project {
  if (!record(value)) throw new Error('The export snapshot must be a project object.');
  if (!finiteBetween(value.duration, 1 / FPS, 14400)) throw new Error('The project duration must be between one frame and four hours.');
  if (!finiteBetween(value.width, 1, 16384) || !finiteBetween(value.height, 1, 16384)) {
    throw new Error('The project must have valid source dimensions.');
  }
  if (value.width / value.height < .125 || value.width / value.height > 8) {
    throw new Error('Export supports source aspect ratios between 1:8 and 8:1.');
  }
  if (typeof value.mediaType !== 'string' || !/^(video|audio)(\/|$)/.test(value.mediaType)) {
    throw new Error('The source media type must be video or audio.');
  }
  if (value.videoEnabled !== undefined && typeof value.videoEnabled !== 'boolean') {
    throw new Error('The video layer setting must be boolean.');
  }
  const s = value.settings;
  if (!record(s) || !templates.some(t => t.id === s.template)
    || typeof s.accent !== 'string' || !/^#[\da-f]{6}$/i.test(s.accent)
    || !finiteBetween(s.fontSize, 12, 160) || !finiteBetween(s.position, 0, 100)
    || (s.positionX !== undefined && !finiteBetween(s.positionX, 0, 100))
    || (s.align !== undefined && !['left', 'center', 'right'].includes(String(s.align)))
    || !finiteBetween(s.wordsPerLine, 1, 12) || !Number.isInteger(s.wordsPerLine)
    || typeof s.uppercase !== 'boolean' || !finiteBetween(s.motion, 0, 3)
    || !['original', '9:16', '1:1', '16:9'].includes(String(s.aspect))) {
    throw new Error('The project contains invalid caption appearance settings.');
  }
  if (!Array.isArray(value.words) || value.words.length > 200000) throw new Error('The project contains an invalid word list.');
  let lastStart = -1;
  for (const w of value.words) {
    if (!record(w) || typeof w.text !== 'string' || !w.text.trim() || w.text.length > 500
      || !finiteBetween(w.start, 0, value.duration) || !finiteBetween(w.end, 0, value.duration + 1)
      || w.end <= w.start || w.start < lastStart || typeof w.emphasis !== 'boolean') {
      throw new Error('Caption words must be ordered, nonempty, and have valid start and end times.');
    }
    lastStart = w.start;
  }
  if (value.canvasElements !== undefined && (!Array.isArray(value.canvasElements) || value.canvasElements.length > 500)) {
    throw new Error('The project contains an invalid canvas elements list.');
  }
  return value as unknown as Project;
}

export function ffmpegArguments(project: Project, input: string, output: string, mode: RenderMode, resolution: number, fps: number = 60, composited = false): string[] {
  const { width, height } = dimensions(project.settings, project.width, project.height, resolution);
  const frameCount = Math.ceil(project.duration * fps);
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`,
    '-framerate', String(fps), '-i', 'pipe:0'];
  if (mode === 'burned') {
    args.push('-i', input);
    if (!composited && project.mediaType.startsWith('video') && project.videoEnabled !== false) {
      // Match the preview's contain behavior, preserving the complete source image.
      args.push('-filter_complex',
        `[1:v:0]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND},fps=${fps},tpad=stop_mode=clone:stop_duration=1[base];[base][0:v:0]overlay=shortest=1:format=auto,format=yuv420p[out]`,
        '-map', '[out]');
    } else {
      args.push('-map', '0:v:0');
    }
    args.push('-map', '1:a:0?', '-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-map', '0:v:0', '-an');
  }
  args.push('-c:v', 'libx264', '-threads', '2', '-filter_threads', '2', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', String(fps), '-frames:v', String(frameCount), '-t', String(frameCount / fps),
    '-movflags', '+faststart', '-f', 'mp4', output);
  return args;
}

/** A bounded frame stream; backpressure keeps long clips out of memory. */
async function probeVideo(path: string) {
  const { stdout } = await promisify(execFile)(process.env.FFPROBE_PATH || 'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path], { timeout: 15000, maxBuffer: 1024 * 1024 });
  const source = JSON.parse(stdout).streams?.[0];
  if (!source?.width || !source?.height) throw new Error('Media has no decodable video track.');
  return { width: Number(source.width), height: Number(source.height) };
}
export async function openVideoFrames(path: string, fps: number, maxWidth: number, loop = true, maxHeight = maxWidth, sourceDimensions?: { width: number; height: number }) {
  const source = sourceDimensions ?? await probeVideo(path);
  const { width, height } = fitDecodedVideo(source.width, source.height, maxWidth, maxHeight);
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  const decoder = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-nostdin',
    ...(loop ? ['-stream_loop', '-1'] : []), '-i', path, '-an', '-vf', `fps=${fps},scale=${width}:${height}`,
    '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = new Promise<void>(resolve => decoder.once('close', () => resolve()));
  let diagnostic = '', failure: Error | undefined;
  decoder.stderr.on('data', b => { diagnostic = (diagnostic + b).slice(-2000); });
  decoder.on('error', e => { failure = e; });
  const iterator = decoder.stdout[Symbol.asyncIterator]();
  let pending = Buffer.alloc(0), index = -1;
  return { canvas, async at(frame: number) {
    while (index < frame) {
      const bytes = width * height * 4, data = Buffer.allocUnsafe(bytes);
      let filled = 0;
      while (filled < bytes) {
        if (!pending.length) {
          const next = await iterator.next();
          if (next.done) {
            if (!loop && index >= 0 && !filled) return canvas;
            throw failure ?? new Error(`Video decoding failed: ${diagnostic}`);
          }
          pending = Buffer.from(next.value);
        }
        const count = Math.min(bytes - filled, pending.length);
        pending.copy(data, filled, 0, count); filled += count; pending = pending.subarray(count);
      }
      const image = ctx.createImageData(width, height); image.data.set(data); ctx.putImageData(image, 0, 0); index++;
    }
    return canvas;
  }, async close() { decoder.stdout.destroy(); decoder.kill('SIGTERM');
    const timer = setTimeout(() => decoder.kill('SIGKILL'), 2000);
    try { await closed; } finally { clearTimeout(timer); }
  } };
}

export async function renderCaptionVideo(options: {
  project: Project; input: string; output: string; mode: RenderMode; resolution: number; fps?: number;
  onProgress?: (progress: number) => void;
  onStage?: (stage: string) => void;
}) {
  const project = validateRenderProject(options.project);
  const { mode, resolution } = options;
  const fps = options.fps ?? 60;
  if (mode !== 'burned' && mode !== 'green') throw new Error('Export mode must be burned or green.');
  if (resolution !== 720 && resolution !== 1080 && resolution !== 2160) {
    throw new Error('Export resolution must be 720, 1080, or 2160.');
  }
  if (![24, 25, 30, 50, 60].includes(fps)) {
    throw new Error('Export frame rate must be 24, 25, 30, 50, or 60 fps.');
  }
  if (mode === 'green' && /^#00ff00$/i.test(project.settings.accent)) {
    throw new Error('Choose a caption accent other than #00ff00 before exporting a green screen video.');
  }
  const input = resolve(options.input), output = resolve(options.output);
  if (input === output) throw new Error('The export path must differ from the original media path.');
  await access(input, constants.R_OK);
  await mkdir(dirname(output), { recursive: true });
  registerRenderFonts();
  const { width, height } = dimensions(project.settings, project.width, project.height, resolution);
  const frameCount = Math.ceil(project.duration * fps);
  const directGreen = canRenderGreenDirectly(project, mode);
  const selectedAsset = project.mediaAssets?.find(a => a.id === project.activeMediaAssetId);
  if (project.activeMediaAssetId && project.activeMediaAssetId !== 'primary' && !selectedAsset) throw new Error('The selected primary media is missing.');
  const selectedPath = selectedAsset ? await resolveCanvasAssetPath(project, dirname(input), selectedAsset.id) : input;
  if (!selectedPath) throw new Error('The selected primary media is unavailable.');
  const elements = orderedElements(project.canvasElements ?? []);
  const videoSpecs = new Map<string, { path: string; source: { width: number; height: number }; width: number; height: number; startFrame: number; endFrame: number }>();
  const resourceLimits = renderResourceLimits();
  const primaryEnabled = mode === 'burned' && project.videoEnabled !== false && project.mediaType.startsWith('video');
  const visibleAssets = elements.filter(element => element.visible !== false).length + (primaryEnabled ? 1 : 0);
  if (visibleAssets > (resourceLimits.visualAssets ?? 64)) throw new RenderResourceError('visual_assets', `This export has ${visibleAssets} visual assets; the limit is ${resourceLimits.visualAssets ?? 64}. Remove unused layers or split the scene.`);
  const imageSpecs: Array<{ width: number; height: number }> = [];
  for (const element of elements) {
    if (element.visible === false) continue;
    if (element.type !== 'video') {
      const path = element.assetId === 'primary' ? input : await resolveCanvasAssetPath(project, dirname(input), element.assetId);
      if (!path) throw new Error('An overlay image is missing or unregistered. Re-add the media and export again.');
      imageSpecs.push(await probeVideo(path));
      continue;
    }
    const startFrame = Math.max(0, Math.ceil((element.start ?? 0) * fps));
    const endFrame = Math.min(frameCount, Math.floor((element.end ?? project.duration) * fps) + 1);
    if (endFrame <= startFrame) continue;
    const path = element.assetId === 'primary' ? input : await resolveCanvasAssetPath(project, dirname(input), element.assetId);
    if (!path) throw new Error('An overlay video is missing or unregistered. Re-add the media and export again.');
    const source = await probeVideo(path);
    const decoded = fitDecodedVideo(source.width, source.height, Math.min(width, width * .32 * (element.scale || 1)), height);
    videoSpecs.set(element.id, { path, source, ...decoded, startFrame, endFrame });
  }
  const primarySource = mode === 'burned' && project.videoEnabled !== false && project.mediaType.startsWith('video')
    ? await probeVideo(selectedPath) : undefined;
  const primaryDecoded = primarySource ? fitDecodedVideo(primarySource.width, primarySource.height, width, height) : undefined;
  validateRenderResources(width, height, [
    ...[...videoSpecs].map(([id, spec]) => ({ id, ...spec })),
    ...(primaryDecoded ? [{ id: 'primary', ...primaryDecoded, startFrame: 0, endFrame: frameCount }] : []),
  ], resourceLimits, imageSpecs);
  if (directGreen) {
    let lastProgress = -1, lastProgressTime = 0;
    const progress = (value: number) => {
      if (value > lastProgress || Date.now() - lastProgressTime >= 5000) {
        lastProgress = Math.max(lastProgress, value); lastProgressTime = Date.now();
        options.onProgress?.(lastProgress);
      }
    };
    try {
      await renderGreenCaptionVideo({
        words: project.words, settings: project.settings, width, height, fps, frameCount, output,
        onProgress: progress,
        onStage: stage => {
          options.onStage?.(stage);
          progress(({ browser: 2, bundling: 3, composition: 5, frames: 7 } as Record<string, number>)[stage]);
        },
      });
    } catch (error) {
      await rm(output, { force: true }).catch(() => undefined);
      throw error;
    }
    return;
  }
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const ffmpeg = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ffmpegArguments(project, selectedPath, output, mode, resolution, fps, true), {
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let errorOutput = '';
  let processError: Error | undefined;
  ffmpeg.stderr.on('data', (data: Buffer) => { errorOutput = (errorOutput + data.toString()).slice(-16000); });
  // A pipe error is surfaced with FFmpeg's diagnostic below, never as an unhandled event.
  ffmpeg.stdin.on('error', (error: Error) => { processError ??= error; });
  const finished = new Promise<number | null>(resolveExit => {
    ffmpeg.once('error', error => { processError = error; });
    ffmpeg.once('close', code => resolveExit(code));
  });
  let lastProgress = -1;
  let lastProgressTime = 0;
  const progress = (value: number) => {
    if (value > lastProgress || Date.now() - lastProgressTime >= 5000) {
      lastProgress = Math.max(lastProgress, value);
      lastProgressTime = Date.now();
      options.onProgress?.(lastProgress);
    }
  };
  progress(0);
  const decoders = new Set<Awaited<ReturnType<typeof openVideoFrames>>>();
  const visuals = new Map<string, { image?: Awaited<ReturnType<typeof loadImage>>; video?: Awaited<ReturnType<typeof openVideoFrames>> }>();
  try {
    for (const el of elements) {
      if (el.visible === false) continue;
      const path = el.assetId === 'primary' ? input : await resolveCanvasAssetPath(project, dirname(input), el.assetId);
      if (!path) throw new Error(`Missing or unregistered media: ${el.name}`);
      if (el.type !== 'video') visuals.set(el.id, { image: await loadImage(path) });
    }
    const selected = selectedAsset;
    let primary: Awaited<ReturnType<typeof openVideoFrames>> | undefined;
    if (mode === 'burned' && project.videoEnabled !== false && project.mediaType.startsWith('video')) {
      const path = selectedPath;
      if (!path) throw new Error('The selected primary media is unavailable.');
      primary = await openVideoFrames(path, fps, width, false, height, primarySource); decoders.add(primary);
    }
    // Captions are a React composition rendered by Remotion. Each transparent
    // frame is streamed straight into this compositor and on to FFmpeg, so a
    // long export never stages thousands of PNGs on disk. The browser preview
    // mounts the same composition in a <Player>, so preview and export cannot
    // drift apart.
    await streamCaptionFrames({
      words: project.words as Word[],
      settings: project.settings as Settings,
      width, height, fps, frameCount,
      onStage: stage => {
        options.onStage?.(stage);
        progress({ browser: 2, bundling: 3, composition: 5, frames: 7 }[stage]);
      },
      onFrame: async (frame, captionPng) => {
        if (processError || ffmpeg.exitCode !== null || ffmpeg.signalCode !== null) {
          throw processError ?? new Error('FFmpeg stopped before all caption frames were rendered.');
        }
        // Every frame uses an explicit media timestamp, independent of render speed.
        const currentTime = frame / fps;
        // Stop expired processes before starting this frame's layers, so sequential clips share the budget.
        for (const [id, spec] of videoSpecs) {
          const visual = visuals.get(id);
          if (frame >= spec.endFrame && visual?.video) {
            await visual.video.close(); decoders.delete(visual.video); visuals.delete(id);
          }
        }
        for (const [id, spec] of videoSpecs) {
          if (frame >= spec.startFrame && frame < spec.endFrame && !visuals.has(id)) {
            const video = await openVideoFrames(spec.path, fps, spec.width, true, spec.height, spec.source);
            decoders.add(video); visuals.set(id, { video });
          }
        }

        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = mode === 'green' ? '#00ff00' : BACKGROUND;
        ctx.fillRect(0, 0, width, height);
        if (primary) {
          const base = await primary.at(frame);
          const ratio = Math.min(width / base.width, height / base.height);
          const w = base.width * ratio, h = base.height * ratio;
          drawKeyedMedia(ctx as any, base as any, (width-w)/2, (height-h)/2, w, h, selected ? selected.greenScreen : project.greenScreen);
        }
        // Draw placed visual elements on canvas
        if (project.canvasElements && project.canvasElements.length > 0) {
          for (const el of elements) {
            if (el.visible === false) continue;
            if (el.start !== undefined && currentTime < el.start) continue;
            if (el.end !== undefined && currentTime > el.end) continue;
            const visual = visuals.get(el.id);
            const img = visual?.video ? await visual.video.at(Math.max(0, Math.floor((currentTime - (el.start || 0)) * fps + 1e-7))) : visual?.image;
            if (img) {
              const elW = (width * 0.32) * (el.scale || 1.0);
              const elH = (img.height / (img.width || 1)) * elW;
              const elCenterX = (el.x / 100) * width;
              const elCenterY = (el.y / 100) * height;

              ctx.save();
              ctx.translate(elCenterX, elCenterY);
              if (el.rotation) {
                ctx.rotate((el.rotation * Math.PI) / 180);
              }
              if (el.greenScreen?.enabled) {
                drawKeyedMedia(ctx as any, img as any, -elW / 2, -elH / 2, elW, elH, el.greenScreen);
              } else {
                ctx.drawImage(img, -elW / 2, -elH / 2, elW, elH);
              }
              ctx.restore();
            }
          }
        }

        const captionFrame = await loadImage(captionPng);
        ctx.drawImage(captionFrame, 0, 0, width, height);
        if (mode === 'green' || project.mediaType.startsWith('audio') || project.videoEnabled === false) {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = mode === 'green' ? '#00ff00' : BACKGROUND;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        await new Promise<void>((resolveWrite, rejectWrite) => {
          ffmpeg.stdin.write(canvas.data(), error => error ? rejectWrite(error) : resolveWrite());
        });
        progress(Math.min(98, 7 + Math.floor((frame + 1) / frameCount * 91)));
      },
    });
    ffmpeg.stdin.end();
    const code = await finished;
    if (code !== 0 || processError) throw processError ?? new Error(`FFmpeg exited with code ${code}.`);
    progress(100);
  } catch (error) {
    ffmpeg.stdin.destroy();
    if (ffmpeg.exitCode === null && ffmpeg.signalCode === null) ffmpeg.kill('SIGTERM');
    await finished;
    await rm(output, { force: true }).catch(() => undefined);
    const explanation = error instanceof Error ? error.message : String(error);
    throw new Error(`Video export failed: ${explanation}${errorOutput.trim() ? `\n${errorOutput.trim()}` : ''}`);
  } finally { await Promise.all([...decoders].map(decoder => decoder.close())); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 5 && args.length !== 6) {
    throw new Error('Usage: node --import tsx server/render.ts SNAPSHOT_JSON INPUT_MEDIA OUTPUT_MP4 burned|green 720|1080|2160 [fps]');
  }
  const [snapshot, input, output, mode, resolution, fpsStr] = args;
  if (resolve(snapshot) === resolve(output)) throw new Error('The output cannot overwrite the project snapshot.');
  const project = validateRenderProject(JSON.parse(await readFile(snapshot, 'utf8')));
  const fps = fpsStr ? Number(fpsStr) : 60;
  await renderCaptionVideo({
    project, input, output, mode: mode as RenderMode, resolution: Number(resolution), fps,
    onProgress: value => process.stdout.write(`${JSON.stringify({ progress: value })}\n`),
    onStage: stage => process.stdout.write(`${JSON.stringify({ stage })}\n`),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    if (error instanceof RenderResourceError) process.stdout.write(`${JSON.stringify({ errorCode: 'render_resource_limit' })}\n`);
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
