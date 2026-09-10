import { spawn } from 'node:child_process';
import { readFile, access, mkdir, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { dimensions, drawCaptions, groupWords, templates } from '../src/lib/captions.ts';
import type { Project, Settings, Word } from '../src/lib/types.ts';

const require = createRequire(import.meta.url);
const FPS = 30;
const BACKGROUND = '#111315';
export type RenderMode = 'burned' | 'green';
let fontsRegistered = false;

/** Use the same bundled font files as the browser, including Hindi glyphs. */
export function registerRenderFonts() {
  if (fontsRegistered) return;
  const fonts = [
    ['@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff', 'DM Sans'],
    ['@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff', 'Noto Sans Devanagari'],
  ];
  for (const [file, family] of fonts) {
    if (!GlobalFonts.registerFromPath(require.resolve(file), family)) {
      throw new Error(`Unable to load the bundled ${family} caption font. Reinstall npm dependencies.`);
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
  return value as unknown as Project;
}

export function ffmpegArguments(project: Project, input: string, output: string, mode: RenderMode, resolution: number): string[] {
  const { width, height } = dimensions(project.settings, project.width, project.height, resolution);
  const frameCount = Math.ceil(project.duration * FPS);
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`,
    '-framerate', String(FPS), '-i', 'pipe:0'];
  if (mode === 'burned') {
    args.push('-i', input);
    if (project.mediaType.startsWith('video') && project.videoEnabled !== false) {
      // Match the preview's contain behavior, preserving the complete source image.
      args.push('-filter_complex',
        `[1:v:0]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND},fps=${FPS},tpad=stop_mode=clone:stop_duration=1[base];[base][0:v:0]overlay=shortest=1:format=auto,format=yuv420p[out]`,
        '-map', '[out]');
    } else {
      args.push('-map', '0:v:0');
    }
    args.push('-map', '1:a:0?', '-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-map', '0:v:0', '-an');
  }
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-frames:v', String(frameCount), '-t', String(frameCount / FPS),
    '-movflags', '+faststart', '-f', 'mp4', output);
  return args;
}

export async function renderCaptionVideo(options: {
  project: Project; input: string; output: string; mode: RenderMode; resolution: number;
  onProgress?: (progress: number) => void;
}) {
  const project = validateRenderProject(options.project);
  const { mode, resolution } = options;
  if (mode !== 'burned' && mode !== 'green') throw new Error('Export mode must be burned or green.');
  if (resolution !== 720 && resolution !== 1080) throw new Error('Export resolution must be 720 or 1080.');
  if (mode === 'green' && /^#00ff00$/i.test(project.settings.accent)) {
    throw new Error('Choose a caption accent other than #00ff00 before exporting a green screen video.');
  }
  const input = resolve(options.input), output = resolve(options.output);
  if (input === output) throw new Error('The export path must differ from the original media path.');
  await access(input, constants.R_OK);
  await mkdir(dirname(output), { recursive: true });
  registerRenderFonts();
  const { width, height } = dimensions(project.settings, project.width, project.height, resolution);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const groups = groupWords(project.words, project.settings.template === 'kinetic' ? 1 : project.settings.wordsPerLine);
  const frameCount = Math.ceil(project.duration * FPS);
  const ffmpeg = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ffmpegArguments(project, input, output, mode, resolution), {
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
  const progress = (value: number) => {
    if (value > lastProgress) { lastProgress = value; options.onProgress?.(value); }
  };
  progress(0);
  try {
    // Every frame uses an explicit media timestamp, independent of render speed.
    for (let frame = 0; frame < frameCount; frame++) {
      if (processError || ffmpeg.exitCode !== null || ffmpeg.signalCode !== null) {
        throw processError ?? new Error('FFmpeg stopped before all caption frames were rendered.');
      }
      drawCaptions(ctx as unknown as CanvasRenderingContext2D, width, height,
        project.words as Word[], project.settings as Settings, frame / FPS, groups);
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
      progress(Math.min(98, Math.floor((frame + 1) / frameCount * 98)));
    }
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
    throw new Error(`Video export failed: ${errorOutput.trim() || explanation}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 5) throw new Error('Usage: node --import tsx server/render.ts SNAPSHOT_JSON INPUT_MEDIA OUTPUT_MP4 burned|green 720|1080');
  const [snapshot, input, output, mode, resolution] = args;
  if (resolve(snapshot) === resolve(output)) throw new Error('The output cannot overwrite the project snapshot.');
  const project = validateRenderProject(JSON.parse(await readFile(snapshot, 'utf8')));
  await renderCaptionVideo({ project, input, output, mode: mode as RenderMode, resolution: Number(resolution),
    onProgress: value => process.stdout.write(`${JSON.stringify({ progress: value })}\n`) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
