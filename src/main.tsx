import { canvasKeyboardChange, editSnapshot, isBrowserZoomKey, playbackFrame, activeCaptionIndex, captionTimeIndex, timeIntervalIndex, timelineGroupWindow, timelineWindowIndices } from './lib/frontend-reliability';
import { assetMediaPath, syncMediaSource } from './lib/media-credentials';
import { editCaptionGroup } from './lib/caption-edit';
import { captionBounds } from './lib/caption-settings';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Move, AudioLines, Ban, Bold, Camera, Captions, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clapperboard, Clock, Download, Edit3, FileAudio, Film, Folder, FolderOpen, GripHorizontal, Headphones, Image as ImageIcon, Italic, Layers, Link2, LoaderCircle, LogOut, Maximize2, Minus, MonitorPlay, Moon, MoreHorizontal, Palette, Pause, Pencil, Play, Plus, Redo2, Replace, RotateCcw, Rows2, Scan, Scissors, Search, Settings as SettingsIcon, Settings2, SlidersHorizontal, Smile, Sparkles, Split, SquarePlay, Star, Subtitles, Sun, Trash2, Type, Undo2, Upload, UploadCloud, Video, Volume2, VolumeX, Wand2, WandSparkles, X, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/noto-sans-devanagari/700.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import './styles.css';
import { ApiError, API, deleteProject, downloadAudioBlob, fetchLimits, fetchMediaAssets, request, upload, mediaUrl, type Limits } from './lib/api';
import { defaults, type CanvasVisualElement, type ExportJob, type GreenScreenSettings, type MediaAsset, type Project, type Settings, type Word } from './lib/types';
import { appendWord, csvTranscript, dimensions, ensureValidIntervals, getContrastColor, insertWord, mergeLines, moveWordToLine, moveWordsToLine, moveWordsToNewLine, moveWordToNextLine, moveWordToPreviousLine, plainTranscript, matchesCaptionWord, replaceAllOccurrences, splitLineAtWord, subtitleText, templates } from './lib/captions';
import { MAX_WORDS_PER_PAGE, buildPages, groupWords } from './lib/pages';
import { saveWithRevision } from './lib/revision-save';
import { UNSAVED, type Health, type NavPanelId } from './lib/shell';
import { Modal } from './components/Modal';
import { SettingsPanel } from './components/SettingsPanel';
import { StylePanel } from './components/StylePanel';
import { TextPanel } from './components/TextPanel';
import { SAFE_AREAS, positionCollides, safeAreaFor } from './lib/safe-area';
import { captionFonts } from './lib/caption-fonts';
import { Player, type PlayerRef } from '@remotion/player';
import { CaptionTrack } from './remotion/CaptionTrack';
import { treatmentFor } from './remotion/treatments';
import { CAPTION_FPS } from './remotion/Root';
import { orderedElements } from './lib/media-scene';
import { drawKeyedMedia } from './lib/chromakey';
import { MediaPanel, GreenScreenModal } from './components/MediaPanel';
import { CaptionsPanel } from './components/CaptionsPanel';
import { WordInspector, recase, type WordCase } from './components/WordInspector';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';
import { StudioNavbar } from './components/StudioNavbar';
import { StudioModals } from './components/StudioModals';
import { OnboardingTour } from './components/OnboardingTour';
import { CommandPalette } from './components/CommandPalette';
import { LiveAnnouncer } from './components/LiveAnnouncer';
import { TimelineRuler } from './components/TimelineRuler';
import { AuthScreen } from './components/AuthScreen';
import { AUTH_ENABLED, rememberSession, supabase } from './lib/auth';
import type { Session } from '@supabase/supabase-js';
import { ensureMediaToken, forgetMediaTokens } from './lib/api';

const timecode = (s: number) => `${Math.floor(Math.max(0,s)/60).toString().padStart(2,'0')}:${(Math.max(0,s)%60).toFixed(1).padStart(4,'0')}`;
type EditState = Pick<Project, 'words' | 'settings' | 'name' | 'videoEnabled' | 'activeMediaAssetId'> & {
  canvasElements?: CanvasVisualElement[];
};

/** Shown when a save fails; the status dot keys off this exact value. */
/**
 * Where a caption can be dropped: the three horizontal and three vertical
 * anchors the alignment buttons set, and nothing in between.
 *
 * Dragging used to snap to a 5% grid, which is 441 landing spots — fine enough
 * that the caption twitched to a new one on almost every pixel of mouse travel,
 * so the drag read as glitchy without ever helping anything line up. The nine
 * anchors are the positions worth having, and they are the same numbers the
 * buttons use, so dragging somewhere and clicking to it agree.
 *
 * The bottom anchor sits at 82 rather than 85 because descenders and a second
 * caption line need the room.
 */
const CAPTION_ANCHORS_X = [15, 50, 85];
const CAPTION_ANCHORS_Y = [15, 50, 82];
/**
 * How close the pointer must come, in percent of the frame, before an anchor
 * takes the caption. Outside it the caption follows the mouse exactly, so a
 * deliberate position off-anchor is still possible without holding Alt.
 */
const CAPTION_SNAP_RANGE = 6;

/** The nearest anchor within range, or the raw value when there is none. */
function snapToAnchor(value: number, anchors: number[]): { value: number; anchor: number | null } {
  let best: number | null = null;
  for (const a of anchors) {
    if (Math.abs(value - a) <= CAPTION_SNAP_RANGE
      && (best === null || Math.abs(value - a) < Math.abs(value - best))) best = a;
  }
  return { value: best ?? value, anchor: best };
}

const NAV_PANELS: { id: NavPanelId; label: string; icon: React.ReactNode }[] = [
  { id: 'caption', label: 'Caption', icon: <Captions size={20} strokeWidth={1.75} /> },
  { id: 'media', label: 'Media', icon: <Camera size={20} strokeWidth={1.75} /> },
  { id: 'text', label: 'Text', icon: <Type size={20} strokeWidth={1.75} /> },
  { id: 'style', label: 'Style', icon: <Clock size={20} strokeWidth={1.75} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} strokeWidth={1.75} /> },
];

function App() {
  /**
   * Light unless this browser has been told otherwise.
   *
   * The machine's preference used to decide it. It does not any more: the gate
   * in front of this is light unconditionally, so a dark OS meant the page
   * changed colour at the moment of signing in. The switch in the navbar still
   * decides, and now sticks — see persistTheme.
   *
   * Mirrors the boot script in index.html, which has to make the same call
   * before any of this is parsed. The two must agree or the first paint is the
   * wrong theme.
   */
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('bol_theme') === 'dark' ? 'dark' : 'light'),
  );

  /**
   * What the navbar switch calls.
   *
   * It was `setTheme`, which is state and nothing else — so the switch changed
   * the page and the choice was gone on the next load, because the boot script
   * reads a key nobody was writing. The toggler handles the attribute, the
   * class and the meta colour itself in controlled mode but deliberately leaves
   * persistence to its parent, and this is the parent.
   */
  const persistTheme = useCallback((next: 'light' | 'dark') => {
    setTheme(next);
    try { localStorage.setItem('bol_theme', next); } catch { /* private window */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('bol_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('theme-dark');
      } else {
        document.documentElement.classList.remove('theme-dark');
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'dark' ? '#111215' : '#ffffff');
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
  }, [theme]);

  useEffect(() => {
    const handleThemeKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        const toggler = document.querySelector<HTMLButtonElement>('.theme-toggle-btn, .animated-theme-toggler');
        if (toggler) {
          toggler.click();
        } else {
          toggleTheme();
        }
      }
    };
    window.addEventListener('keydown', handleThemeKey);
    return () => window.removeEventListener('keydown', handleThemeKey);
  }, [toggleTheme]);

  const [project, setProject] = useState<Project | null>(null);
  const projectRef = useRef<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [timelineHover, setTimelineHover] = useState<{ xPct: number; time: number } | null>(null);
  const [script, setScript] = useState('roman');
  const [language, setLanguage] = useState('auto');
  const [activeNavPanel, setActiveNavPanel] = useState<NavPanelId>('caption');
  /**
   * The account menu, anchored under the avatar in the navbar.
   *
   * The avatar used to swing the whole left panel over to Settings, which is a
   * long way to travel for "who am I signed in as" and "sign me out" — and it
   * threw away whatever panel was open to get there. Settings is still one item
   * inside it, so nothing that was reachable stopped being reachable.
   */
  const [accountMenu, setAccountMenu] = useState<{ top: number; right: number } | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [draggingWordIds, setDraggingWordIds] = useState<string[]>([]);
  const lastSelectedWordIdRef = useRef<string | null>(null);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [captionToolsOpen, setCaptionToolsOpen] = useState(false);
  const [searchFindText, setSearchFindText] = useState('');
  const [searchReplaceText, setSearchReplaceText] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'export' | 'projects' | 'help' | 'search-replace' | 'shortcuts' | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  /** What sign-up asked for, when it was asked. Blank for accounts made before
   *  the field existed, so every reader of it falls back to the email. */
  const [accountName, setAccountName] = useState('');
  /**
   * Asked once, right after an upload, before any time is spent editing.
   *
   * Spoken language and the script it is written in were only reachable as two
   * separate dropdowns inside the Captions panel, several clicks past the
   * upload, and the recogniser had already run with whatever was left over from
   * the last clip by the time anyone found them. Getting it wrong is not a
   * setting to nudge afterwards — it means transcribing again from scratch.
   */
  const [languagePrompt, setLanguagePrompt] = useState<'open' | null>(null);
  const [importAutoHighlight, setImportAutoHighlight] = useState<boolean>(true);
  const [exportMode, setExportMode] = useState<'burned' | 'green'>('burned');
  const [resolution, setResolution] = useState<720 | 1080 | 2160>(720);
  const [exportFps, setExportFps] = useState<24 | 25 | 30 | 50 | 60>(30);
  const [activeExportId, setActiveExportId] = useState<string | null>(null);
  const [lastDownloadedExportId, setLastDownloadedExportId] = useState<string | null>(null);
  const downloadedExportIdsRef = useRef<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  /**
   * Everything /api/limits reports, rather than the one field this used to keep.
   *
   * The same request already carried the upload ceiling, the clip-length
   * ceiling and the disk figures, and all of them were parsed and dropped on
   * the floor — so the only way to learn any of them was to breach one. The
   * Settings panel shows the lot.
   *
   * maxExportSeconds still means what it meant: null is no limit, which is the
   * local default, while a hosted instance caps it so a long clip fails now
   * rather than an hour into a render its shared CPU was never going to finish.
   */
  const [limits, setLimits] = useState<Limits | null>(null);
  const maxExportSeconds = limits?.maxExportSeconds ?? null;
  const [saveStatus, setSaveStatus] = useState('Temporary session');
  const [dirty, setDirty] = useState(0);
  const [history, updateHistory] = useState<EditState[]>([]);
  const [future, updateFuture] = useState<EditState[]>([]);
  const historyRef = useRef<EditState[]>([]);
  const futureRef = useRef<EditState[]>([]);
  function setHistory(next: React.SetStateAction<EditState[]>) {
    historyRef.current = typeof next === 'function' ? next(historyRef.current) : next;
    updateHistory(historyRef.current);
  }
  function setFuture(next: React.SetStateAction<EditState[]>) {
    futureRef.current = typeof next === 'function' ? next(futureRef.current) : next;
    updateFuture(futureRef.current);
  }
  const [projectAssets, setProjectAssets] = useState<MediaAsset[]>([]);
  const [activeMediaAsset, setActiveMediaAsset] = useState<MediaAsset | null>(null);
  const [canvasElements, setCanvasElements] = useState<CanvasVisualElement[]>([]);
  const [selectedCanvasElementId, setSelectedCanvasElementId] = useState<string | null>(null);
  const [greenScreenTargetEl, setGreenScreenTargetEl] = useState<CanvasVisualElement | null>(null);
  /** The anchors a caption drag is currently held by, for the guide lines. */
  const [captionSnap, setCaptionSnap] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [snapGuideX, setSnapGuideX] = useState(false);
  const [snapGuideY, setSnapGuideY] = useState(false);
  const [mediaFrameVersion, setMediaFrameVersion] = useState(0);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const handleSelectMediaForCanvas = useCallback((asset: MediaAsset) => {
    if (!projectRef.current || projectRef.current.mediaType !== 'video' || (asset.id !== 'primary' && asset.mediaType !== 'video')) return;
    setActiveMediaAsset(asset.id === 'primary' ? null : asset);
    markEdit({ ...projectRef.current, activeMediaAssetId: asset.id, videoEnabled: true });
  }, []);

  const handleUpdateProjectAssets = useCallback((newAssets: MediaAsset[]) => {
    setProjectAssets(newAssets);
    const current = projectRef.current;
    if (current) {
      const updatedProject = { ...current, mediaAssets: newAssets.filter(a => a.id !== 'primary'), greenScreen: newAssets.find(a => a.id === 'primary')?.greenScreen ?? current.greenScreen };
      projectRef.current = updatedProject; setProject(updatedProject);
    }
    if (activeMediaAsset) {
      const updated = newAssets.find(a => a.id === activeMediaAsset.id);
      if (updated) setActiveMediaAsset(updated);
      else setActiveMediaAsset(null);
    }
  }, [activeMediaAsset]);

  const handleCloseTour = useCallback(() => {
    setShowTour(false);
    try {
      localStorage.setItem('bol_tour_completed', 'true');
    } catch {
      // localStorage disabled or unavailable
    }
  }, []);

  useEffect(() => {
    try {
      if (project && project.status === 'ready' && !localStorage.getItem('bol_tour_completed')) {
        setShowTour(true);
      }
    } catch {
      // localStorage disabled or unavailable
    }
  }, [project?.id, project?.status]);

  const [saveConflict, setSaveConflict] = useState<Project | null>(null);
  const savedProjectRef = useRef<Project | null>(null);
  const conflictRef = useRef<string | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const savedDirty = useRef(0);
  const dirtyRef = useRef(0);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const media = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const captionPlayer = useRef<PlayerRef>(null);
  const preview = useRef<HTMLDivElement>(null);
  const duration = project?.duration || 0;
  const words = project?.words ?? [];
  const isSingleWordTemplate = useCallback((tpl: string) => treatmentFor(tpl).layout === 'single', []);
  const perPage = isSingleWordTemplate(settings.template) ? 1 : settings.wordsPerLine;
  // Exactly what the renderer draws — same call, same options — so the editor
  // can show which word will be enlarged instead of guessing at it. A stacked
  // lockup is built around a hero row, so it promotes a word even when nobody
  // highlighted one; without this the creator sees a word grow on the preview
  // with nothing in the panel explaining why.
  const pages = useMemo(
    () => buildPages(words, perPage, {
      alwaysPromote: treatmentFor(settings.template).layout !== 'rows',
      autoHighlight: settings.autoHighlight !== false,
    }),
    [words, perPage, settings.template, settings.autoHighlight],
  );
  const groups = useMemo(() => pages.map(page => page.words), [pages]);
  /** The caption line on screen right now — what the preview overlay acts on. */
  const pageTimeIndex = useMemo(() => timeIntervalIndex(pages.map((page, index) => ({ index, start: page.start, end: page.end }))), [pages]);
  const activePage = pages[activeCaptionIndex(pageTimeIndex, time)] ?? null;
  const groupTimeIndex = useMemo(() => captionTimeIndex(groups), [groups]);
  /** Words the renderer will enlarge, whether chosen by the creator or by score. */
  const safeArea = useMemo(() => safeAreaFor(settings.safeArea), [settings.safeArea]);
  /** The strip a caption at the current vertical position would land behind. */
  const safeAreaClash = useMemo(
    () => positionCollides(safeArea, settings.position),
    [safeArea, settings.position],
  );
  const heroWordIds = useMemo(
    () => new Set(pages.flatMap(page => page.heroIndices.map(i => page.words[i].id))),
    [pages],
  );
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g => g.some(w => w.text.toLowerCase().includes(q)));
  }, [groups, searchQuery]);
  // Only stacked lockups have a third line to colour.
  const isStackedTemplate = treatmentFor(settings.template).layout === 'stack';
  const size = dimensions(settings, project?.width || 720, project?.height || 1280);
  const overExportLimit = !!maxExportSeconds && duration > maxExportSeconds;
  const busy = !!project && ['queued','processing','transcribing','extracting'].includes(project.status);
  const hasVideoLayer = project?.mediaType === 'video';
  const videoEnabled = hasVideoLayer && project?.videoEnabled !== false;
  const selected = project?.words.find(w => w.id === selectedWord);
  const wordTimeIndex = useMemo(() => timeIntervalIndex(words.map((word, index) => ({ index, start: word.start, end: word.end }))), [words]);
  const activeWord = words[activeCaptionIndex(wordTimeIndex, time)];
  /**
   * Position controls over the preview, shown only while the pointer is there.
   *
   * The preview is what people look at, so it is where they reach to move a
   * caption. The alternative is the Text panel's two sliders, which move every
   * line at once and give no feedback until you look back at the video.
   */
  const [previewHover, setPreviewHover] = useState(false);
  const [draggingCaption, setDraggingCaption] = useState(false);
  /**
   * Whether a change applies to this line alone or to the whole project.
   *
   * Off is the safe default: most projects want one position throughout, and a
   * per-line override is invisible from the panel afterwards, so it should be
   * asked for rather than fallen into.
   */
  const [thisLineOnly, setThisLineOnly] = useState(false);

  /** Move the captions, either this one line or the project as a whole. */
  const setCaptionPosition = useCallback((x: number, y: number) => {
    const p = projectRef.current;
    if (!p) return;
    const clamp = (v: number) => Math.max(4, Math.min(96, Math.round(v)));
    const nx = clamp(x);
    const ny = thisLineOnly ? clamp(y) : Math.max(captionBounds.position.min, Math.min(captionBounds.position.max, clamp(y)));
    if (thisLineOnly && activePage) {
      const anchor = activePage.words[0];
      if (!anchor) return;
      // A drag fires on every pixel of mouse travel, but the caption only lands
      // on nine anchors, so nearly every call asks for the position it already
      // has. Each one used to push an undo entry — one drag could flush the
      // whole 40-step history — and re-render the player for nothing.
      if (anchor.posX === nx && anchor.posY === ny) return;
      markEdit({ ...p, words: p.words.map(w => (w.id === anchor.id ? { ...w, posX: nx, posY: ny } : w)) });
      return;
    }
    if (settings.positionX === nx && settings.position === ny
      && !p.words.some(w => w.posX !== undefined || w.posY !== undefined)) return;
    // Project-wide, so any per-line override would silently win over what was
    // just asked for. Clearing them is the honest reading of "move them all".
    const cleared = p.words.some(w => w.posX !== undefined || w.posY !== undefined)
      ? p.words.map(w => (w.posX === undefined && w.posY === undefined ? w : { ...w, posX: undefined, posY: undefined }))
      : p.words;
    markEdit({ ...p, words: cleared, settings: { ...settings, positionX: nx, position: ny } });
    setSettings({ ...settings, positionX: nx, position: ny });
  }, [thisLineOnly, activePage, settings]);
  const latestExport = project?.exports?.at(-1);
  const hasExportRunning = project?.exports?.some(e => ['queued','processing','rendering'].includes(e.status));
  const [timelineZoom, setTimelineZoom] = useState(1);
  /**
   * Open the timeline wide enough to read the words on it.
   *
   * Zoom was fixed at 1, meaning the whole clip was squeezed into the viewport
   * however many words it held. A short clip with a lot of speech gave each word
   * ten to twenty pixels, so twenty-one of twenty-two labels were clipped and
   * several rendered nothing at all — a row of empty boxes you could click but
   * not read.
   *
   * Fitting the words instead of the clip costs the whole-clip glance, which the
   * viewport's own scrolling and the zoom control both give back. An empty box
   * shows nothing at any zoom; a scrollbar is the smaller loss.
   */
  const fittedZoomFor = useCallback((words: Word[], duration: number) => {
    const viewport = timelineViewportRef.current?.clientWidth ?? 0;
    if (!viewport || !duration || words.length < 2) return 1;
    // From the durations, not the word count: a cell is as wide as its word is
    // long to say, and speech is uneven — counting words assumes they share the
    // track equally and lands far short. The median keeps one drawn-out word
    // from deciding the zoom for everything else.
    const spans = words.map(w => Math.max(0.01, w.end - w.start)).sort((a, b) => a - b);
    const median = spans[Math.floor(spans.length / 2)];
    const READABLE_WORD_PX = 62;
    return Math.min(8, Math.max(1, (READABLE_WORD_PX * duration) / (median * viewport)));
  }, []);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const [timelineWindow, setTimelineWindow] = useState({ start: 0, end: 1 });
  const readTimelineWindow = useCallback(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;
    const width = Math.max(1, viewport.scrollWidth);
    const overscan = viewport.clientWidth * .2;
    const start = Math.max(0, (viewport.scrollLeft - overscan) / width);
    const end = Math.min(1, (viewport.scrollLeft + viewport.clientWidth + overscan) / width);
    setTimelineWindow(previous => previous.start === start && previous.end === end ? previous : { start, end });
  }, []);
  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(readTimelineWindow);
    observer.observe(viewport);
    if (timelineTrackRef.current) observer.observe(timelineTrackRef.current);
    readTimelineWindow();
    return () => observer.disconnect();
  }, [project?.id, timelineZoom, readTimelineWindow]);
  const timelineVisibleWindow = useMemo(() => timelineGroupWindow(groups,
    timelineWindow.start * duration, timelineWindow.end * duration),
    [groups, timelineWindow, duration]);
  const activeTimelineIndex = activeCaptionIndex(groupTimeIndex, time, { inclusiveEnd: true, preferLast: true });
  const visibleTimelineIndices = useMemo(() => timelineWindowIndices(timelineVisibleWindow, activeTimelineIndex),
    [timelineVisibleWindow, activeTimelineIndex]);

  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineZoomRef = useRef(timelineZoom);
  timelineZoomRef.current = timelineZoom;
  const [timelinePopover, setTimelinePopover] = useState<{
    word: Word;
    rect: DOMRect;
    draftText: string;
    emphasis: boolean;
    spotlight: boolean;
    behind: boolean;
  } | null>(null);
  const [draggingWordId, setDraggingWordId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    groupIdx: number;
    targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' };
  } | null>(null);
  const dragMovedRef = useRef(false);
  const [timelineLiveTooltip, setTimelineLiveTooltip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  const rulerTicks = useMemo(() => {
    if (!duration || duration <= 0) return [];
    let majorInterval = 5;
    if (timelineZoom >= 20) majorInterval = 0.1;
    else if (timelineZoom >= 12) majorInterval = 0.2;
    else if (timelineZoom >= 6) majorInterval = 0.5;
    else if (timelineZoom >= 3) majorInterval = 1;
    else if (timelineZoom >= 1.8) majorInterval = 2;
    else if (duration <= 10) majorInterval = 1;
    else if (duration <= 30) majorInterval = 2;
    else if (duration <= 60) majorInterval = 5;
    else majorInterval = 10;

    const visibleStart = timelineWindow.start * duration;
    const visibleEnd = timelineWindow.end * duration;
    // At most 60 labelled positions in the viewport, even for multi-hour media.
    majorInterval = Math.max(majorInterval, (visibleEnd - visibleStart) / 60);
    const ticks: { time: number; label: string; isMajor: boolean }[] = [];
    const count = Math.ceil(visibleEnd / majorInterval);
    for (let i = Math.floor(visibleStart / majorInterval); i <= count; i++) {
      const t = Number((i * majorInterval).toFixed(2));
      if (t > duration + 0.05) break;
      ticks.push({ time: t, label: timecode(t), isMajor: true });

      if (majorInterval >= 1) {
        const subCount = majorInterval >= 5 ? 4 : 1;
        for (let s = 1; s <= subCount; s++) {
          const subT = Number((t + (s * majorInterval) / (subCount + 1)).toFixed(2));
          if (subT < duration) {
            ticks.push({ time: subT, label: '', isMajor: false });
          }
        }
      }
    }
    return ticks;
  }, [duration, timelineZoom, timelineWindow]);

  useEffect(() => {
    if (!playing || timelineZoom <= 1 || !timelineViewportRef.current) return;
    const vp = timelineViewportRef.current;
    const playheadPx = (time / (duration || 1)) * vp.scrollWidth;
    const leftBound = vp.scrollLeft;
    const rightBound = leftBound + vp.clientWidth;
    if (playheadPx < leftBound + 40 || playheadPx > rightBound - 60) {
      vp.scrollLeft = playheadPx - vp.clientWidth / 3;
    }
  }, [time, playing, timelineZoom, duration]);

  useEffect(() => {
    if (!isScrubbing) return;
    let rafId: number | null = null;
    let latestEvent: MouseEvent | null = null;

    const onMouseMove = (e: MouseEvent) => {
      latestEvent = e;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!latestEvent || !timelineTrackRef.current || !duration) return;
        const rect = timelineTrackRef.current.getBoundingClientRect();
        const clickX = latestEvent.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        seek(pct * duration);
      });
    };
    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsScrubbing(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isScrubbing, duration]);

  // Trackpad pinch-to-zoom and gesture zooming on the timeline container
  useEffect(() => {
    const container = timelineContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      // 1. Pinch-to-zoom on trackpad or Ctrl/Cmd + wheel
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const vp = timelineViewportRef.current;
        if (!vp) return;

        const rect = vp.getBoundingClientRect();
        // Mouse X relative to viewport container
        const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const scrollLeft = vp.scrollLeft;
        const scrollWidth = vp.scrollWidth;

        // Ratio of position in content under cursor
        const contentX = scrollLeft + mouseX;
        const ratio = scrollWidth > 0 ? contentX / scrollWidth : 0.5;

        // Exponential scaling makes zoom feel equally smooth and responsive across 1x to 32x
        const curZoom = timelineZoomRef.current;
        const scaleFactor = Math.exp(Math.max(-0.4, Math.min(0.4, -e.deltaY * 0.006)));
        const nextZoom = Math.min(32, Math.max(1, Number((curZoom * scaleFactor).toFixed(2))));

        if (nextZoom !== curZoom) {
          setTimelineZoom(nextZoom);

          // Anchor the content under the cursor position so it doesn't jump
          requestAnimationFrame(() => {
            if (!timelineViewportRef.current) return;
            const newScrollWidth = timelineViewportRef.current.scrollWidth;
            const targetScrollLeft = (ratio * newScrollWidth) - mouseX;
            timelineViewportRef.current.scrollLeft = Math.max(0, targetScrollLeft);
          });
        }
        return;
      }

      // 2. Two-finger vertical scroll on trackpad or mouse wheel when zoomed in:
      // Translate vertical scrolling to horizontal panning across the timeline
      if (timelineZoomRef.current > 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const vp = timelineViewportRef.current;
        if (vp) {
          e.preventDefault();
          vp.scrollLeft += e.deltaY;
        }
      }
    };

    // Safari native WebKit gesture events for trackpad pinch
    let gestureStartZoom = 1;
    let gestureStartX = 0;
    let gestureStartRatio = 0.5;

    const onGestureStart = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      gestureStartZoom = timelineZoomRef.current;
      const vp = timelineViewportRef.current;
      if (vp) {
        const rect = vp.getBoundingClientRect();
        gestureStartX = Math.max(0, Math.min(rect.width, (e.clientX || (rect.left + rect.width / 2)) - rect.left));
        gestureStartRatio = vp.scrollWidth > 0 ? (vp.scrollLeft + gestureStartX) / vp.scrollWidth : 0.5;
      }
    };

    const onGestureChange = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      const scale = typeof e.scale === 'number' ? e.scale : 1;
      const nextZoom = Math.min(32, Math.max(1, Number((gestureStartZoom * scale).toFixed(2))));
      if (nextZoom !== timelineZoomRef.current) {
        setTimelineZoom(nextZoom);
        requestAnimationFrame(() => {
          const vp = timelineViewportRef.current;
          if (!vp) return;
          const targetScrollLeft = (gestureStartRatio * vp.scrollWidth) - gestureStartX;
          vp.scrollLeft = Math.max(0, targetScrollLeft);
        });
      }
    };

    const onGestureEnd = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('gesturestart', onGestureStart, { passive: false });
    container.addEventListener('gesturechange', onGestureChange, { passive: false });
    container.addEventListener('gestureend', onGestureEnd, { passive: false });

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('gesturestart', onGestureStart);
      container.removeEventListener('gesturechange', onGestureChange);
      container.removeEventListener('gestureend', onGestureEnd);
    };
  }, []);

  useEffect(() => () => { if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current); }, []);

  const notify = useCallback((message: string) => setNotice(message), []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setAccountEmail(data.user?.email ?? '');
      setAccountName(String(data.user?.user_metadata?.full_name ?? '').trim());
    });
  }, []);

  // Media URLs carry a token that expires, so one has to exist before the first
  // <video src> is built and be replaced before it lapses. The counter is what
  // makes the tree re-read it: mediaUrl looks the token up when it runs, so the
  // URLs built before it arrived have to be built again.
  const [mediaTokenTick, setMediaTokenTick] = useState(0);
  const mediaResumeRef = useRef<{ projectId: string; assetId: string; time: number; playing: boolean } | null>(null);
  useEffect(() => {
    const id = project?.id;
    if (!AUTH_ENABLED || !id) return;
    let live = true;
    let lastToken = '';
    const mint = () => {
      ensureMediaToken(id)
        .then(token => {
          if (!live || token === lastToken) return;
          const element = media.current;
          if (lastToken && element) mediaResumeRef.current = { projectId: id,
            assetId: projectRef.current?.activeMediaAssetId ?? 'primary', time: element.currentTime, playing: !element.paused };
          lastToken = token; setMediaTokenTick(n => n + 1);
        })
        .catch(() => { /* request() has already handled a dead session. */ });
    };
    mint();
    const timer = setInterval(mint, 60 * 1000);
    const visible = () => { if (document.visibilityState === 'visible') mint(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', mint);
    return () => { live = false; mediaResumeRef.current = null; clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', mint); };
  }, [project?.id]);
  // Fit the timeline to its words the moment there are words to fit — on upload,
  // when a transcript arrives, and when a project is opened. Keyed on that
  // transition rather than on every render, so a zoom the creator sets by hand
  // afterwards is left alone.
  const fittedFor = useRef('');
  useEffect(() => {
    const count = project?.words.length ?? 0;
    const key = `${project?.id ?? ''}:${count > 0}`;
    if (!project || count === 0 || fittedFor.current === key) return;
    fittedFor.current = key;
    setTimelineZoom(fittedZoomFor(project.words, project.duration));
  }, [project, fittedZoomFor]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { savedProjectRef.current = project; conflictRef.current = null; setSaveConflict(null); }, [project?.id]);
  // Re-read rather than polled: the storage figure only moves when this browser
  // uploads or deletes something, and walking every project directory to answer
  // it is not work to repeat every seven seconds beside the health check.
  const refreshLimits = useCallback(
    () => fetchLimits().then(setLimits).catch(() => setLimits(null)),
    [],
  );
  useEffect(() => { void refreshLimits(); }, [refreshLimits]);
  // Read again whenever Settings is opened. A figure fetched on mount is stale
  // by the time anybody goes looking for it — an upload or a delete in another
  // tab, or an export finishing, all move it — and a storage panel that quotes
  // a number from half an hour ago is worse than one that admits it cannot read
  // it, because nothing on screen says which it is showing.
  useEffect(() => { if (activeNavPanel === 'settings') void refreshLimits(); }, [activeNavPanel, refreshLimits]);
  useEffect(() => {
    let closed = false;
    async function check() {
      try {
        const h = await request<Health>('/health');
        if (!closed) setHealth(h);
      } catch { if (!closed) setHealth(null); }
    }
    void check(); const timer = setInterval(check, 7000); return () => { closed = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!project || (!busy && !hasExportRunning)) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        if (busy) {
          const progress = await request<Pick<Project, 'id' | 'status' | 'progress' | 'message'>>(`/projects/${project.id}?summary=true`);
          if (cancelled) return;
          if (progress.status === 'queued' || progress.status === 'processing') {
            setProject(p => p?.id === project.id ? { ...p, status: progress.status, progress: progress.progress, message: progress.message } : p);
            return;
          }
          const current = await request<Project>(`/projects/${project.id}`);
          if (cancelled) return;
          setProject(current); projectRef.current = current;
          if (current.status === 'ready') {
            // Recognition establishes a new editing baseline; old snapshots must
            // never replace these generated words with the pre-generation scene.
            setHistory([]); setFuture([]);
            setSelectedWord(null); setSelectedWordIds(new Set());
            savedProjectRef.current = current; setSettings(current.settings);
            notify(`${current.words.length} words, ready for your finishing touch.`);
          }
        } else {
          const exports = await request<Project['exports']>(`/projects/${project.id}/exports`);
          if (cancelled) return;
          setProject(p => p?.id === project.id ? { ...p, exports } : p);
        }
      } catch (e) { if (!cancelled) notify((e as Error).message); }
    }, 1400);
    return () => { cancelled = true; clearInterval(timer); };
  }, [project?.id, busy, !!hasExportRunning, notify]);

  // Track active export if an export is running on mount/refresh
  useEffect(() => {
    if (activeExportId) return;
    const running = project?.exports?.find(e => ['queued', 'processing', 'rendering'].includes(e.status));
    if (running && !downloadedExportIdsRef.current.has(running.id)) {
      setActiveExportId(running.id);
    }
  }, [project?.exports, activeExportId]);

  // Trigger automatic download as soon as the active export is ready
  useEffect(() => {
    if (!project?.exports || !activeExportId) return;
    const job = project.exports.find(e => e.id === activeExportId);
    if (!job) return;
    if ((job.status === 'ready' || job.status === 'complete') && !downloadedExportIdsRef.current.has(job.id)) {
      downloadedExportIdsRef.current.add(job.id);
      setActiveExportId(null);
      setLastDownloadedExportId(job.id);
      // The token is waited for rather than assumed: this fires the moment a
      // render finishes, which can be long after the one minted when the project
      // was opened, and a download URL without one is refused — which the browser
      // shows as simply nothing happening.
      void (async () => {
        await ensureMediaToken(project.id);
        const link = document.createElement('a');
        link.href = mediaUrl(`/api/projects/${project.id}/exports/${job.id}/download`);
        link.download = job.filename || `${project.name || 'export'}-${job.mode}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notify('Export complete! Your video download has started.');
      })();
    } else if (job.status === 'error') {
      setActiveExportId(null);
      notify(job.message || 'Export failed. Please check the logs.');
    }
  }, [project?.id, project?.exports, activeExportId, notify]);

  const flushSave = useCallback(() => {
    const action = saveChain.current.catch(() => {}).then(async () => {
      const p = projectRef.current; const generation = dirtyRef.current;
      if (!p || generation <= savedDirty.current) return;
      if (conflictRef.current === p.id) { setSaveConflict(p); throw new Error('Resolve the save conflict before continuing.'); }
      setSaveStatus('Updating session…');
      try {
        const result = await saveWithRevision(p, savedProjectRef.current,
          body => request<Project>(`/projects/${p.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          }),
          () => request<Project>(`/projects/${p.id}`),
          error => error instanceof ApiError && error.status === 409,
        );
        if (projectRef.current?.id === p.id) {
          projectRef.current = { ...projectRef.current, revision: result.revision };
          savedProjectRef.current = result;
          savedDirty.current = generation;
          setSaveStatus('Temporary session');
          setProject(previous => previous?.id === p.id ? { ...previous, revision: result.revision } : previous);
        }
      } catch (e) {
        setSaveStatus(UNSAVED);
        if (e instanceof ApiError && e.status === 409 && projectRef.current?.id === p.id) {
          conflictRef.current = p.id;
          const remote = await request<Project>(`/projects/${p.id}`).catch(() => null);
          if (projectRef.current?.id === p.id) setSaveConflict(remote || p);
        }
        notify((e as Error).message); throw e;
      }
    });
    saveChain.current = action; return action;
  }, [notify]);
  useEffect(() => { if (dirty <= savedDirty.current) return; const timer = setTimeout(() => void flushSave().catch(() => {}), 650); return () => clearTimeout(timer); }, [dirty, flushSave]);
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirtyRef.current > savedDirty.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload',handler); return () => window.removeEventListener('beforeunload',handler); }, []);

  /**
   * End the session, dropping every media token before the token that minted
   * them goes. They outlive a sign-out otherwise: a media token is good for two
   * hours on its own signature, so the next person at this browser would still
   * be able to play the last one's video.
   *
   * The pending save goes out first. Saves are debounced by 650ms, and signing
   * out tends to be the thing done right after a last edit, so the edit sitting
   * inside that window was the one most likely to be lost — and lost in silence,
   * with the gate already on screen and no amber badge left to show it on.
   * Failures are swallowed: the session is ending either way, and refusing to
   * sign out because a save could not land would strand someone at a shared
   * browser.
   *
   * Declared below flushSave rather than beside the other session code: it
   * names flushSave in its dependency array, which is evaluated where this
   * line sits, so higher up it would read a const that is not initialised yet
   * and throw on the first render.
   */
  const signOut = useCallback(async () => {
    await flushSave().catch(() => {});
    forgetMediaTokens();
    await supabase?.auth.signOut();
  }, [flushSave]);

  function markEdit(next: Project, record = true) {
    const previous = projectRef.current;
    if (record && previous) {
      setHistory(h => [...h.slice(-39), {
        words: previous.words,
        settings: previous.settings,
        name: previous.name,
        videoEnabled: previous.videoEnabled,
        canvasElements: previous.canvasElements,
        activeMediaAssetId: previous.activeMediaAssetId,
      }]);
      setFuture([]);
    }
    projectRef.current = next;
    setProject(next);
    setSettings(next.settings);
    setActiveMediaAsset((next.mediaAssets ?? projectAssets).find(a => a.id === next.activeMediaAssetId) ?? null);
    if (false) {
    }
    if (next.canvasElements !== undefined) {
      setCanvasElements(next.canvasElements);
    }
    setSaveStatus('Updating session…');
    dirtyRef.current += 1;
    setDirty(dirtyRef.current);
  }
  function commitDrag(before: Project, after: Project) {
    if (before.id !== projectRef.current?.id) return;
    if (JSON.stringify(before.words) !== JSON.stringify(after.words)) {
      setHistory(h => [...h.slice(-39), editSnapshot(before)]);
      setFuture([]);
      markEdit(after, false);
    }
  }
  function updateSettings(update: Partial<Settings>) {
    const next = { ...settings, ...update }; setSettings(next);
    if (projectRef.current && !busy) markEdit({ ...projectRef.current, settings: next });
  }


  const handleUpdateCanvasElement = useCallback((id: string, updates: Partial<CanvasVisualElement>) => {
    const current = projectRef.current;
    if (!current || busy) return;
    const next = (current.canvasElements ?? []).map(item => item.id === id ? { ...item, ...updates } : item);
    markEdit({ ...current, canvasElements: next });
  }, [busy]);

  const handleDeleteCanvasElement = useCallback((id: string) => {
    const current = projectRef.current;
    if (!current || busy) return;
    markEdit({ ...current, canvasElements: (current.canvasElements ?? []).filter(item => item.id !== id) });
    setSelectedCanvasElementId(prev => (prev === id ? null : prev));
  }, [busy]);

  const handleAddMediaToCanvas = useCallback((asset: MediaAsset) => {
    const current = projectRef.current;
    if (!current) return;
    const url = assetMediaPath(current.id, asset.id);
    const totalDuration = current.duration || duration || 5;

    const newEl: CanvasVisualElement = {
      id: `canvas-${asset.mediaType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      assetId: asset.id,
      name: asset.name,
      type: asset.mediaType === 'video' ? 'video' : 'image',
      url,
      x: 50,
      y: 50,
      scale: 1.0,
      start: 0,
      end: totalDuration,
      visible: true,
      locked: false,
      greenScreen: asset.greenScreen,
    };

    if (!busy) markEdit({ ...current, canvasElements: [...(current.canvasElements ?? []), newEl] });
    setSelectedCanvasElementId(newEl.id);
  }, [duration, busy]);

  const handleStartDragCanvasElement = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = canvasElements.find(item => item.id === id);
    if (!el || el.locked) return;

    setSelectedCanvasElementId(id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const frameRect = preview.current?.getBoundingClientRect();
    if (!frameRect) return;

    let currentX = origX;
    let currentY = origY;

    let rafId: number | null = null;
    let latestEvent: MouseEvent | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      latestEvent = moveEvent;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!latestEvent) return;
        const dx = latestEvent.clientX - startX;
        const dy = latestEvent.clientY - startY;
        let newX = origX + (dx / frameRect.width) * 100;
        let newY = origY + (dy / frameRect.height) * 100;

        let snappedX = false;
        let snappedY = false;
        if (Math.abs(newX - 50) < 2) {
          newX = 50;
          snappedX = true;
        }
        if (Math.abs(newY - 50) < 2) {
          newY = 50;
          snappedY = true;
        }
        setSnapGuideX(snappedX);
        setSnapGuideY(snappedY);

        newX = Math.max(5, Math.min(95, newX));
        newY = Math.max(5, Math.min(95, newY));
        currentX = newX;
        currentY = newY;

        setCanvasElements(prev => prev.map(item => item.id === id ? { ...item, x: newX, y: newY } : item));
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setSnapGuideX(false);
      setSnapGuideY(false);
      handleUpdateCanvasElement(id, { x: currentX, y: currentY });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [canvasElements, handleUpdateCanvasElement]);

  const handleStartResizeCanvasElement = useCallback((e: React.MouseEvent, id: string, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = canvasElements.find(item => item.id === id);
    if (!el || el.locked) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origScale = el.scale || 1.0;
    let currentScale = origScale;

    let rafId: number | null = null;
    let latestEvent: MouseEvent | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      latestEvent = moveEvent;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!latestEvent) return;
        const dx = latestEvent.clientX - startX;
        const dy = latestEvent.clientY - startY;
        const delta = (handle.includes('e') || handle.includes('s')) ? (dx + dy) : (-dx - dy);
        const newScale = Math.max(0.15, Math.min(3.5, Number((origScale + delta * 0.005).toFixed(2))));
        currentScale = newScale;
        setCanvasElements(prev => prev.map(item => item.id === id ? { ...item, scale: newScale } : item));
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      handleUpdateCanvasElement(id, { scale: currentScale });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [canvasElements, handleUpdateCanvasElement]);

  const handleStartDragTimelineMedia = useCallback((e: React.MouseEvent, id: string, mode: 'move' | 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    const el = canvasElements.find(item => item.id === id);
    const totalDuration = duration || projectRef.current?.duration;
    if (!el || !totalDuration) return;

    setSelectedCanvasElementId(id);
    const startClientX = e.clientX;
    const origStart = el.start ?? 0;
    const origEnd = el.end ?? totalDuration;
    const origDuration = origEnd - origStart;
    const trackWidth = timelineTrackRef.current?.getBoundingClientRect().width || 1;
    let finalStart = origStart;
    let finalEnd = origEnd;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startClientX;
      const deltaTime = (dx / trackWidth) * totalDuration;

      if (mode === 'start') {
        finalStart = Math.max(0, Math.min(origEnd - 0.2, origStart + deltaTime));
      } else if (mode === 'end') {
        finalEnd = Math.min(totalDuration, Math.max(origStart + 0.2, origEnd + deltaTime));
      } else {
        let newStart = origStart + deltaTime;
        let newEnd = origEnd + deltaTime;
        if (newStart < 0) {
          newStart = 0;
          newEnd = origDuration;
        } else if (newEnd > totalDuration) {
          newEnd = totalDuration;
          newStart = Math.max(0, totalDuration - origDuration);
        }
        finalStart = newStart;
        finalEnd = newEnd;
      }

      setCanvasElements(prev => prev.map(item => item.id === id ? { ...item, start: finalStart, end: finalEnd } : item));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      handleUpdateCanvasElement(id, { start: finalStart, end: finalEnd });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [canvasElements, duration, handleUpdateCanvasElement]);

  function updateWord(id: string, update: Partial<Word>) {
    const p = projectRef.current; if (!p) return;
    markEdit({ ...p, words: p.words.map(w => w.id === id ? { ...w, ...update } : w) });
  }
  function updateWords(ids: string[] | Set<string>, update: Partial<Word>) {
    const p = projectRef.current; if (!p) return;
    const targetIds = new Set(ids);
    markEdit({ ...p, words: p.words.map(w => targetIds.has(w.id) ? { ...w, ...update } : w) });
  }
  function selectWord(wordId: string, e?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) {
    const p = projectRef.current;
    if (!p) return;

    if (e?.shiftKey && lastSelectedWordIdRef.current) {
      const anchorIdx = p.words.findIndex(w => w.id === lastSelectedWordIdRef.current);
      const currentIdx = p.words.findIndex(w => w.id === wordId);
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        const rangeIds = new Set(selectedWordIds);
        for (let i = start; i <= end; i++) {
          rangeIds.add(p.words[i].id);
        }
        setSelectedWordIds(rangeIds);
        setSelectedWord(wordId);
        return;
      }
    }

    if (e?.metaKey || e?.ctrlKey) {
      const next = new Set(selectedWordIds);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      setSelectedWordIds(next);
      setSelectedWord(next.has(wordId) ? wordId : (Array.from(next)[0] || null));
      lastSelectedWordIdRef.current = wordId;
      return;
    }

    // Normal click: single selection
    setSelectedWordIds(new Set([wordId]));
    setSelectedWord(wordId);
    lastSelectedWordIdRef.current = wordId;
  }
  /** Drop the dragged words into a line of their own, between two existing lines. */
  function handleDropWordsAsNewLine(wordIds: string[], afterGroupIdx: number) {
    const p = projectRef.current;
    if (!p || !wordIds.length) return;
    const effectivePerLine = isSingleWordTemplate(settings.template) ? 1 : settings.wordsPerLine;
    const updated = moveWordsToNewLine(p.words, wordIds, afterGroupIdx, effectivePerLine, p.duration || 60);
    if (updated === p.words) return;
    markEdit({ ...p, words: updated }, true);
    setSelectedWordIds(new Set(wordIds));
    notify(wordIds.length > 1 ? `Moved ${wordIds.length} words to a new line.` : 'Moved to a new line.');
  }
  /**
   * Take the highlight off every word.
   *
   * Needed twice over. Projects made before the fix carry `spotlight: true` on
   * words the app chose rather than the creator, and those are honoured as
   * decisions — so without this there is no way to undo a choice nobody made.
   * And clearing by hand is one click per word.
   */
  function handleClearAllHighlights() {
    const p = projectRef.current;
    if (!p) return;
    const marked = p.words.filter(w => w.spotlight || w.emphasis).length;
    if (!marked) { notify('Nothing is highlighted.'); return; }
    markEdit({ ...p, words: p.words.map(w => ({ ...w, emphasis: false, spotlight: false })) });
    notify(`Cleared ${marked} highlight${marked === 1 ? '' : 's'}.`);
  }
  function handleInsertWord(targetId: string, position: 'before' | 'after', text = 'word') {
    const p = projectRef.current; if (!p) return;
    const res = insertWord(p.words, targetId, position, text, duration);
    markEdit({ ...p, words: res.words });
    setSelectedWord(res.newWordId);
    setSelectedWordIds(new Set([res.newWordId]));
    notify(`Inserted word ${position}.`);
  }
  function handleAppendWordToLine(group: Word[]) {
    const p = projectRef.current; if (!p || !group.length) return;
    const last = group[group.length - 1];
    handleInsertWord(last.id, 'after', 'word');
  }
  function handleAddNewLine() {
    const p = projectRef.current; if (!p) return;
    const res = appendWord(p.words, 'New line', duration);
    markEdit({ ...p, words: res.words });
    setSelectedWord(res.newWordId);
    setSelectedWordIds(new Set([res.newWordId]));
    seek(res.words.find(w => w.id === res.newWordId)?.start ?? 0);
    notify('Added new caption line.');
  }
  function handleDeleteWords(ids: string[] | Set<string>) {
    const p = projectRef.current; if (!p) return;
    const targetIds = new Set(ids);
    const updated = p.words.filter(w => !targetIds.has(w.id));
    ensureValidIntervals(updated, duration);
    markEdit({ ...p, words: updated });
    setSelectedWordIds(new Set());
    setSelectedWord(null);
    notify(`Deleted ${targetIds.size} word${targetIds.size > 1 ? 's' : ''}.`);
  }
  function handleDeleteWord(id: string) {
    handleDeleteWords([id]);
  }
  function handleDeleteLine(group: Word[]) {
    handleDeleteWords(group.map(w => w.id));
  }
  function handleSplitLine(wordId: string) {
    const p = projectRef.current; if (!p) return;
    const updated = splitLineAtWord(p.words, wordId);
    markEdit({ ...p, words: updated });
    notify('Caption line split.');
  }
  function handleMoveToPreviousLine(wordId: string) {
    const p = projectRef.current; if (!p) return;
    const updated = moveWordToPreviousLine(p.words, wordId, settings.wordsPerLine);
    markEdit({ ...p, words: updated });
    notify('Moved word to previous line.');
  }
  function handleMoveToNextLine(wordId: string) {
    const p = projectRef.current; if (!p) return;
    const updated = moveWordToNextLine(p.words, wordId);
    markEdit({ ...p, words: updated });
    notify('Moved word to next line.');
  }

  function handleSplitAtCurrent() {
    const p = projectRef.current;
    if (!p || !p.words.length) return;
    const targetWord = (selectedWord ? p.words.find(w => w.id === selectedWord) : null)
      || p.words.find(w => time >= w.start && time <= w.end)
      || p.words.find(w => w.start >= time)
      || p.words[0];
    if (targetWord) {
      handleSplitLine(targetWord.id);
    }
  }

  function handleAddWord() {
    const p = projectRef.current;
    if (!p) return;
    const { words: updated } = appendWord(p.words, 'New caption', duration);
    markEdit({ ...p, words: updated });
    notify('Added new caption.');
  }

  const handleEditCaptionGroup = useCallback((groupIdx: number, newText: string, newStart: number, newEnd: number) => {
    const p = projectRef.current;
    if (!p) return;
    const effectivePerLine = isSingleWordTemplate(settings.template) ? 1 : settings.wordsPerLine;
    const currentGroups = groupWords(p.words, effectivePerLine);
    if (groupIdx < 0 || groupIdx >= currentGroups.length) return;

    const oldGroup = currentGroups[groupIdx];
    try {
      const first = p.words.findIndex(w => w.id === oldGroup[0].id);
      const last = first + oldGroup.length;
      if ((newStart !== oldGroup[0].start || newEnd !== oldGroup.at(-1)!.end) && (newStart < (p.words[first - 1]?.end ?? 0) || newEnd > (p.words[last]?.start ?? p.duration))) {
        throw new Error('Keep this line between its neighboring captions and within the media duration.');
      }
      const edited = editCaptionGroup(oldGroup, newText, newStart, newEnd);
      markEdit({ ...p, words: [...p.words.slice(0, first), ...edited, ...p.words.slice(last)] }, true);
      return undefined;
    } catch (error) { return (error as Error).message; }
  }, [settings.template, settings.wordsPerLine]);

  const handleDuplicateGroup = useCallback((group: Word[]) => {
    const p = projectRef.current;
    if (!p || !group.length) return;
    const lastWord = group[group.length - 1];
    const offsetStart = Number((lastWord.end + 0.05).toFixed(3));

    const duplicatedWords: Word[] = group.map((w, idx) => {
      const relStart = w.start - group[0].start;
      const relEnd = w.end - group[0].start;
      return {
        ...w,
        id: `w-dup-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        start: Number((offsetStart + relStart).toFixed(3)),
        end: Number((offsetStart + relEnd).toFixed(3)),
      };
    });

    const updatedWords = [...p.words, ...duplicatedWords];
    updatedWords.sort((a, b) => a.start - b.start);
    ensureValidIntervals(updatedWords, p.duration || 60);

    markEdit({ ...p, words: updatedWords }, true);
    notify('Duplicated caption');
  }, [notify]);

  const handleAddCaptionAtTime = useCallback((atTime: number) => {
    const p = projectRef.current;
    if (!p) return;
    const dur = p.duration || 60;
    const startTime = Number(Math.max(0, Math.min(dur - 0.5, atTime)).toFixed(3));
    const endTime = Number(Math.min(dur, startTime + 2.0).toFixed(3));

    const totalDuration = Math.max(0.4, endTime - startTime);
    const tokens = ['New', 'caption'];
    const durPerWord = totalDuration / tokens.length;
    const newWords: Word[] = tokens.map((token, i) => {
      const wStart = Number((startTime + i * durPerWord).toFixed(3));
      const wEnd = Number((startTime + (i + 1) * durPerWord - (i < tokens.length - 1 ? 0.005 : 0)).toFixed(3));
      return {
        id: `w-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        text: token,
        original: token,
        start: wStart,
        end: Math.max(wStart + 0.05, wEnd),
        confidence: 1,
        emphasis: false,
        emphasisScore: 0.5,
      };
    });

    const updatedWords = [...p.words, ...newWords];
    updatedWords.sort((a, b) => a.start - b.start);
    ensureValidIntervals(updatedWords, dur);

    markEdit({ ...p, words: updatedWords }, true);
    setSelectedWord(newWords[0].id);
    setSelectedWordIds(new Set(newWords.map(w => w.id)));
    notify('Added new caption');
  }, [notify]);

  const handleClearAllCaptions = useCallback(() => {
    const p = projectRef.current;
    if (!p) return;
    markEdit({ ...p, words: [] }, true);
    setSelectedWord(null);
    setSelectedWordIds(new Set());
    notify('All captions cleared');
  }, [notify]);
  function handleDropWords(
    sourceWordIds: string[],
    targetGroupIdx: number,
    targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' }
  ) {
    const p = projectRef.current;
    if (!p || !sourceWordIds.length) return;

    const effectivePerLine = isSingleWordTemplate(settings.template) ? 1 : settings.wordsPerLine;
    const currentGroups = groupWords(p.words, effectivePerLine);
    if (targetGroupIdx < 0 || targetGroupIdx >= currentGroups.length) return;
    const targetGroup = currentGroups[targetGroupIdx];

    const validMovingIds = p.words.filter(w => sourceWordIds.includes(w.id)).map(w => w.id);
    if (!validMovingIds.length) return;

    if (typeof targetPosition === 'object' && validMovingIds.includes(targetPosition.targetWordId)) {
      return;
    }

    // Calculate how many words the target line will have after this drop
    const movingWordsAlreadyInTarget = targetGroup.filter(w => validMovingIds.includes(w.id)).length;
    const wordsBeingAdded = validMovingIds.length - movingWordsAlreadyInTarget;
    const targetLineWordCount = targetGroup.length + wordsBeingAdded;

    // Dropping onto a full line used to widen the *global* chunk size to fit,
    // up to twelve — so one drag quietly turned every other line in the project
    // into a paragraph, and the settings it produced were above the bound the
    // server accepts. The line grows only as far as the shared ceiling, and the
    // drop is refused rather than reshaping the whole project past it.
    if (!isSingleWordTemplate(settings.template) && targetLineWordCount > MAX_WORDS_PER_PAGE) {
      notify(`A line holds at most ${MAX_WORDS_PER_PAGE} words. Split the line first, or drop onto a shorter one.`);
      return;
    }

    const neededMax = isSingleWordTemplate(settings.template)
      ? 1
      : Math.min(MAX_WORDS_PER_PAGE, Math.max(targetLineWordCount, settings.wordsPerLine));

    const updatedWords = moveWordsToLine(p.words, validMovingIds, targetGroupIdx, targetPosition, neededMax, p.duration || 60);

    const nextSettings = neededMax > settings.wordsPerLine && !isSingleWordTemplate(settings.template)
      ? { ...settings, wordsPerLine: neededMax }
      : settings;

    markEdit({ ...p, words: updatedWords, settings: nextSettings }, true);
    setSelectedWordIds(new Set(validMovingIds));
    const firstMovedWord = updatedWords.find(w => validMovingIds.includes(w.id));
    if (firstMovedWord) {
      setSelectedWord(firstMovedWord.id);
      seek(firstMovedWord.start);
    }
    const label = validMovingIds.length > 1
      ? `${validMovingIds.length} words`
      : `"${p.words.find(w => w.id === validMovingIds[0])?.text.replace(/[.!?।]+$/, '')}"`;
    notify(`Moved ${label} to line ${targetGroupIdx + 1}`);
  }
  function handleDropWord(
    sourceWordId: string,
    targetGroupIdx: number,
    targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' }
  ) {
    handleDropWords([sourceWordId], targetGroupIdx, targetPosition);
  }
  function commitInlineEdit() {
    if (!editingWordId) return;
    const p = projectRef.current;
    if (p) {
      const updated = p.words.map(w => w.id === editingWordId ? { ...w, text: editingText.trim() || w.text } : w);
      markEdit({ ...p, words: updated });
    }
    setEditingWordId(null);
  }
  function cancelInlineEdit() {
    setEditingWordId(null);
  }
  function handleWordContextMenu(e: React.MouseEvent<HTMLElement>, word: Word) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedWord(word.id);
    if (!selectedWordIds.has(word.id)) {
      setSelectedWordIds(new Set([word.id]));
      lastSelectedWordIdRef.current = word.id;
    }
    seek(word.start);
    const rect = e.currentTarget.getBoundingClientRect();
    setTimelinePopover({
      word,
      rect,
      draftText: word.text,
      emphasis: !!word.emphasis,
      spotlight: !!word.spotlight,
      behind: !!word.behind,
    });
  }
  function handleTimelineWordClick(e: React.MouseEvent<HTMLElement>, word: Word) {
    e.stopPropagation();
    setSelectedWord(word.id);
    seek(word.start);
    const rect = e.currentTarget.getBoundingClientRect();
    setTimelinePopover({
      word,
      rect,
      draftText: word.text,
      emphasis: !!word.emphasis,
      spotlight: !!word.spotlight,
      behind: !!word.behind,
    });
  }
  /**
   * Highlight is one decision, not two.
   *
   * There used to be an Emphasize toggle beside this one, and the pair read as
   * two strengths of the same thing. They were not. `spotlight` is what the
   * renderer actually enlarges and accents; `emphasis` only nudged the score
   * that picks a hero when nothing is spotlighted, so on any page that already
   * had a spotlight it did nothing at all. A control that silently does nothing
   * is worse than no control, so Emphasize is gone from the interface.
   *
   * `emphasis` survives on the word as what it always really was: the
   * recogniser's acoustic suggestion. It picks the hero on pages the creator
   * has not touched, and shows as a faint badge meaning "we would pick this".
   * Highlighting a word is an explicit decision that replaces the suggestion.
   */
  function setWordHighlight(style: 'highlight' | 'clear') {
    if (!timelinePopover) return;
    const wordId = timelinePopover.word.id;
    const nextSpotlight = style === 'highlight' ? !timelinePopover.spotlight : false;
    const patch = { emphasis: false, spotlight: nextSpotlight };

    if (selectedWordIds.size > 1 && selectedWordIds.has(wordId)) {
      updateWords(selectedWordIds, patch);
    } else {
      updateWord(wordId, patch);
    }

    setTimelinePopover(p =>
      p ? { ...p, ...patch, word: { ...p.word, ...patch } } : null
    );
  }
  function applyTimelineWordCase(c: WordCase) {
    if (!timelinePopover) return;
    const w = timelinePopover.word;
    const newText = recase(w, c);
    if (selectedWordIds.size > 1 && selectedWordIds.has(w.id)) {
      for (const id of selectedWordIds) {
        const found = projectRef.current?.words.find(pw => pw.id === id);
        if (found) updateWord(id, { text: recase(found, c) });
      }
    } else {
      updateWord(w.id, { text: newText });
    }
    setTimelinePopover(p => p ? { ...p, word: { ...p.word, text: newText }, draftText: newText } : null);
  }
  function saveTimelineWordEdit() {
    if (!timelinePopover) return;
    const trimmed = timelinePopover.draftText.trim();
    if (trimmed && trimmed !== timelinePopover.word.text) {
      updateWord(timelinePopover.word.id, {
        text: trimmed,
        emphasis: timelinePopover.emphasis,
        spotlight: timelinePopover.spotlight,
        behind: timelinePopover.behind,
      });
      notify(`Updated "${trimmed}"`);
    }
    setTimelinePopover(null);
  }
  function calculatePopoverPosition(rect: DOMRect): { top: number; left: number } {
    // Matches the caption panel's own placement maths, since the two open the
    // same inspector at the same size.
    const width = 250;
    const height = 115;
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - 12) top = Math.max(10, rect.top - height - 8);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(window.innerWidth - width - 12, left));
    return { top, left };
  }
  function handleTimelineTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!project || !duration || !timelineTrackRef.current) return;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    seek(pct * duration);
  }

  function startWordHandleDrag(
    e: React.MouseEvent,
    word: Word,
    edge: 'left' | 'right'
  ) {
    e.preventDefault();
    e.stopPropagation();
    setTimelinePopover(null);

    const p = projectRef.current;
    if (!p || !duration || !timelineTrackRef.current) return;

    const vp = timelineViewportRef.current;
    const track = timelineTrackRef.current;
    const scrollWidth = track.offsetWidth || vp?.scrollWidth || 1;

    const wordIdx = p.words.findIndex(w => w.id === word.id);
    if (wordIdx === -1) return;

    const prevWord = wordIdx > 0 ? p.words[wordIdx - 1] : null;
    const nextWord = wordIdx < p.words.length - 1 ? p.words[wordIdx + 1] : null;

    const MIN_WORD_DURATION = 0.04;
    // Boundary respects neighboring words without corrupting them
    const minStart = prevWord ? Number((prevWord.end + 0.005).toFixed(3)) : 0;
    const maxEnd = nextWord ? Number((nextWord.start - 0.005).toFixed(3)) : duration;

    const startX = e.clientX;
    const origStart = word.start;
    const origEnd = word.end;

    let currentStart = origStart;
    let currentEnd = origEnd;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const dt = (deltaX / scrollWidth) * duration;

      if (edge === 'left') {
        const rawTargetStart = Number((origStart + dt).toFixed(3));
        const maxStart = Number((origEnd - MIN_WORD_DURATION).toFixed(3));
        currentStart = Math.max(minStart, Math.min(maxStart, rawTargetStart));
        currentEnd = origEnd;

        const updatedWords = p.words.map(w =>
          w.id === word.id ? { ...w, start: currentStart, end: currentEnd } : w
        );
        markEdit({ ...p, words: updatedWords }, false);
        seek(currentStart);
      } else {
        const rawTargetEnd = Number((origEnd + dt).toFixed(3));
        const minEnd = Number((origStart + MIN_WORD_DURATION).toFixed(3));
        currentEnd = Math.min(maxEnd, Math.max(minEnd, rawTargetEnd));
        currentStart = origStart;

        const updatedWords = p.words.map(w =>
          w.id === word.id ? { ...w, start: currentStart, end: currentEnd } : w
        );
        markEdit({ ...p, words: updatedWords }, false);
        seek(currentEnd);
      }

      setTimelineLiveTooltip({
        x: moveEvent.clientX,
        y: moveEvent.clientY - 50,
        lines: [
          `Start: ${timecode(currentStart)}`,
          `End: ${timecode(currentEnd)}`,
          `Duration: ${(currentEnd - currentStart).toFixed(2)}s`,
        ],
      });
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setTimelineLiveTooltip(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const latestProj = projectRef.current;
      if (!latestProj) return;

      const finalWords = latestProj.words.map(w =>
        w.id === word.id ? { ...w, start: currentStart, end: currentEnd } : w
      );
      ensureValidIntervals(finalWords, duration);
      commitDrag(p, { ...latestProj, words: finalWords });
      notify(`Adjusted "${word.text}" timing: ${timecode(currentStart)} - ${timecode(currentEnd)} (${(currentEnd - currentStart).toFixed(2)}s)`);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function startWordDividerDrag(
    e: React.MouseEvent,
    wordA: Word,
    wordB: Word
  ) {
    e.preventDefault();
    e.stopPropagation();
    setTimelinePopover(null);

    const p = projectRef.current;
    if (!p || !duration || !timelineTrackRef.current) return;

    const vp = timelineViewportRef.current;
    const track = timelineTrackRef.current;
    const scrollWidth = track.offsetWidth || vp?.scrollWidth || 1;

    const startX = e.clientX;
    const origSplit = wordA.end;
    const minSplit = wordA.start + 0.03;
    const maxSplit = wordB.end - 0.03;

    let currentSplit = origSplit;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let rafId: number | null = null;
    let latestEvent: MouseEvent | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      latestEvent = moveEvent;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!latestEvent) return;
        const deltaX = latestEvent.clientX - startX;
        const dt = (deltaX / scrollWidth) * duration;
        const targetSplit = Number((origSplit + dt).toFixed(3));
        currentSplit = Math.max(minSplit, Math.min(maxSplit, targetSplit));

        const updatedWords = p.words.map(w => {
          if (w.id === wordA.id) return { ...w, end: currentSplit };
          if (w.id === wordB.id) return { ...w, start: currentSplit };
          return w;
        });
        markEdit({ ...p, words: updatedWords }, false);
        seek(currentSplit);
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const latestProj = projectRef.current;
      if (!latestProj) return;

      const finalWords = latestProj.words.map(w => {
        if (w.id === wordA.id) return { ...w, end: currentSplit };
        if (w.id === wordB.id) return { ...w, start: currentSplit };
        return w;
      });
      ensureValidIntervals(finalWords, duration);
      commitDrag(p, { ...latestProj, words: finalWords });
      notify(`Adjusted boundary between "${wordA.text}" and "${wordB.text}" to ${currentSplit.toFixed(2)}s`);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function startWordDrag(
    e: React.MouseEvent,
    word: Word
  ) {
    if ((e.target as HTMLElement).closest('.timeline-word-edge-handle') || (e.target as HTMLElement).closest('.timeline-word-handle') || (e.target as HTMLElement).closest('.timeline-word-divider')) return;

    e.preventDefault();
    e.stopPropagation();

    const p = projectRef.current;
    if (!p || !duration || !timelineTrackRef.current) return;

    const vp = timelineViewportRef.current;
    const track = timelineTrackRef.current;
    const scrollWidth = track.offsetWidth || vp?.scrollWidth || 1;

    const wordIdx = p.words.findIndex(w => w.id === word.id);
    if (wordIdx === -1) return;

    const prevWord = wordIdx > 0 ? p.words[wordIdx - 1] : null;
    const nextWord = wordIdx < p.words.length - 1 ? p.words[wordIdx + 1] : null;

    const wordDur = Number((word.end - word.start).toFixed(3));
    const minStart = prevWord ? Number((prevWord.end + 0.005).toFixed(3)) : 0;
    const maxEnd = nextWord ? Number((nextWord.start - 0.005).toFixed(3)) : duration;
    const maxStart = Number((maxEnd - wordDur).toFixed(3));

    const startX = e.clientX;
    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const origStart = word.start;
    let clampedStart = origStart;
    let clampedEnd = word.end;
    let hasMoved = false;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 3) {
        hasMoved = true;
        setTimelinePopover(null);
      }

      if (!hasMoved) return;
      const dt = (deltaX / scrollWidth) * duration;
      const targetStart = origStart + dt;
      clampedStart = Number(Math.max(minStart, Math.min(maxStart, targetStart)).toFixed(3));
      clampedEnd = Number((clampedStart + wordDur).toFixed(3));

      const updatedWords = p.words.map(w =>
        w.id === word.id ? { ...w, start: clampedStart, end: clampedEnd } : w
      );
      markEdit({ ...p, words: updatedWords }, false);
      seek(clampedStart);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (!hasMoved) {
        // Left-click without dragging: select word, seek, and open the editing popover!
        selectWord(word.id, upEvent);
        seek(word.start);
        setTimelinePopover({
          word,
          rect: targetRect,
          draftText: word.text,
          emphasis: !!word.emphasis,
          spotlight: !!word.spotlight,
          behind: !!word.behind,
        });
        return;
      }

      const latestProj = projectRef.current;
      if (!latestProj) return;

      const finalWords = latestProj.words.map(w =>
        w.id === word.id ? { ...w, start: clampedStart, end: clampedEnd } : w
      );
      ensureValidIntervals(finalWords, duration);
      commitDrag(p, { ...latestProj, words: finalWords });
      notify(`Shifted "${word.text}" timing to ${timecode(clampedStart)}`);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function startGroupTrim(
    e: React.MouseEvent,
    group: Word[],
    edge: 'left' | 'right'
  ) {
    e.preventDefault();
    e.stopPropagation();
    setTimelinePopover(null);

    const p = projectRef.current;
    if (!p || !duration || !group.length || !timelineTrackRef.current) return;

    const vp = timelineViewportRef.current;
    const track = timelineTrackRef.current;
    const scrollWidth = track.offsetWidth || vp?.scrollWidth || 1;

    const firstWord = group[0];
    const lastWord = group[group.length - 1];

    const firstIdx = p.words.findIndex(w => w.id === firstWord.id);
    const lastIdx = p.words.findIndex(w => w.id === lastWord.id);
    if (firstIdx === -1 || lastIdx === -1) return;

    const prevWord = firstIdx > 0 ? p.words[firstIdx - 1] : null;
    const nextWord = lastIdx < p.words.length - 1 ? p.words[lastIdx + 1] : null;

    const origGStart = firstWord.start;
    const origGEnd = lastWord.end;
    const origDur = Math.max(0.04, origGEnd - origGStart);

    const minAllowedStart = prevWord ? Number((prevWord.end + 0.01).toFixed(3)) : 0;
    const maxAllowedEnd = nextWord ? Number((nextWord.start - 0.01).toFixed(3)) : duration;

    const startX = e.clientX;
    const initialWords = group.map(w => ({ id: w.id, start: w.start, end: w.end }));
    const gIds = new Set(group.map(w => w.id));

    let currentGStart = origGStart;
    let currentGEnd = origGEnd;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const dt = (deltaX / scrollWidth) * duration;

      if (edge === 'left') {
        const rawTargetStart = origGStart + dt;
        currentGStart = Math.max(minAllowedStart, Math.min(origGEnd - 0.08, rawTargetStart));
        currentGStart = Number(currentGStart.toFixed(3));
        const newDur = origGEnd - currentGStart;
        const ratio = newDur / origDur;

        const updatedWords = p.words.map(w => {
          if (gIds.has(w.id)) {
            const init = initialWords.find(iw => iw.id === w.id);
            if (init) {
              const s = origGEnd - (origGEnd - init.start) * ratio;
              const e = origGEnd - (origGEnd - init.end) * ratio;
              return {
                ...w,
                start: Number(s.toFixed(3)),
                end: Number(e.toFixed(3)),
              };
            }
          }
          return w;
        });

        markEdit({ ...p, words: updatedWords }, false);
        seek(currentGStart);
      } else {
        const rawTargetEnd = origGEnd + dt;
        currentGEnd = Math.min(maxAllowedEnd, Math.max(origGStart + 0.08, rawTargetEnd));
        currentGEnd = Number(currentGEnd.toFixed(3));
        const newDur = currentGEnd - origGStart;
        const ratio = newDur / origDur;

        const updatedWords = p.words.map(w => {
          if (gIds.has(w.id)) {
            const init = initialWords.find(iw => iw.id === w.id);
            if (init) {
              const s = origGStart + (init.start - origGStart) * ratio;
              const e = origGStart + (init.end - origGStart) * ratio;
              return {
                ...w,
                start: Number(s.toFixed(3)),
                end: Number(e.toFixed(3)),
              };
            }
          }
          return w;
        });

        markEdit({ ...p, words: updatedWords }, false);
        seek(currentGEnd);
      }
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const latestProj = projectRef.current;
      if (!latestProj) return;

      const newDur = edge === 'left' ? origGEnd - currentGStart : currentGEnd - origGStart;
      const ratio = newDur / origDur;

      const finalWords = latestProj.words.map(w => {
        if (gIds.has(w.id)) {
          const init = initialWords.find(iw => iw.id === w.id);
          if (init) {
            const s = edge === 'left'
              ? origGEnd - (origGEnd - init.start) * ratio
              : origGStart + (init.start - origGStart) * ratio;
            const e = edge === 'left'
              ? origGEnd - (origGEnd - init.end) * ratio
              : origGStart + (init.end - origGStart) * ratio;
            return {
              ...w,
              start: Number(s.toFixed(3)),
              end: Number(e.toFixed(3)),
            };
          }
        }
        return w;
      });

      ensureValidIntervals(finalWords, duration);
      commitDrag(p, { ...latestProj, words: finalWords });
      notify(`Adjusted sentence length: ${(currentGEnd - currentGStart).toFixed(2)}s`);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function startGroupDrag(
    e: React.MouseEvent,
    group: Word[]
  ) {
    if ((e.target as HTMLElement).closest('.timeline-group-handle') || (e.target as HTMLElement).closest('.timeline-group-bracket')) return;

    e.preventDefault();
    e.stopPropagation();
    setTimelinePopover(null);

    const p = projectRef.current;
    if (!p || !duration || !group.length || !timelineTrackRef.current) return;

    const vp = timelineViewportRef.current;
    const track = timelineTrackRef.current;
    const scrollWidth = track.offsetWidth || vp?.scrollWidth || 1;

    const gIds = new Set(group.map(w => w.id));
    const firstWord = group[0];
    const lastWord = group[group.length - 1];

    const firstIdx = p.words.findIndex(w => w.id === firstWord.id);
    const lastIdx = p.words.findIndex(w => w.id === lastWord.id);
    if (firstIdx === -1 || lastIdx === -1) return;

    const prevWord = firstIdx > 0 ? p.words[firstIdx - 1] : null;
    const nextWord = lastIdx < p.words.length - 1 ? p.words[lastIdx + 1] : null;

    const gStart = firstWord.start;
    const gEnd = lastWord.end;

    const minAllowedStart = prevWord ? Number((prevWord.end + 0.01).toFixed(3)) : 0;
    const maxAllowedEnd = nextWord ? Number((nextWord.start - 0.01).toFixed(3)) : duration;

    const minShift = minAllowedStart - gStart;
    const maxShift = maxAllowedEnd - gEnd;

    const startX = e.clientX;
    const initialWords = group.map(w => ({ id: w.id, start: w.start, end: w.end }));

    let clampedDt = 0;
    let hasMoved = false;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 2) {
        hasMoved = true;
      }

      const rawDt = (deltaX / scrollWidth) * duration;
      clampedDt = Math.max(minShift, Math.min(maxShift, rawDt));

      const updatedWords = p.words.map(w => {
        if (gIds.has(w.id)) {
          const init = initialWords.find(iw => iw.id === w.id);
          if (init) {
            return {
              ...w,
              start: Number((init.start + clampedDt).toFixed(3)),
              end: Number((init.end + clampedDt).toFixed(3)),
            };
          }
        }
        return w;
      });

      markEdit({ ...p, words: updatedWords }, false);
      seek(Number((gStart + clampedDt).toFixed(3)));

      setTimelineLiveTooltip({
        x: moveEvent.clientX,
        y: moveEvent.clientY - 50,
        lines: [
          `Move: ${clampedDt >= 0 ? '+' : ''}${clampedDt.toFixed(2)}s`,
          `Start: ${timecode(gStart + clampedDt)} · End: ${timecode(gEnd + clampedDt)}`,
        ],
      });
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setTimelineLiveTooltip(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (!hasMoved) {
        seek(gStart);
        return;
      }

      const latestProj = projectRef.current;
      if (!latestProj) return;

      const finalWords = latestProj.words.map(w => {
        if (gIds.has(w.id)) {
          const init = initialWords.find(iw => iw.id === w.id);
          if (init) {
            return {
              ...w,
              start: Number((init.start + clampedDt).toFixed(3)),
              end: Number((init.end + clampedDt).toFixed(3)),
            };
          }
        }
        return w;
      });

      ensureValidIntervals(finalWords, duration);
      commitDrag(p, { ...latestProj, words: finalWords });
      notify(`Shifted caption line timing by ${clampedDt >= 0 ? '+' : ''}${clampedDt.toFixed(2)}s`);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
  function handleMergeWithNext(group: Word[]) {
    const p = projectRef.current; if (!p || !group.length) return;
    const last = group[group.length - 1];
    const updated = mergeLines(p.words, last.id);
    markEdit({ ...p, words: updated });
    notify('Caption lines merged.');
  }
  function handleSplitWord(wordId: string) {
    const p = projectRef.current; if (!p) return;
    const target = p.words.find(w => w.id === wordId);
    if (!target) return;
    const dur = target.end - target.start;
    if (dur < 0.08) { notify('Word interval is too short to split.'); return; }
    const mid = Number((target.start + dur / 2).toFixed(3));
    const nextWord: Word = {
      id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: 'word', original: 'word', start: mid, end: target.end,
      confidence: 1, emphasis: false, emphasisScore: 0.5,
    };
    const updatedWords = p.words.flatMap(w =>
      w.id === wordId ? [{ ...w, end: Number((mid - 0.005).toFixed(3)) }, nextWord] : [w]
    );
    markEdit({ ...p, words: updatedWords });
    setSelectedWord(nextWord.id);
    notify('Split into two words.');
  }
  function handleNudgeWordTiming(word: Word, key: 'start' | 'end', delta: number) {
    const list = projectRef.current?.words ?? [];
    const i = list.findIndex(w => w.id === word.id);
    if (i === -1) return;
    const min = key === 'start' ? (list[i - 1]?.end ?? 0) + 0.005 : word.start + 0.02;
    const max = key === 'end' ? (list[i + 1]?.start ?? duration) - 0.005 : word.end - 0.02;
    const targetVal = Number((word[key] + delta).toFixed(2));
    const clamped = Math.max(min, Math.min(max, targetVal));
    if (Math.abs(clamped - word[key]) < 0.005) {
      notify(`Cannot move past adjacent word at ${clamped.toFixed(2)}s.`);
      return;
    }
    updateWord(word.id, { [key]: clamped });
  }
  function handleTransformCase(mode: 'upper' | 'lower' | 'title') {
    const p = projectRef.current;
    if (!p || busy || !p.words.length) return;
    const updated = p.words.map(w => {
      let text = w.text;
      if (mode === 'upper') text = text.toUpperCase();
      else if (mode === 'lower') text = text.toLowerCase();
      else if (mode === 'title') text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      return { ...w, text };
    });
    markEdit({ ...p, words: updated });
    notify(`Converted all words to ${mode === 'upper' ? 'UPPERCASE' : mode === 'title' ? 'Title Case' : 'lowercase'}.`);
  }
  const playInterval = useCallback((start: number, end: number) => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    seek(start);
    if (project && media.current) {
      const dur = Math.max(0.1, (end - start) * 1000);
      // Only claim to be playing once the browser agrees. Setting it up front
      // and swallowing the rejection is what left the state stuck true.
      void media.current.play().then(() => {
        setPlaying(true);
        pauseTimerRef.current = setTimeout(() => {
          media.current?.pause();
          setPlaying(false);
        }, dur + 60);
      }).catch(() => setPlaying(false));
    } else {
      setPlaying(true);
      const dur = Math.max(0.1, (end - start) * 1000);
      pauseTimerRef.current = setTimeout(() => {
        setPlaying(false);
      }, dur + 60);
    }
  }, [project, duration]);
  function setVideoEnabled(enabled: boolean) {
    const p = projectRef.current;
    if (!p || p.mediaType !== 'video' || busy) return;
    setPlaying(false); media.current?.pause();
    markEdit({ ...p, videoEnabled: enabled });
    notify(enabled ? 'Video restored. Audio and captions are unchanged.' : 'Video removed. Audio and captions will render on black.');
  }
  function changeTiming(word: Word, key: 'start' | 'end', value: number) {
    const list = projectRef.current?.words ?? []; const i = list.findIndex(w => w.id === word.id);
    const min = key === 'start' ? list[i-1]?.end ?? 0 : word.start + .01;
    const max = key === 'start' ? word.end - .01 : list[i+1]?.start ?? duration;
    if (!Number.isFinite(value) || value < min-.001 || value > max+.001) { notify(`Choose a time between ${min.toFixed(2)} and ${max.toFixed(2)} seconds.`); return; }
    updateWord(word.id,{ [key]: value });
  }
  function undo() {
    const p = projectRef.current; const previous = historyRef.current.at(-1); if (!p || !previous || ['queued', 'processing', 'transcribing', 'extracting'].includes(p.status)) return;
    setFuture(f => [...f,{ words:p.words,settings:p.settings,name:p.name,videoEnabled:p.videoEnabled,canvasElements:p.canvasElements,activeMediaAssetId:p.activeMediaAssetId }]); setHistory(h => h.slice(0,-1)); markEdit({ ...p,...previous },false);
  }
  function redo() {
    const p = projectRef.current; const next = futureRef.current.at(-1); if (!p || !next || ['queued', 'processing', 'transcribing', 'extracting'].includes(p.status)) return;
    setHistory(h => [...h,{ words:p.words,settings:p.settings,name:p.name,videoEnabled:p.videoEnabled,canvasElements:p.canvasElements,activeMediaAssetId:p.activeMediaAssetId }]); setFuture(f => f.slice(0,-1)); markEdit({ ...p,...next },false);
  }
  const pendingCaptionRange = useRef<{ start: number; end: number } | null>(null);
  const [captionNavigation, setCaptionNavigation] = useState(0);
  useEffect(() => {
    const range = pendingCaptionRange.current;
    const viewport = timelineViewportRef.current;
    if (!range || !viewport || !duration) return;
    const frame = requestAnimationFrame(() => {
      pendingCaptionRange.current = null;
      const width = viewport.scrollWidth;
      const startPx = range.start / duration * width;
      const endPx = range.end / duration * width;
      const padding = Math.min(32, viewport.clientWidth * .1);
      viewport.scrollLeft = Math.max(0, Math.min(width - viewport.clientWidth,
        endPx - viewport.clientWidth + padding));
      // If the group is short, keep both its first and final words in view.
      if (startPx < viewport.scrollLeft + padding)
        viewport.scrollLeft = Math.max(0, startPx - padding);
      readTimelineWindow();
    });
    return () => cancelAnimationFrame(frame);
  }, [captionNavigation, timelineZoom, duration, readTimelineWindow]);

  function focusCaptionGroup(group: Word[]) {
    const viewport = timelineViewportRef.current;
    if (!group.length || !viewport || !duration) return;
    const start = Math.max(0, group[0].start);
    const end = Math.min(duration, group[group.length - 1].end);
    pendingCaptionRange.current = { start, end };
    setCaptionNavigation(value => value + 1);
    // Fit wide groups into the timeline instead of hiding their opening words.
    const fitZoom = Math.max(1, Math.min(32, duration * .8 / Math.max(.01, end - start)));
    setTimelineZoom(zoom => Math.min(zoom, fitZoom));
    seek(end);
  }

  function seek(value: number) { if (!project) return; const t = Math.max(0,Math.min(duration,value)); setTime(t); if (media.current) media.current.currentTime=t; }
  const togglePlay = useCallback(() => {
    if (!project || !media.current) return;
    // The element decides, not the `playing` state. That state is set from
    // events and, in one place, optimistically — so a play() that never started
    // could leave it true while the element sat paused. This button then called
    // pause() on something already paused, which does nothing and fires no
    // event to correct the state, so playback was stuck for good with nothing
    // shown. Reading `paused` cannot drift.
    if (!media.current.paused) media.current.pause();
    else {
      if (media.current.currentTime >= duration-.02) media.current.currentTime=0;
      const element = media.current;
      void element.play().catch((error: DOMException) => {
        // Not every rejection means the file is unplayable, and saying so when
        // it is not sends people off to re-encode a video that was always fine.
        //
        // AbortError is the common one and is harmless: the browser rejects a
        // pending play() whenever the source is reloaded or pause() is called,
        // which an edit elsewhere in the editor can easily cause. There is
        // nothing to report — the element is simply not playing yet.
        if (error?.name === 'AbortError') return;
        // A real problem leaves the element holding the reason.
        if (element.error) {
          notify(element.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
            ? 'This media could not play. Try re-uploading as MP4 or WAV.'
            : 'The media could not be loaded. Check your connection and try again.');
          return;
        }
        notify('Playback could not start. Press play again.');
      });
    }
  }, [project, duration, notify]);
  useEffect(() => {
    if (!playing || !project) return;
    let frame = 0;
    let previousFrame = -1;
    const tick = () => {
      const current = media.current?.currentTime;
      if (current !== undefined && playbackFrame(current, CAPTION_FPS) !== previousFrame) {
        previousFrame = playbackFrame(current, CAPTION_FPS); setTime(current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, project?.id]);
  useEffect(() => {
    if (media.current) media.current.playbackRate = playbackRate;
  }, [playbackRate]);
  // The <Player> is never played on its own: the <video> element owns the clock
  // and the caption layer is seeked to match, so audio and captions cannot drift.
  useEffect(() => {
    const player = captionPlayer.current;
    if (!player) return;
    const target = Math.round(time * CAPTION_FPS);
    if (Math.abs(player.getCurrentFrame() - target) >= 1) player.seekTo(target);
  }, [time]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size.width, size.height);
    if (!project) return;

    const redraw = () => setMediaFrameVersion(v => v + 1);
    // 1. If active media has greenScreen enabled, render keyed video frame
    const primaryKey = activeMediaAsset ? activeMediaAsset.greenScreen : project.greenScreen;
    if (primaryKey?.enabled && media.current && hasVideoLayer && videoEnabled && media.current.readyState >= 2) {
      const video = media.current;
      const ratio = Math.min(size.width / video.videoWidth, size.height / video.videoHeight);
      const w = video.videoWidth * ratio, h = video.videoHeight * ratio;
      drawKeyedMedia(ctx, video, (size.width-w)/2, (size.height-h)/2, w, h, primaryKey);
    }

    // 2. Draw canvas overlay image & video elements
    for (const el of orderedElements(canvasElements)) {
      if (el.visible === false) continue;
      if (el.start !== undefined && time < el.start) continue;
      if (el.end !== undefined && time > el.end) continue;

      const sourceUrl = mediaUrl(assetMediaPath(project.id, el.assetId));
      if (!sourceUrl) continue;
      if (el.type === 'video') {
        let vid = videoCacheRef.current.get(`${project.id}:${el.id}`);
        if (!vid) {
          vid = document.createElement('video');
          vid.crossOrigin = 'anonymous';
          vid.muted = true;
          vid.playsInline = true;
          vid.preload = 'auto';
          vid.onloadeddata = redraw; vid.onseeked = redraw;
          vid.src = sourceUrl;
          videoCacheRef.current.set(`${project.id}:${el.id}`, vid);
        }
        syncMediaSource(vid, sourceUrl);
        if (vid.readyState >= 2) {
          const elW = (size.width * 0.32) * (el.scale || 1.0);
          const elH = (vid.videoHeight / (vid.videoWidth || 1)) * elW;
          const elX = (el.x / 100) * size.width - elW / 2;
          const elY = (el.y / 100) * size.height - elH / 2;
          const elementTime = Math.max(0, time - (el.start || 0));
          if (Math.abs(vid.currentTime - (elementTime % (vid.duration || 1))) > 0.1) {
            vid.currentTime = elementTime % (vid.duration || 1);
          }
          ctx.save(); ctx.translate(elX + elW / 2, elY + elH / 2); ctx.rotate((el.rotation || 0) * Math.PI / 180);
          drawKeyedMedia(ctx, vid, -elW/2, -elH/2, elW, elH, el.greenScreen); ctx.restore();
        }
      } else {
        let img = imageCacheRef.current.get(`${project.id}:${el.assetId}`);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = sourceUrl;
          img.onload = redraw;
          imageCacheRef.current.set(`${project.id}:${el.assetId}`, img);
        }
        syncMediaSource(img, sourceUrl);
        if (img.complete && img.naturalWidth > 0) {
          const elW = (size.width * 0.32) * (el.scale || 1.0);
          const elH = (img.naturalHeight / (img.naturalWidth || 1)) * elW;
          const elX = (el.x / 100) * size.width - elW / 2;
          const elY = (el.y / 100) * size.height - elH / 2;
          ctx.save(); ctx.translate(elX + elW / 2, elY + elH / 2); ctx.rotate((el.rotation || 0) * Math.PI / 180);
          drawKeyedMedia(ctx, img, -elW/2, -elH/2, elW, elH, el.greenScreen); ctx.restore();
        }
      }
    }

    // 3. Captions are no longer drawn here. They render above this canvas in a
    // Remotion <Player> using the exact composition the exporter renders, so the
    // preview cannot drift from the finished file.

  }, [project, words, settings, time, size.width, size.height, groups, activeMediaAsset, canvasElements, selectedCanvasElementId, hasVideoLayer, videoEnabled, mediaFrameVersion, mediaTokenTick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (isBrowserZoomKey(e)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!showCommandPalette && document.querySelector('[aria-modal="true"], dialog[open]')) return;
        setShowCommandPalette(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        if (showCommandPalette) { setShowCommandPalette(false); return; }
        if (modal) { setModal(null); return; }
        if (timelinePopover) { setTimelinePopover(null); return; }
        if (captionToolsOpen) { setCaptionToolsOpen(false); return; }
        if (editingWordId) { setEditingWordId(null); return; }
      }
      // Save and palette are intentional inside text fields; punctuation,
      // native undo and formatting belong to the focused editor.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void flushSave().catch(()=>{}); return; }
      if ((e.target as HTMLElement)?.closest('[aria-modal="true"], dialog[open]')) return;
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/') || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault();
        setModal(m => m === 'shortcuts' ? null : 'shortcuts');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); handleSplitAtCurrent(); return; }
      if ((e.target as HTMLElement)?.closest('input, textarea, select, dialog, button, a, [contenteditable]')) return;
      if (selectedCanvasElementId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handleDeleteCanvasElement(selectedCanvasElementId);
        return;
      }
      if (selectedCanvasElementId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const element = projectRef.current?.canvasElements?.find(t => t.id === selectedCanvasElementId);
        const changes = element ? canvasKeyboardChange(element, e.key, e.shiftKey) : null;
        if (changes) handleUpdateCanvasElement(selectedCanvasElementId, changes);
        return;
      }
      if (selectedWord && !selectedCanvasElementId) {
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          const p = projectRef.current;
          if (p) {
            const wIdx = p.words.findIndex(w => w.id === selectedWord);
            if (wIdx !== -1) {
              const curW = p.words[wIdx];
              const prevW = wIdx > 0 ? p.words[wIdx - 1] : null;
              const nextW = wIdx < p.words.length - 1 ? p.words[wIdx + 1] : null;
              const step = e.key === 'ArrowLeft' ? -0.05 : 0.05;
              const minS = prevW ? Number((prevW.end + 0.005).toFixed(3)) : 0;
              const maxE = nextW ? Number((nextW.start - 0.005).toFixed(3)) : duration;
              const curDur = curW.end - curW.start;
              let newS = Number((curW.start + step).toFixed(3));
              let newE = Number((curW.end + step).toFixed(3));
              if (step < 0 && newS < minS) {
                newS = minS;
                newE = Number((newS + curDur).toFixed(3));
              } else if (step > 0 && newE > maxE) {
                newE = maxE;
                newS = Number((newE - curDur).toFixed(3));
              }
              const updated = p.words.map(w => w.id === selectedWord ? { ...w, start: newS, end: newE } : w);
              ensureValidIntervals(updated, duration);
              markEdit({ ...p, words: updated }, true);
              seek(newS);
              notify(`Nudged "${curW.text}" to ${timecode(newS)}`);
            }
          }
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleDeleteWord(selectedWord);
          return;
        }
      }
      // NLE Line Jump: [ (previous line), ] (next line)
      if (e.key === '[') {
        e.preventDefault();
        if (groups.length) {
          const curIdx = groups.findIndex(g => time >= g[0].start && time <= g.at(-1)!.end);
          if (curIdx > 0) {
            seek(groups[curIdx - 1][0].start);
          } else if (curIdx === -1) {
            const prev = [...groups].reverse().find(g => g.at(-1)!.end < time);
            if (prev) seek(prev[0].start);
            else seek(0);
          } else {
            seek(0);
          }
        }
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        if (groups.length) {
          const curIdx = groups.findIndex(g => time >= g[0].start && time <= g.at(-1)!.end);
          if (curIdx !== -1 && curIdx < groups.length - 1) {
            seek(groups[curIdx + 1][0].start);
          } else if (curIdx === -1) {
            const next = groups.find(g => g[0].start > time);
            if (next) seek(next[0].start);
          }
        }
        return;
      }
      // NLE Shuttle controls: J (rewind 1s), K (toggle play), L (forward 1s)
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        seek(Math.max(0, time - 1));
        return;
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        seek(Math.min(duration, time + 1));
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setTimelineZoom(z => Math.min(32, Number((z * 1.35).toFixed(2))));
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        setTimelineZoom(z => Math.max(1, Number((z / 1.35).toFixed(2))));
        return;
      }
      if (e.shiftKey && (e.key === '>' || e.key === '.')) {
        e.preventDefault();
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const next = speeds[Math.min(speeds.length - 1, speeds.indexOf(playbackRate) + 1)];
        setPlaybackRate(next);
        notify(`Playback speed: ${next}x`);
        return;
      }
      if (e.shiftKey && (e.key === '<' || e.key === ',')) {
        e.preventDefault();
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const prev = speeds[Math.max(0, speeds.indexOf(playbackRate) - 1)];
        setPlaybackRate(prev);
        notify(`Playback speed: ${prev}x`);
        return;
      }
      if (e.key === 'ArrowLeft' && !selectedCanvasElementId && !e.altKey) {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : (1 / 30);
        seek(Math.max(0, time - step));
        return;
      }
      if (e.key === 'ArrowRight' && !selectedCanvasElementId && !e.altKey) {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : (1 / 30);
        seek(Math.min(duration, time + step));
        return;
      }
      if (e.key === 'ArrowUp') { e.preventDefault(); setTimelineZoom(z => Math.min(32, Number((z * 1.35).toFixed(2)))); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setTimelineZoom(z => Math.max(1, Number((z / 1.35).toFixed(2)))); return; }
    };
    // Capture Space before a focused button can activate itself. Text editors
    // and dialogs keep their native keyboard behavior; Enter still activates buttons.
    const onPlaybackSpace = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || (e.code !== 'Space' && e.key !== ' ')) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (document.querySelector('[aria-modal="true"], dialog[open]') ||
          target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) togglePlay();
    };
    window.addEventListener('keydown', onPlaybackSpace, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onPlaybackSpace, true);
      window.removeEventListener('keydown', onKey);
    };
  },[togglePlay,flushSave,timelinePopover,captionToolsOpen,editingWordId,selectedWord,time,project,selectedCanvasElementId,handleDeleteCanvasElement,busy,groups,duration,modal,playbackRate,notify,showCommandPalette]);

  async function importFile(file?: File) {
    if (!file || uploadProgress !== null) return;
    if (file.size > 1024*1024*1024) { notify('Choose a file smaller than 1 GB.'); return; }
    setUploadProgress(0); setPlaying(false); media.current?.pause();
    try {
      await flushSave();
      const result = await upload(file,script,language,setUploadProgress);
      result.name = file.name || result.filename || result.name;
      result.settings = result.settings || defaults;
      setProject(result); projectRef.current=result; setSettings(result.settings); setTime(0); setSelectedWord(null); setSelectedWordIds(new Set()); setHistory([]); setFuture([]); setCaptionToolsOpen(false); setSaveStatus('Temporary session');
           setProjects(list=>[result,...list.filter(p=>p.id!==result.id)]);
      setImportAutoHighlight(result.settings.autoHighlight !== false);
      setLanguagePrompt('open');
      void refreshLimits();
    } catch(e) { notify((e as Error).message); }
    finally { setUploadProgress(null); if(input.current) input.current.value=''; }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);

    // Check if internal media asset was dragged from Project Media library
    const mediaAssetJson = e.dataTransfer.getData('application/json');
    if (mediaAssetJson) {
      try {
        const asset = JSON.parse(mediaAssetJson) as MediaAsset;
        if (asset && asset.id) {
          handleAddMediaToCanvas(asset);
          notify(`Added "${asset.name}" to canvas`);
          return;
        }
      } catch {}
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      void importFile(files[0]);
    }
  };
  async function openProject(p: Project) {
    try {
      await flushSave();
      const result=await request<Project>(`/projects/${p.id}`);
      const projectScript = result.script || 'roman';
      const projectLanguage = result.language || 'auto';
      // Opening a project used to run autoDetectHighlights over it, writing
      // `spotlight: true` onto whichever word scored best on each line. That is
      // the field meaning "the creator chose this word", so an automatic guess
      // was being recorded as a decision — and then honoured as one, which is
      // why turning highlighting off left words still enlarged. The renderer
      // picks a hero per line on its own when asked to; nothing needs writing
      // down for that to work.
      const normalized = { ...result, words: result.words || [], script: projectScript, language: projectLanguage };
      setPlaying(false); setTime(0); setProject(normalized); projectRef.current=normalized; setSettings(normalized.settings); setScript(projectScript); setLanguage(projectLanguage); setSelectedWord(null); setSelectedWordIds(new Set()); setHistory([]); setFuture([]); setCaptionToolsOpen(false); setModal(null);
      setActiveMediaAsset(result.mediaAssets?.find(a => a.id === result.activeMediaAssetId) ?? null); setCanvasElements(result.canvasElements || []); setSelectedCanvasElementId(null);
         }
    catch(e) { notify((e as Error).message); }
  }

  /**
   * Delete the open project on the server, then empty the editor of it.
   *
   * The pending save is flushed first, the way opening and exporting already
   * do. Saves are debounced by 650ms, so a delete issued inside that window
   * left a PATCH queued against a project that no longer existed, and the
   * creator — already looking at an empty editor — was told "Project not
   * found." about work they had just deliberately thrown away. Emptying the
   * queue before the request goes out closes that window rather than narrowing
   * it, and it means a refused delete has not silently dropped their last edit.
   *
   * Throws on to the panel rather than notifying here. The server refuses while
   * a transcript or an export is still running, and that refusal has to reach
   * the button that asked, so it can stay armed and let them try again.
   */
  const handleDeleteProject = useCallback(async () => {
    const target = projectRef.current;
    if (!target) return;
    await flushSave().catch(() => {});
    await deleteProject(target.id);
    // Anything the flush did not cover — a keystroke landing during the request
    // — must not become a save aimed at a project that is now gone.
    savedDirty.current = dirtyRef.current;
    setProjects(list => list.filter(p => p.id !== target.id));
    setProject(null); projectRef.current = null;
    setSettings(defaults);
    setPlaying(false); setTime(0);
    setSelectedWord(null); setSelectedWordIds(new Set());
    setHistory([]); setFuture([]);
    setProjectAssets([]); setActiveMediaAsset(null);
    setCanvasElements([]); setSelectedCanvasElementId(null);
    setActiveExportId(null);
    // The media token for a deleted project opens nothing, and keeping it would
    // have the next project's URLs built against a stale entry.
    forgetMediaTokens();
    setSaveStatus('Temporary session');
    void refreshLimits();
    notify(`Deleted “${target.name || target.filename}”.`);
    setActiveNavPanel('caption');
  }, [flushSave, notify, refreshLimits]);
  async function startExport() {
    if (!project) return;
    const currentProject = project;
    setExporting(true);
    setLastDownloadedExportId(null);
    try {
      await flushSave();
      const job = await request<ExportJob>(`/projects/${currentProject.id}/exports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: exportMode, resolution, fps: exportFps }),
      });
      if (job?.id) {
        setActiveExportId(job.id);
      }
      const result = await request<Project>(`/projects/${currentProject.id}`);
      if (projectRef.current?.id === currentProject.id) {
        setProject(p => p?.id === currentProject.id ? { ...p, exports: result.exports } : p);
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  function downloadTranscript(format: 'srt' | 'vtt' | 'json' | 'txt' | 'csv') {
    if(!project) return;
    const text = format === 'json'
      ? JSON.stringify({ name: project.name, words: project.words, settings }, null, 2)
      : format === 'txt'
      ? plainTranscript(project.words, settings.wordsPerLine)
      : format === 'csv'
      ? csvTranscript(project.words)
      : subtitleText(project.words, settings.wordsPerLine, format);
    const blob = new Blob([text], {
      type: format === 'json'
        ? 'application/json'
        : format === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Downloaded .${format.toUpperCase()} transcript`);
  }
  function copyTranscript() {
    if (!project?.words.length) return;
    const text = plainTranscript(project.words, settings.wordsPerLine);
    navigator.clipboard.writeText(text).then(() => {
      notify('Transcript copied to clipboard!');
    }).catch(() => {
      notify('Could not copy to clipboard.');
    });
  }
  async function downloadAudioTrack() {
    const target = projectRef.current;
    if (!target) return;
    try {
      const blob = await downloadAudioBlob(target.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${target.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}.m4a`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Audio download started.');
    } catch (error) { notify((error as Error).message); }
  }

  /**
   * Start recognition, optionally overriding what the project currently says.
   *
   * The overrides are passed rather than set through `setScript`/`setLanguage`
   * first: those are React state, so a caller that sets them and immediately
   * starts a run would send the previous values and transcribe in the wrong
   * language without ever saying so.
   */
  async function startTranscription(overrides?: { script?: string; language?: string; emoji?: boolean; translate?: boolean; autoHighlight?: boolean }) {
    const currentProject = projectRef.current;
    if(!currentProject) return;
    const highlightChoice = overrides?.autoHighlight !== undefined ? overrides.autoHighlight : (settings.autoHighlight !== false);
    const body = {
      script: overrides?.script ?? currentProject.script,
      language: overrides?.language ?? currentProject.language,
      glossary: currentProject.glossary ?? [],
      isolateVocals: !!currentProject.isolateVocals,
      emoji: overrides?.emoji ?? !!currentProject.emoji,
      translate: overrides?.translate ?? !!currentProject.translate,
      autoHighlight: highlightChoice,
    };
    if (highlightChoice !== undefined) {
      updateSettings({ autoHighlight: highlightChoice });
    }
    try {
      await flushSave();
      const result=await request<Project>(`/projects/${currentProject.id}/transcribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (projectRef.current?.id === currentProject.id) {
        // Accepted generation invalidates Undo and Redo from the prior transcript.
        setHistory([]); setFuture([]);
        setProject(result);
        projectRef.current=result;
        setScript(result.script);
        setLanguage(result.language);
        if (result.settings) setSettings(result.settings);
      }
    }
    catch(e){notify((e as Error).message);}
  }
  const retryTranscription = () => startTranscription();

  return <div className="app-shell">
    <input ref={input} type="file" accept="video/*,audio/*,.mkv,.m4a,.wav,.mp3,.webm" hidden onChange={e=>void importFile(e.target.files?.[0])}/>

    <StudioNavbar
      project={project}
      busy={busy}
      health={health}
      saveStatus={saveStatus}
      hasUndo={history.length > 0}
      hasRedo={future.length > 0}
      theme={theme}
      authEnabled={AUTH_ENABLED}
      accountEmail={accountEmail}
      accountName={accountName}
      accountMenuOpen={accountMenu !== null}
      onRenameProject={name => project && markEdit({ ...project, name })}
      onUndo={undo}
      onRedo={redo}
      onThemeChange={persistTheme}
      onToggleAccountMenu={rect => {
        if (accountMenu) {
          setAccountMenu(null);
        } else if (rect) {
          setAccountMenu({
            top: rect.bottom + 8,
            right: Math.max(12, window.innerWidth - rect.right),
          });
        }
      }}
      onOpenExport={() => setModal('export')}
      onOpenShortcuts={() => setModal('shortcuts')}
    />

    <div className="studio">
      <aside className="studio-nav-rail" aria-label="Main navigation panels">
        <div className="rail-nav-group">
          {NAV_PANELS.map(panel => (
            <button
              key={panel.id}
              type="button"
              className={`rail-nav-item ${activeNavPanel === panel.id ? 'active' : ''}`}
              title={panel.label}
              aria-label={panel.label}
              aria-pressed={activeNavPanel === panel.id}
              onClick={() => setActiveNavPanel(panel.id)}
            >
              <span className="rail-nav-icon">{panel.icon}</span>
              <span className="rail-nav-label">{panel.label}</span>
            </button>
          ))}
        </div>

        <div className="rail-footer-group">
          <div
            className="rail-status-dot-wrap"
            title={health ? (import.meta.env.DEV ? 'Local workspace' : 'Cloud workspace (Apex)') : (import.meta.env.DEV ? 'Waiting for local worker' : 'Connecting to cloud AI worker...')}
            aria-label={health ? (import.meta.env.DEV ? 'Local workspace' : 'Cloud workspace (Apex)') : (import.meta.env.DEV ? 'Waiting for local worker' : 'Connecting to cloud AI worker...')}
          >
            <span className={health ? 'status-dot' : 'status-dot offline'} />
          </div>
          <button
            type="button"
            className="rail-nav-item rail-help-btn"
            title="Help & Shortcuts"
            aria-label="Help & Shortcuts"
            onClick={() => setModal('help')}
          >
            <span className="rail-nav-icon"><CircleHelp size={20} strokeWidth={1.75} /></span>
          </button>
        </div>
      </aside>

      <main className="editor-grid">
        {activeNavPanel === 'caption' ? (
          <CaptionsPanel
            project={project}
            projectAssets={projectAssets}
            activeMediaAsset={activeMediaAsset}
            time={time}
            playing={playing}
            groups={groups}
            heroWordIds={heroWordIds}
            onInsertWord={handleInsertWord}
            onClearAllHighlights={handleClearAllHighlights}
            onDropWordsAsNewLine={handleDropWordsAsNewLine}
            settings={settings}
            selectedWord={selectedWord}
            selectedWordIds={selectedWordIds}
            duration={duration}
            busy={busy}
            onSelectWord={selectWord}
            onSeek={seek}
            onFocusGroup={focusCaptionGroup}
            onTogglePlay={togglePlay}
            onUpdateSettings={updateSettings}
            onUpdateWord={updateWord}
            onUpdateWords={updateWords}
            onDeleteWord={handleDeleteWord}
            onDeleteWords={handleDeleteWords}
            onDeleteGroup={handleDeleteLine}
            onSplitLine={handleSplitLine}
            onMoveToPreviousLine={handleMoveToPreviousLine}
            onMoveToNextLine={handleMoveToNextLine}
            onDropWord={handleDropWord}
            onDropWords={handleDropWords}
            onSplitGroup={(group, wIdx) => {
              const splitWord = wIdx !== undefined ? group[wIdx] : group[Math.floor(group.length / 2)];
              if (splitWord) handleSplitLine(splitWord.id);
            }}
            onMergeGroups={(srcIdx, tgtIdx) => {
              const firstIdx = Math.min(srcIdx, tgtIdx);
              const firstGroup = groups[firstIdx];
              if (firstGroup?.length && projectRef.current) {
                const lastWord = firstGroup[firstGroup.length - 1];
                const updated = mergeLines(projectRef.current.words, lastWord.id);
                markEdit({ ...projectRef.current, words: updated });
                notify('Merged captions');
              }
            }}
            onDuplicateGroup={handleDuplicateGroup}
            onAddCaptionAtTime={handleAddCaptionAtTime}
            onEditCaptionGroup={handleEditCaptionGroup}
            onClearAllCaptions={handleClearAllCaptions}
            onRegenerateCaptions={async (sourceAssetId, scriptParam, languageParam, glossary, isolateVocals) => {
              if (sourceAssetId && sourceAssetId !== activeMediaAsset?.id) {
                const asset = projectAssets.find(a => a.id === sourceAssetId);
                if (asset) handleSelectMediaForCanvas(asset);
              }
              if (scriptParam) setScript(scriptParam);
              if (languageParam) setLanguage(languageParam);
              if (glossary && projectRef.current) {
                const next = { ...projectRef.current, glossary, isolateVocals: !!isolateVocals };
                markEdit(next, false);
                projectRef.current = next;
              }
              await retryTranscription();
            }}
            onStartTranscription={async (sourceAssetId, scriptParam, languageParam, opts) => {
              if (sourceAssetId && sourceAssetId !== activeMediaAsset?.id) {
                const asset = projectAssets.find(a => a.id === sourceAssetId);
                if (asset) handleSelectMediaForCanvas(asset);
              }
              setScript(scriptParam);
              setLanguage(languageParam);
              if (opts.wordsPerLine !== settings.wordsPerLine) {
                updateSettings({ wordsPerLine: opts.wordsPerLine });
              }
              // Brand words are stored on the project so a re-run reuses them.
              if (opts.glossary && projectRef.current) {
                const next = { ...projectRef.current, glossary: opts.glossary, isolateVocals: !!opts.isolateVocals };
                markEdit(next, false);
                projectRef.current = next;
              }
              // Passed rather than read back off the project: the choices were
              // made in the panel and have not been saved yet.
              await startTranscription({
                script: scriptParam, language: languageParam,
                emoji: !!opts.emoji, translate: !!opts.translate,
              });
            }}
            onCancelTranscription={async () => {
              const p = projectRef.current;
              if (p) {
                markEdit({ ...p, status: 'ready', progress: 0, message: 'Transcription cancelled.' });
                notify('Transcription cancelled');
                try {
                  const updated = await request<Project>(`/projects/${p.id}/cancel`, { method: 'POST' });
                  if (projectRef.current?.id === p.id) {
                    setProject(updated);
                    projectRef.current = updated;
                  }
                } catch {
                  // Keep optimistic local state
                }
              }
            }}
            onGoToMedia={() => setActiveNavPanel('media')}
            onBrowseTemplates={() => setActiveNavPanel('style')}
            notify={notify}
            downloadTranscript={downloadTranscript}
          />
        ) : activeNavPanel === 'media' ? (
          <MediaPanel
            project={project}
            onSelectMediaForCanvas={handleSelectMediaForCanvas}
            onAddImageToCanvas={handleAddMediaToCanvas}
            onAddMediaToCanvas={handleAddMediaToCanvas}
            onRemoveMediaAsset={(assetId) => {
              const current = projectRef.current;
              if (current && !busy) markEdit({ ...current, canvasElements: (current.canvasElements ?? []).filter(el => el.assetId !== assetId) });
            }}
            onUpdateProjectAssets={handleUpdateProjectAssets}
            notify={notify}
            onStartProjectFromUpload={importFile}
          />
        ) : activeNavPanel === 'text' ? (
          <TextPanel
            settings={settings}
            updateSettings={updateSettings}
            busy={busy}
            notify={notify}
            isStackedTemplate={isStackedTemplate}
            safeArea={safeArea}
            safeAreaClash={safeAreaClash}
          />
        ) : activeNavPanel === 'style' ? (
          <StylePanel
            settings={settings}
            updateSettings={updateSettings}
            busy={busy}
            onOpenTextPanel={() => setActiveNavPanel('text')}
          />
        ) : activeNavPanel === 'settings' ? (
          <SettingsPanel
            project={project}
            settings={settings}
            updateSettings={updateSettings}
            busy={busy}
            limits={limits}
            health={health}
            onRefreshLimits={refreshLimits}
            accountEmail={accountEmail}
            accountName={accountName}
            authEnabled={AUTH_ENABLED}
            onSignOut={() => void signOut()}
            onDeleteProject={handleDeleteProject}
            onOpenExports={() => setModal('export')}
            notify={notify}
          />
      ) : (
        <section className="style-panel panel placeholder-panel">
          <div className="panel-tabs">
            <button className="active">
              {NAV_PANELS.find(p => p.id === activeNavPanel)?.label}
            </button>
          </div>
          <div className="panel-placeholder-content">
            <div className="placeholder-icon-wrap">
              {NAV_PANELS.find(p => p.id === activeNavPanel)?.icon}
            </div>
            <h3 className="placeholder-title">{NAV_PANELS.find(p => p.id === activeNavPanel)?.label} Panel</h3>
            <p className="placeholder-subtitle">
              This panel is ready for customization.
            </p>
            <button
              type="button"
              className="placeholder-back-btn"
              onClick={() => setActiveNavPanel('caption')}
            >
              Back to Caption
            </button>
          </div>
        </section>
      )}

        <section className="preview-panel">
          <div className="preview-toolbar"><div><span className="section-label">PREVIEW</span></div>{project&&<div className="preview-tools">{hasVideoLayer&&!busy&&<button className={`media-toggle ${videoEnabled?'':'removed'}`} aria-pressed={videoEnabled} aria-label={videoEnabled?'Remove video layer':'Restore video layer'} onClick={()=>setVideoEnabled(!videoEnabled)}>{videoEnabled?<Trash2 size={13}/>:<RotateCcw size={13}/>}<span>{videoEnabled?'Remove video':'Restore video'}</span></button>}<select aria-label="Video aspect ratio" value={settings.aspect} onChange={e=>updateSettings({aspect:e.target.value as Settings['aspect']})} disabled={busy}><option value="original">Original</option><option value="9:16">9:16 · Reel</option><option value="1:1">1:1 · Square</option><option value="16:9">16:9 · Landscape</option></select><button className="icon-button tiny" aria-label="Fullscreen preview" onClick={()=>void preview.current?.requestFullscreen().catch(()=>notify('Fullscreen is unavailable in this browser.'))}><Maximize2 size={15}/></button></div>}</div>
          <div
            className={`preview-stage ${isDraggingOver ? 'stage-dragging-over' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!project ? (
              <div
                className={`media-upload-dropzone ${isDraggingOver ? 'is-dragging' : ''}`}
                onClick={() => input.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    input.current?.click();
                  }
                }}
                aria-label="Drag your media or click to upload"
              >
                <div className="upload-dropzone-inner">
                  <div className="upload-icon-circle">
                    {uploadProgress !== null ? (
                      <LoaderCircle size={30} className="spin text-accent" />
                    ) : (
                      <UploadCloud size={28} color="#09090b" />
                    )}
                  </div>
                  <div className="upload-dropzone-text">
                    <h3 className="upload-dropzone-title">
                      {uploadProgress !== null
                        ? `Uploading media… ${uploadProgress}%`
                        : 'Drag your media or click to upload'}
                    </h3>
                    <p className="upload-dropzone-desc">
                      {uploadProgress !== null
                        ? 'Syncing audio waveform and transcribing speech…'
                        : 'Supports MP4, MOV, WebM, MP3, WAV, M4A up to 1 GB. Temporary session — export before closing or refreshing.'}
                    </p>
                  </div>
                  {uploadProgress !== null ? (
                    <div className="upload-progress-container">
                      <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="upload-main-btn"
                        onClick={e => {
                          e.stopPropagation();
                          input.current?.click();
                        }}
                      >
                        <Upload size={16} />
                        <span>Upload media</span>
                        <ChevronDown size={15} />
                      </button>


                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                ref={preview}
                className={`video-frame ${hasVideoLayer && !videoEnabled ? 'video-removed' : ''}`}
                style={{ aspectRatio: `${size.width}/${size.height}`, cursor: 'pointer' }}
                onClick={e => {
                  if (e.target === preview.current || e.target === media.current) {
                    togglePlay();
                  }
                }}
                onMouseEnter={() => setPreviewHover(true)}
                onMouseLeave={() => { if (!draggingCaption) setPreviewHover(false); }}
              >
                <video
                  ref={media}
                  className={`${project.mediaType === 'audio' || (hasVideoLayer && !videoEnabled) ? 'audio-media' : ''} ${(activeMediaAsset ? activeMediaAsset.greenScreen : project.greenScreen)?.enabled ? 'video-keyed' : ''}`}
                  key={`${project.id}-${busy ? 'processing' : 'ready'}-${videoEnabled ? 'video' : 'audio'}-${activeMediaAsset?.id || 'primary'}`}
                  src={busy ? undefined : (mediaUrl(assetMediaPath(project.id, activeMediaAsset?.id ?? 'primary')) || undefined)}
                  playsInline
                  preload="metadata"
                  muted={muted}
                  onLoadedMetadata={() => {
                    const resume = mediaResumeRef.current, element = media.current;
                    if (!resume || !element) return;
                    mediaResumeRef.current = null;
                    if (resume.projectId !== project.id || resume.assetId !== (project.activeMediaAssetId ?? 'primary')) return;
                    element.currentTime = Math.min(resume.time, element.duration || resume.time);
                    element.playbackRate = playbackRate;
                    if (resume.playing) void element.play().catch(() => notify('Media access refreshed. Press play to continue.'));
                  }}
                  onPlay={() => {
                    if (media.current) media.current.playbackRate = playbackRate;
                    setPlaying(true);
                  }}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                  onSeeked={() => setTime(media.current?.currentTime ?? 0)}
                  onError={() => notify('The preview could not load. The file may still be processing.')}
                />
                {project.mediaType === 'audio' && (
                  <div className="audio-backdrop">
                    <AudioLines size={48} />
                    <span>AUDIO PROJECT</span>
                  </div>
                )}
                <Player
                  ref={captionPlayer}
                  component={CaptionTrack}
                  inputProps={{ words, settings, background: 'transparent' }}
                  durationInFrames={Math.max(1, Math.round((duration || 1) * CAPTION_FPS))}
                  fps={CAPTION_FPS}
                  compositionWidth={size.width}
                  compositionHeight={size.height}
                  controls={false}
                  clickToPlay={false}
                  doubleClickToFullscreen={false}
                  spaceKeyToPlayOrPause={false}
                  acknowledgeRemotionLicense
                  className="caption-player"
                  // Remotion sets `position: relative` as an inline style on the
                  // player container, which beats any stylesheet rule — the layer
                  // ended up in normal flow below the video and was clipped away
                  // by the frame's overflow. Positioning has to be inline too.
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                />
                {/* Nothing until the pointer is here: the preview is for judging
                    the result, and controls parked over it permanently become
                    part of what you are judging. */}
                {previewHover && !busy && project.words.length > 0 && (
                  <div className="caption-move-overlay">
                    <div
                      className={`caption-move-grab ${draggingCaption ? 'is-dragging' : ''}`}
                      style={{
                        left: `${activePage?.words[0]?.posX ?? settings.positionX ?? 50}%`,
                        top: `${activePage?.words[0]?.posY ?? settings.position ?? 70}%`,
                      }}
                      title="Drag to move the captions"
                      onMouseDown={e => {
                        e.preventDefault();
                        const frame = preview.current;
                        if (!frame) return;
                        const rect = frame.getBoundingClientRect();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        // Where inside the handle the pointer came down. Without
                        // this the caption jumped so its anchor sat exactly under
                        // the cursor, which moved it by up to half a handle the
                        // moment it was touched — the caption appeared to reposition
                        // itself on what felt like a hover.
                        const grabX = ((e.clientX - rect.left) / rect.width) * 100
                          - (activePage?.words[0]?.posX ?? settings.positionX ?? 50);
                        const grabY = ((e.clientY - rect.top) / rect.height) * 100
                          - (activePage?.words[0]?.posY ?? settings.position ?? 70);
                        // Nothing moves until the pointer has travelled far enough
                        // to mean it: a click on the handle is a click, not a drag.
                        let dragging = false;
                        // Magnetic snapping to the nine anchors: the caption
                        // tracks the mouse freely and is taken by an anchor only
                        // near one. Alt turns even that off.
                        const move = (ev: MouseEvent) => {
                          if (!dragging) {
                            if (Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
                            dragging = true;
                            setDraggingCaption(true);
                          }
                          const clamp = (v: number) => Math.max(0, Math.min(100, v));
                          const rawX = clamp(((ev.clientX - rect.left) / rect.width) * 100 - grabX);
                          const rawY = clamp(((ev.clientY - rect.top) / rect.height) * 100 - grabY);
                          if (ev.altKey) {
                            setCaptionSnap({ x: null, y: null });
                            setCaptionPosition(rawX, rawY);
                            return;
                          }
                          const x = snapToAnchor(rawX, CAPTION_ANCHORS_X);
                          const y = snapToAnchor(rawY, CAPTION_ANCHORS_Y);
                          setCaptionSnap({ x: x.anchor, y: y.anchor });
                          setCaptionPosition(x.value, y.value);
                        };
                        const up = () => {
                          setDraggingCaption(false);
                          setCaptionSnap({ x: null, y: null });
                          window.removeEventListener('mousemove', move);
                          window.removeEventListener('mouseup', up);
                        };
                        window.addEventListener('mousemove', move);
                        window.addEventListener('mouseup', up);
                      }}
                    >
                      <Move size={14}/>
                    </div>

                    {/* Why the caption stopped where it did. Only while dragging,
                        and only on the axis an anchor actually has it. */}
                    {draggingCaption && captionSnap.x !== null && (
                      <div className="caption-snap-guide vertical" style={{ left: `${captionSnap.x}%` }} />
                    )}
                    {draggingCaption && captionSnap.y !== null && (
                      <div className="caption-snap-guide horizontal" style={{ top: `${captionSnap.y}%` }} />
                    )}

                    <div className="caption-move-bar" onMouseDown={e => e.stopPropagation()}>
                      <div className="caption-move-row">
                        {/* Text alignment, which is how the lines sit against each
                            other — not where the block sits in the frame. These
                            used to set the horizontal position instead, so the
                            align icons did something the align icons do not mean.
                            Position is the arrows, and the drag. */}
                        {([
                          { align: 'left', icon: <AlignLeft size={14}/>, label: 'Align left' },
                          { align: 'center', icon: <AlignCenter size={14}/>, label: 'Align centre' },
                          { align: 'right', icon: <AlignRight size={14}/>, label: 'Align right' },
                        ] as const).map(option => (
                          <button
                            key={option.label}
                            type="button"
                            title={option.label}
                            aria-label={option.label}
                            aria-pressed={(settings.align ?? 'center') === option.align}
                            className={(settings.align ?? 'center') === option.align ? 'is-active' : ''}
                            onClick={() => updateSettings({ align: option.align })}
                          >
                            {option.icon}
                          </button>
                        ))}
                        <span className="caption-move-divider" />
                        {([
                          { y: CAPTION_ANCHORS_Y[0], icon: <ArrowUp size={14}/>, label: 'Top' },
                          { y: CAPTION_ANCHORS_Y[1], icon: <Minus size={14}/>, label: 'Middle' },
                          { y: CAPTION_ANCHORS_Y[2], icon: <ArrowDown size={14}/>, label: 'Bottom' },
                        ] as const).map(option => (
                          <button
                            key={option.label}
                            type="button"
                            title={option.label}
                            aria-label={`Move to ${option.label.toLowerCase()}`}
                            onClick={() => setCaptionPosition(activePage?.words[0]?.posX ?? settings.positionX ?? 50, option.y)}
                          >
                            {option.icon}
                          </button>
                        ))}
                      </div>

                      <label className="caption-move-scope">
                        <input
                          type="checkbox"
                          checked={thisLineOnly}
                          onChange={e => setThisLineOnly(e.target.checked)}
                        />
                        <span>This line only</span>
                      </label>

                      {project.words.some(w => w.posX !== undefined || w.posY !== undefined) && (
                        <button
                          type="button"
                          className="caption-move-reset"
                          onClick={() => {
                            const p = projectRef.current;
                            if (!p) return;
                            markEdit({ ...p, words: p.words.map(w => ({ ...w, posX: undefined, posY: undefined })) });
                            notify('Every line is back to the project position.');
                          }}
                        >
                          <X size={12}/> Clear line positions
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <canvas
                  ref={canvas}
                  width={size.width}
                  height={size.height}
                  aria-label="Animated caption preview"
                  tabIndex={0}
                  role="button"
                  style={{ cursor: 'pointer' }}
                  onClick={togglePlay}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      togglePlay();
                    }
                  }}
                />
                {/* The app's own interface, drawn over the preview so a caption
                    cannot quietly end up behind it. Shaded strips, not one
                    dashed box: the covered regions are different sizes and the
                    bottom one is what actually catches people out. */}
                {safeArea && (
                  <div className="safe-area-overlay" aria-hidden="true">
                    {safeArea.zones.map(zone => (
                      <div
                        key={`${zone.edge}-${zone.label}`}
                        className={`safe-area-zone edge-${zone.edge}`}
                        style={zone.edge === 'right'
                          ? { width: `${zone.size * 100}%` }
                          : { height: `${zone.size * 100}%` }}
                      >
                        <span className="safe-area-zone-label">{zone.label}</span>
                      </div>
                    ))}
                    <div className="safe-area-name">{safeArea.name}</div>
                  </div>
                )}
                {selectedCanvasElementId && (
                  <div className="canvas-element-action-overlay">
                    <button
                      type="button"
                      className="canvas-delete-element-btn"
                      onClick={() => {
                        handleDeleteCanvasElement(selectedCanvasElementId);
                        setSelectedCanvasElementId(null);
                        notify('Removed visual element from canvas');
                      }}
                      title="Remove visual element from canvas"
                      aria-label="Remove visual element from canvas"
                    >
                      <Trash2 size={13} />
                      <span>Remove element</span>
                    </button>
                  </div>
                )}

                {/* Snapping alignment guide lines */}
                {snapGuideX && <div className="canvas-snap-guide vertical" />}
                {snapGuideY && <div className="canvas-snap-guide horizontal" />}


                {/* Interactive Canvas Media Overlays */}
                {canvasElements.map(el => {
                  const isVisible = el.visible !== false && ((el.start === undefined || time >= el.start) && (el.end === undefined || time <= el.end) || selectedCanvasElementId === el.id);
                  if (!isVisible) return null;
                  const isSelected = selectedCanvasElementId === el.id;

                  return (
                    <div
                      key={el.id}
                      className={`canvas-media-box-wrapper ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
                      role="group"
                      tabIndex={0}
                      aria-label={`${el.name} canvas layer${el.locked ? ', locked' : '. Arrow keys move, plus or minus resizes, brackets rotate.'}`}
                      onFocus={e => { if (e.target === e.currentTarget) setSelectedCanvasElementId(el.id); }}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget || isBrowserZoomKey(e) || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
                        const changes = canvasKeyboardChange(el, e.key, e.shiftKey);
                        if (changes) { e.preventDefault(); e.stopPropagation(); handleUpdateCanvasElement(el.id, changes); }
                        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelectedCanvasElementId(el.id); }
                      }}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg)`,
                        width: `${32 * (el.scale || 1.0)}%`,
                        aspectRatio: '16 / 9',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCanvasElementId(el.id);
                      }}
                      onMouseDown={(e) => {
                        if (el.locked) return;
                        handleStartDragCanvasElement(e, el.id);
                      }}
                    >
                      <div className="canvas-media-hit-target" />

                      {isSelected && (
                        <>
                          <div className="canvas-selection-box media-selection-box" />
                          {!el.locked && (
                            <>
                              <div className="resize-handle handle-nw" onMouseDown={(e) => handleStartResizeCanvasElement(e, el.id, 'nw')} />
                              <div className="resize-handle handle-ne" onMouseDown={(e) => handleStartResizeCanvasElement(e, el.id, 'ne')} />
                              <div className="resize-handle handle-se" onMouseDown={(e) => handleStartResizeCanvasElement(e, el.id, 'se')} />
                              <div className="resize-handle handle-sw" onMouseDown={(e) => handleStartResizeCanvasElement(e, el.id, 'sw')} />
                              <div className="resize-handle handle-n" onMouseDown={(e) => handleStartResizeCanvasElement(e, el.id, 'n')} />
                              <div className="resize-handle handle-e" onMouseDown={(e) => handleStartResizeCanvasElement(e, el.id, 'e')} />
                              <div className="resize-handle handle-s" onMouseDown={(e) => handleStartResizeCanvasElement(e, el.id, 's')} />
                              <div className="resize-handle handle-w" onMouseDown={(e) => handleStartResizeCanvasElement(e, el.id, 'w')} />
                            </>
                          )}

                          {/* Floating Action Toolbar */}
                          <div className="canvas-floating-toolbar media-floating-toolbar" onMouseDown={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="floating-tool-btn with-text"
                              onClick={() => setGreenScreenTargetEl(el)}
                              title="Green Screen / Chroma Key"
                            >
                              <Wand2 size={13} />
                              <span>Green Screen</span>
                            </button>
                            <div className="floating-tool-divider" />
                            <button
                              type="button"
                              className="floating-tool-btn"
                              onClick={() => handleUpdateCanvasElement(el.id, { scale: 1.0 })}
                              title="Reset Size"
                              aria-label="Reset layer size"
                              disabled={el.locked}
                            >
                              <RotateCcw size={13} />
                            </button>
                            <div className="floating-tool-divider" />
                            <button
                              type="button"
                              className="floating-tool-btn danger"
                              onClick={() => handleDeleteCanvasElement(el.id)}
                              title="Remove from Canvas"
                              aria-label="Remove layer from canvas"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {busy && (
                  <div className="preview-processing">
                    <LoaderCircle size={18} className="spin" />
                    Captions are on their way
                  </div>
                )}
                {isDraggingOver && (
                  <div className="stage-drag-overlay stage-drop-target-active">
                    <UploadCloud size={36} color="#2EE368" />
                    <span>Drop media onto canvas</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clean White Timeline matching Image 2 */}
          <div ref={timelineContainerRef} className="timeline-container clean-white">
            {/* Top Control Bar */}
            <div className="timeline-top-bar">
              {/* Left: Timecode Display */}
              <div className="timeline-time-display">
                <span className="time-current">{timecode(time)}</span>
                <span className="time-sep">/</span>
                <span className="time-total">{timecode(duration)}</span>
              </div>

              {/* Center: Transport Controls (< ▶ >) */}
              <div className="timeline-transport">
                <button
                  type="button"
                  className="icon-button tiny transport-nav"
                  aria-label="Back three seconds"
                  onClick={() => seek(time - 3)}
                  disabled={!project}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="timeline-play-btn"
                  aria-label={playing ? 'Pause' : 'Play'}
                  onClick={togglePlay}
                  disabled={!project}
                >
                  {playing ? (
                    <Pause size={17} fill="#ffffff" color="#ffffff" />
                  ) : (
                    <Play size={17} fill="#ffffff" color="#ffffff" style={{ marginLeft: 2 }} />
                  )}
                </button>
                <button
                  type="button"
                  className="icon-button tiny transport-nav"
                  aria-label="Forward three seconds"
                  onClick={() => seek(time + 3)}
                  disabled={!project}
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  className="timeline-speed-pill"
                  aria-label={`Playback speed ${playbackRate}x`}
                  title="Playback speed (click to cycle, or Shift + < / >)"
                  onClick={() => {
                    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
                    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
                    setPlaybackRate(next);
                  }}
                  disabled={!project}
                >
                  {playbackRate}x
                </button>
              </div>

              {/* Right: Tools (Split, Zoom Slider, Search, Fullscreen) */}
              <div className="timeline-actions">
                <button
                  type="button"
                  className="timeline-action-btn"
                  aria-label="Split caption line"
                  title="Split caption line (Cmd+B)"
                  onClick={handleSplitAtCurrent}
                  disabled={!project}
                >
                  <Scissors size={14} />
                  <span>Split</span>
                </button>

                <div className="timeline-zoom-slider-wrap">
                  <button
                    type="button"
                    className="icon-button tiny"
                    aria-label="Zoom out"
                    disabled={!project || timelineZoom <= 1}
                    onClick={() => setTimelineZoom(z => Math.max(1, Number((z / 1.35).toFixed(2))))}
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={32}
                    step={0.5}
                    aria-label="Timeline zoom"
                    value={timelineZoom}
                    disabled={!project}
                    onChange={e => setTimelineZoom(Number(e.target.value))}
                    className="timeline-zoom-slider"
                  />
                  <button
                    type="button"
                    className="icon-button tiny"
                    aria-label="Zoom in"
                    disabled={!project || timelineZoom >= 32}
                    onClick={() => setTimelineZoom(z => Math.min(32, Number((z * 1.35).toFixed(2))))}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <button
                  type="button"
                  className={`icon-button tiny ${modal === 'search-replace' ? 'active' : ''}`}
                  aria-label="Search and replace"
                  title="Find & Replace"
                  onClick={() => setModal('search-replace')}
                  disabled={!project}
                >
                  <Search size={15} />
                </button>

                <button
                  type="button"
                  className="icon-button tiny"
                  aria-label="Fullscreen preview"
                  title="Fullscreen preview"
                  onClick={() => void preview.current?.requestFullscreen().catch(() => notify('Fullscreen is unavailable.'))}
                  disabled={!project}
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>

            {/* Viewport with Waveform & Clean White Caption Cards */}
            <div ref={timelineViewportRef} className="timeline-viewport" onScroll={readTimelineWindow}>
              <div
                ref={timelineTrackRef}
                className="timeline-track-content"
                style={{
                  width: `${timelineZoom * 100}%`,
                  minWidth: '100%',
                }}
                onMouseDown={(e) => {
                  setIsScrubbing(true);
                  handleTimelineTrackClick(e);
                }}
                onMouseMove={(e) => {
                  if (!timelineTrackRef.current || !duration) return;
                  const rect = timelineTrackRef.current.getBoundingClientRect();
                  const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                  const xPct = (relX / rect.width) * 100;
                  const t = (relX / rect.width) * duration;
                  setTimelineHover({ xPct, time: t });
                }}
                onMouseLeave={() => setTimelineHover(null)}
              >
                {/* 1. Light Dynamic Ruler */}
                <TimelineRuler ticks={rulerTicks} duration={duration} />

                {/* Timeline Hover Scrub Guide */}
                {timelineHover && !isScrubbing && (
                  <div
                    className="timeline-hover-indicator"
                    style={{ left: `${timelineHover.xPct}%` }}
                    aria-hidden="true"
                  >
                    <div className="timeline-hover-tooltip">{timecode(timelineHover.time)}</div>
                  </div>
                )}

                {/* 2. Waveform track with green progress bars & dynamic normalization */}
                {project?.waveform?.length ? (() => {
                  const wf = project.waveform;
                  const maxAmp = Math.max(0.08, ...wf);
                  return (
                    <div className="timeline-waveform" aria-hidden="true">
                      {wf.map((v, i) => {
                        const isPlayed = i / wf.length <= (duration ? time / duration : 0);
                        const normalized = Math.min(1, Math.max(0.12, v / maxAmp));
                        const heightPct = Math.pow(normalized, 0.72) * 100;
                        return (
                          <i
                            key={i}
                            className={isPlayed ? 'is-played' : ''}
                            style={{
                              height: `${Math.max(14, heightPct)}%`,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })() : null}

                {/* 2.5. Text Elements Lane */}

                {/* 2.6. Media Elements Lane */}
                {project && duration > 0 && canvasElements.length > 0 && (
                  <div className="timeline-media-lane">
                    {canvasElements.map(el => {
                      const isSelected = selectedCanvasElementId === el.id;
                      const elStart = el.start ?? 0;
                      const elEnd = el.end ?? duration;
                      const leftPct = Math.max(0, Math.min(100, (elStart / duration) * 100));
                      const widthPct = Math.max(1.5, Math.min(100 - leftPct, ((elEnd - elStart) / duration) * 100));

                      return (
                        <div
                          key={el.id}
                          className={`timeline-media-block ${isSelected ? 'selected' : ''} ${el.visible === false ? 'hidden' : ''}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCanvasElementId(el.id);
                            seek(elStart);
                          }}
                          onMouseDown={(e) => handleStartDragTimelineMedia(e, el.id, 'move')}
                          title={`Media: "${el.name}" (${elStart.toFixed(1)}s - ${elEnd.toFixed(1)}s)`}
                        >
                          <div
                            className="timeline-block-handle left"
                            title="Drag to trim start"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleStartDragTimelineMedia(e, el.id, 'start');
                            }}
                          />
                          <div className="timeline-media-block-content">
                            <ImageIcon size={12} className="timeline-media-icon" />
                            <span className="timeline-media-title">{el.name || 'Media'}</span>
                            <span className="timeline-media-dur">{(elEnd - elStart).toFixed(1)}s</span>
                          </div>
                          <div
                            className="timeline-block-handle right"
                            title="Drag to trim end"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleStartDragTimelineMedia(e, el.id, 'end');
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Clean White Caption Cards Lane */}
                <div className="timeline-groups-lane">
                  {project && duration > 0 && visibleTimelineIndices.map(gIdx => {
                    const g = groups[gIdx];
                    const gStart = g[0].start;
                    const gEnd = g.at(-1)!.end;
                    const isCurrentGroup = time >= gStart && time <= gEnd;
                    const gDur = Math.max(0.04, gEnd - gStart);
                    const leftPct = (gStart / duration) * 100;
                    const widthPct = (gDur / duration) * 100;

                    return (
                      <div
                        key={g[0].id || gIdx}
                        className={`timeline-group-container white-card ${isCurrentGroup ? 'is-active' : ''}`}
                        style={{
                          left: `${leftPct}%`,
                          width: `calc(${widthPct}% - 2px)`,
                        }}
                        title={`Caption line: "${g.map(w => w.text).join(' ')}"`}
                        onClick={() => seek(gStart)}
                      >
                        {/* Group Left Trim Bracket */}
                        <div
                          className="timeline-group-bracket left"
                          title="Drag to adjust sentence start"
                          onMouseDown={(e) => startGroupTrim(e, g, 'left')}
                        />

                        {/* Words inside this sentence card */}
                        <div className="timeline-group-words">
                          {(widthPct * (timelineViewportRef.current?.scrollWidth ?? 1000) / 100 >= 24 ? g : []).map((w, wIdx) => {
                            const isCurrentWord = time >= w.start && time < w.end;
                            const wDur = Math.max(0.01, w.end - w.start);
                            const wLeftPct = ((w.start - gStart) / gDur) * 100;
                            const wWidthPct = (wDur / gDur) * 100;
                            const isWordSelected = selectedWordIds.has(w.id);

                            return (
                              <React.Fragment key={w.id}>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className={`timeline-word-cell white-cell ${isWordSelected ? 'is-selected' : ''} ${isCurrentWord ? 'is-active' : ''} ${w.spotlight ? 'is-spotlight' : (heroWordIds.has(w.id) ? 'is-emphasized' : '')}`}
                                  style={{
                                    left: `${wLeftPct}%`,
                                    width: `calc(${wWidthPct}% - 1px)`,
                                  }}
                                  title={`${w.text} (${timecode(w.start)} - ${timecode(w.end)})`}
                                  onMouseDown={(e) => startWordDrag(e, w)}
                                  onContextMenu={(e) => handleWordContextMenu(e, w)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedWord(w.id);
                                      seek(w.start);
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTimelinePopover({
                                        word: w,
                                        rect,
                                        draftText: w.text,
                                        emphasis: !!w.emphasis,
                                        spotlight: !!w.spotlight,
                                        behind: !!w.behind,
                                      });
                                    }
                                  }}
                                >
                                  {/* Left trim handle */}
                                  <div
                                    className="timeline-word-edge-handle left"
                                    title="Trim word start"
                                    onMouseDown={(e) => startWordHandleDrag(e, w, 'left')}
                                  />

                                  <span className="timeline-word-cell-text">{w.text}</span>
                                  {w.spotlight ? (
                                    <span className="timeline-word-spotlight-badge" title="Highlighted — you chose this word">⚡</span>
                                  ) : heroWordIds.has(w.id) ? (
                                    <span className="timeline-word-star" title="Picked automatically for this line. Click any word to choose a different one.">⚡</span>
                                  ) : null}

                                  {/* Right trim handle */}
                                  <div
                                    className="timeline-word-edge-handle right"
                                    title="Trim word end"
                                    onMouseDown={(e) => startWordHandleDrag(e, w, 'right')}
                                  />
                                </div>

                                {/* Divider handle */}
                                {wIdx < g.length - 1 && (
                                  <div
                                    className="timeline-word-divider"
                                    style={{
                                      left: `${((g[wIdx].end - gStart) / gDur) * 100}%`,
                                    }}
                                    title={`Drag boundary`}
                                    onMouseDown={(e) => startWordDividerDrag(e, w, g[wIdx + 1])}
                                  >
                                    <span className="divider-line" />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {/* Dedicated Group Bar beneath words */}
                        <div
                          className="timeline-group-bar"
                          title="Drag caption group to shift timing"
                          onMouseDown={(e) => startGroupDrag(e, g)}
                        >
                          <div className="group-bar-track">
                            <span className="group-bar-grip" />
                          </div>
                        </div>

                        {/* Group Right Trim Bracket */}
                        <div
                          className="timeline-group-bracket right"
                          title="Drag to adjust sentence end"
                          onMouseDown={(e) => startGroupTrim(e, g, 'right')}
                        />
                      </div>
                    );
                  })}

                  {/* "+ Add" button at end of line track */}
                  {project && duration > 0 && (() => {
                    const lastW = project.words.length > 0 ? project.words[project.words.length - 1] : null;
                    const addLeftPct = lastW ? (lastW.end / duration) * 100 : 0;
                    return (
                      <button
                        type="button"
                        className="timeline-add-line-btn"
                        style={{ left: `calc(${addLeftPct}% + 10px)` }}
                        title="Add caption"
                        onClick={handleAddWord}
                      >
                        <Plus size={14} />
                        <span>Add</span>
                      </button>
                    );
                  })()}
                </div>

                {/* 4. Playhead with Green Line & Triangle Marker */}
                {project && duration > 0 ? (
                  <div
                    className="timeline-playhead green-playhead"
                    style={{ left: `${(time / duration) * 100}%` }}
                  >
                    <div className="playhead-marker" />
                    <div className="playhead-line" />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Bottom Shortcut Footer */}
            <div className="timeline-footer-strip">
              <div className="timeline-shortcut-item">
                <kbd>space</kbd>
                <span>play / pause</span>
              </div>
              <div className="timeline-shortcut-right">
                <div className="timeline-shortcut-item">
                  <kbd>↑ ↓</kbd>
                  <span>Zoom timeline</span>
                </div>
                <div className="timeline-shortcut-item">
                  <kbd>cmd + B</kbd>
                  <span>Split</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        {timelineLiveTooltip && (
          <div
            className="timeline-live-tooltip"
            style={{
              position: 'fixed',
              left: `${timelineLiveTooltip.x}px`,
              top: `${timelineLiveTooltip.y}px`,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 99999,
            }}
          >
            {timelineLiveTooltip.lines.map((line, i) => (
              <div key={i} className="tooltip-line">{line}</div>
            ))}
          </div>
        )}
      </main>
    </div>

    {saveConflict && project?.id === saveConflict.id && <Modal title="This project changed elsewhere" onClose={() => setSaveConflict(null)}>
      <p>Your edits are still in this tab. Download a copy before loading the latest session version.</p>
      <button className="secondary-button" onClick={() => {
        const local = projectRef.current; if (!local) return;
        const url = URL.createObjectURL(new Blob([JSON.stringify(local, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `${local.name}-unsaved.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Download my edits</button>
      <button className="secondary-button" onClick={async () => {
        const id = saveConflict.id;
        try {
          const latest = await request<Project>(`/projects/${id}`);
          if (projectRef.current?.id !== id) return;
          projectRef.current = latest; savedProjectRef.current = latest; setProject(latest); setSettings(latest.settings); setCanvasElements(latest.canvasElements ?? []);
          setHistory([]); setFuture([]); savedDirty.current = dirtyRef.current;
          conflictRef.current = null; setSaveConflict(null);
          setSaveStatus('Temporary session');
        } catch (e) { notify((e as Error).message); }
      }}>Discard my edits and load latest</button>
    </Modal>}
    <LiveAnnouncer notice={notice} saveStatus={saveStatus} uploadProgress={uploadProgress} busy={busy} />
    {notice&&<div className="toast" role="status"><CircleHelp size={18}/><span>{notice}</span><button className="icon-button tiny" aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {uploadProgress!==null&&<div className="upload-toast" role="status"><LoaderCircle className="spin" size={18}/>Uploading file… {uploadProgress}%</div>}
    {modal === 'export' && (
      <Modal title="Export Video" onClose={() => setModal(null)} wide>
        <p className="modal-description">
          Choose your format, resolution, and frame rate. Your video exports and downloads automatically in one step.
        </p>

        {/* Step 1: Two Main Sections (Captioned Video vs Green Screen) */}
        <div className="export-section-group">
          <label className="export-section-title">
            <span className="export-step-num">1</span>
            <span>Choose Export Type</span>
          </label>
          <div className="export-type-grid">
            <button
              type="button"
              className={`export-type-card ${exportMode === 'burned' ? 'selected' : ''}`}
              onClick={() => setExportMode('burned')}
            >
              <div className="export-type-icon-box burned">
                <MonitorPlay size={24} />
              </div>
              <div className="export-type-details">
                <div className="export-type-heading">
                  <strong>{project?.mediaType === 'audio' ? 'Caption Video' : 'Captioned Video'}</strong>
                  {exportMode === 'burned' && (
                    <span className="export-badge-active">
                      <Check size={13} /> Selected
                    </span>
                  )}
                </div>
                <span className="export-type-desc">
                  Complete MP4 with original audio, visuals, and burned-in animated captions.
                </span>
              </div>
            </button>

            <button
              type="button"
              className={`export-type-card ${exportMode === 'green' ? 'selected' : ''}`}
              onClick={() => setExportMode('green')}
            >
              <div className="export-type-icon-box green">
                <Layers size={24} />
              </div>
              <div className="export-type-details">
                <div className="export-type-heading">
                  <strong>Green Screen</strong>
                  {exportMode === 'green' && (
                    <span className="export-badge-active">
                      <Check size={13} /> Selected
                    </span>
                  )}
                </div>
                <span className="export-type-desc">
                  Chroma-key backdrop (#00FF00) for Premiere, Final Cut Pro, DaVinci & CapCut.
                </span>
              </div>
            </button>
          </div>
        </div>

        {exportMode === 'green' && (
          <p className="export-note">
            💡 <strong>Pro-Tip:</strong> Key out pure green (#00FF00) in your video editor. Pick an accent color other than green in Settings for clean chroma keying.
          </p>
        )}

        {/* Step 2: Resolution Selection */}
        <div className="export-section-group">
          <div className="export-section-header-row">
            <label className="export-section-title">
              <span className="export-step-num">2</span>
              <span>Resolution</span>
            </label>
            <span className="export-detail-pill">
              {project ? `${dimensions(settings, project.width, project.height, resolution).width} × ${dimensions(settings, project.width, project.height, resolution).height} px` : ''}
            </span>
          </div>
          <div className="export-option-pills">
            <button
              type="button"
              className={`export-option-pill ${resolution === 720 ? 'selected' : ''}`}
              onClick={() => setResolution(720)}
            >
              <strong>720p</strong>
              <span>Fast Export</span>
            </button>
            <button
              type="button"
              className={`export-option-pill ${resolution === 1080 ? 'selected' : ''}`}
              onClick={() => setResolution(1080)}
            >
              <strong>1080p</strong>
              <span>Full HD</span>
            </button>
            <button
              type="button"
              className={`export-option-pill ${resolution === 2160 ? 'selected' : ''}`}
              onClick={() => setResolution(2160)}
            >
              <strong>4K</strong>
              <span>Ultra HD (2160p)</span>
            </button>
          </div>
        </div>

        {/* Step 3: Frame Rate Selection */}
        <div className="export-section-group">
          <div className="export-section-header-row">
            <label className="export-section-title">
              <span className="export-step-num">3</span>
              <span>Frame Rate</span>
            </label>
            <span className="export-detail-pill">
              {exportFps === 24 ? '24 fps · Cinematic' : exportFps === 25 ? '25 fps · PAL / Film' : exportFps === 30 ? '30 fps · Standard' : exportFps === 50 ? '50 fps · PAL High' : '60 fps · Smooth'}
            </span>
          </div>
          <div className="export-fps-pills">
            {([24, 25, 30, 50, 60] as const).map(fpsOption => (
              <button
                key={fpsOption}
                type="button"
                className={`export-fps-pill ${exportFps === fpsOption ? 'selected' : ''}`}
                onClick={() => setExportFps(fpsOption)}
              >
                <strong>{fpsOption}</strong>
                <span>fps</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live details summary */}
        <div className="export-summary-bar">
          <span>H.264 MP4</span>
          <span>{resolution === 2160 ? '4K Ultra HD' : `${resolution}p`}</span>
          <span>{exportFps} FPS</span>
          <span>{project ? `${dimensions(settings, project.width, project.height, resolution).width}×${dimensions(settings, project.width, project.height, resolution).height}` : ''}</span>
          <span>No watermark</span>
        </div>

        {/* Step 4: Export & Auto-Download Execution */}
        {hasExportRunning ? (
          <div className="export-progress-card">
            <div className="export-progress-top">
              <div className="export-progress-status">
                <LoaderCircle size={18} className="spin" />
                <span>{latestExport?.message || 'Rendering video frames…'}</span>
              </div>
              <strong className="export-progress-percent">{latestExport?.progress ?? 0}%</strong>
            </div>
            <div className="export-progress-track">
              <div
                className="export-progress-fill"
                style={{ width: `${Math.max(4, latestExport?.progress ?? 0)}%` }}
              />
            </div>
            <p className="export-auto-download-hint">
              ⚡ <strong>Auto-download enabled:</strong> Your video will start downloading automatically the moment rendering completes.
            </p>
          </div>
        ) : (
          <div className="export-action-block">
            {overExportLimit && (
              <p className="export-limit-note">
                This clip is {Math.floor(duration / 60)}m {Math.round(duration % 60)}s, and rendering
                here is capped at {Math.round((maxExportSeconds ?? 0) / 60)} minutes so exports stay
                quick for everyone. Download the SRT and burn it in your editor, or run Bol locally
                for the full length.
              </p>
            )}
            <button
              className="button primary full export-submit-btn"
              onClick={() => void startExport()}
              disabled={exporting || !project?.words.length || overExportLimit}
            >
              {exporting ? (
                <>
                  <LoaderCircle size={18} className="spin" />
                  <span>Preparing render…</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Export & Download {exportMode === 'green' ? 'Green Screen' : 'Video'}</span>
                </>
              )}
            </button>

            {lastDownloadedExportId && (
              <div className="export-download-success">
                <Check size={16} />
                <span>Download started! Check your browser's download folder.</span>
              </div>
            )}
          </div>
        )}

        {latestExport?.status === 'error' && (
          <p className="error-message export-error-alert">{latestExport.message}</p>
        )}

        <div className="subtitle-downloads">
          <span>Need text subtitles or audio?</span>
          <div>
            <button type="button" onClick={() => downloadTranscript('srt')}>.SRT</button>
            <button type="button" onClick={() => downloadTranscript('vtt')}>.VTT</button>
            <button type="button" onClick={() => downloadTranscript('txt')}>.TXT</button>
            <button type="button" onClick={() => downloadTranscript('json')}>Timings .JSON</button>
            <button type="button" onClick={() => downloadTranscript('csv')}>Spreadsheet .CSV</button>
            <button type="button" onClick={downloadAudioTrack} title="Download dialogue audio (.m4a)">Audio .M4A</button>
            <button type="button" onClick={copyTranscript} title="Copy plain text to clipboard">Copy Text</button>
          </div>
        </div>
      </Modal>
    )}
    {/*
      One question, three answers, asked while the upload is still the thing on
      screen. The two axes underneath — what language is spoken, and which
      script to write it in — are not a choice anyone wants to make separately:
      "Hinglish" means Hindi and English mixed, written in Latin letters, and
      picking that from two dropdowns requires knowing that Roman and Devanagari
      are the options at all.

      Nothing else belongs here. Emoji and translation are real choices, but
      they are not this question, and putting them below the cards turned a
      three-second decision into a form. They live with the rest of the
      generation options in the Captions panel.
    */}
    {languagePrompt && project && <Modal title="Import Video & Caption Setup" onClose={()=>setLanguagePrompt(null)}>
      <p className="modal-lede">Set spoken language and choose whether to emphasize keywords in your captions.</p>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary, #09090b)', marginTop: 4, marginBottom: 8 }}>
        1. Spoken Language &amp; Script
      </div>
      <div className="language-choice-grid" role="radiogroup" aria-label="Spoken language">
        {([
          { id: 'hinglish', label: 'Hinglish', sample: 'aap kaise ho', note: 'Hindi and English mixed, in Latin letters', script: 'roman', language: 'auto' },
          { id: 'hindi', label: 'Hindi', sample: 'आप कैसे हो', note: 'Hindi only, in Devanagari', script: 'native', language: 'hi' },
          { id: 'english', label: 'English', sample: 'how are you', note: 'English only', script: 'native', language: 'en' },
        ] as const).map(choice => {
          const selected = script === choice.script && language === choice.language;
          return (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`language-choice ${selected ? 'selected' : ''}`}
              onClick={() => { setScript(choice.script); setLanguage(choice.language); }}
            >
              <span className="language-choice-top">
                <span className="language-choice-label">{choice.label}</span>
                <span className="language-choice-tick" aria-hidden="true"><Check size={13}/></span>
              </span>
              <span className="language-choice-sample">{choice.sample}</span>
              <span className="language-choice-note">{choice.note}</span>
            </button>
          );
        })}
      </div>

      <div className="highlight-choice" style={{ marginTop: 16 }}>
        <div className="highlight-choice-head">
          <strong style={{ fontSize: 13, fontWeight: 700 }}>2. Emphasized Words Option</strong>
          <em style={{ fontSize: 11.5, opacity: 0.75 }}>
            Choose whether key words should pop in your template&apos;s accent color &amp; motion, or keep all caption words normal and even.
          </em>
        </div>
        <div className="highlight-mockups" role="radiogroup" aria-label="Emphasized words option">
          {([
            {
              on: true,
              label: 'Emphasize keywords',
              desc: 'One key word per line grows in accent color with motion pop',
            },
            {
              on: false,
              label: 'No emphasized words',
              desc: 'Normal captions with full template style & motion (no highlight)',
            },
          ] as const).map(choice => {
            const selected = importAutoHighlight === choice.on;
            return (
              <button
                key={choice.label}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={choice.label}
                className={selected ? 'is-chosen' : ''}
                onClick={() => {
                  setImportAutoHighlight(choice.on);
                  updateSettings({ autoHighlight: choice.on });
                }}
              >
                <span className="mock">
                  {choice.on ? (
                    <>
                      <span>aap kaise</span>
                      <strong style={{ color: settings.accent }}>HO</strong>
                      <span>dosto</span>
                    </>
                  ) : (
                    <span>aap kaise ho dosto</span>
                  )}
                </span>
                <span className="highlight-mock-label">
                  <span className="highlight-mock-tick" aria-hidden="true"><Check size={12}/></span>
                  <span className="highlight-mock-text-col">
                    <span className="highlight-mock-main-title">{choice.label}</span>
                    <span className="highlight-mock-sub-desc">{choice.desc}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="modal-footnote">Emoji, translation and background-noise cleanup live in the Captions panel.</p>
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={()=>setLanguagePrompt(null)}>
          Not now
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => {
            const chosenHighlight = importAutoHighlight;
            updateSettings({ autoHighlight: chosenHighlight });
            setLanguagePrompt(null);
            void startTranscription({ script, language, autoHighlight: chosenHighlight });
          }}
        >
          <WandSparkles size={15}/> Generate captions
        </button>
      </div>
    </Modal>}
    <StudioModals
      modal={modal === 'help' || modal === 'search-replace' || modal === 'shortcuts' ? modal : null}
      onClose={() => setModal(null)}
      authEnabled={AUTH_ENABLED}
      projects={projects}
      onOpenProject={p => void openProject(p)}
      onNewUpload={() => input.current?.click()}
      timecode={timecode}
      project={project}
      searchFindText={searchFindText}
      setSearchFindText={setSearchFindText}
      searchReplaceText={searchReplaceText}
      setSearchReplaceText={setSearchReplaceText}
      searchCaseSensitive={searchCaseSensitive}
      setSearchCaseSensitive={setSearchCaseSensitive}
      onReplaceNext={() => {
        if (!project || !searchFindText.trim() || !searchReplaceText.trim()) return;
        const idx = project.words.findIndex(w => matchesCaptionWord(w.text, searchFindText, searchCaseSensitive));
        if (idx === -1) {
          notify(`No occurrences found for "${searchFindText}"`);
          return;
        }
        const target = project.words[idx];
        const updated = replaceAllOccurrences([target], searchFindText, searchReplaceText, searchCaseSensitive)[0].text;
        updateWord(target.id, { text: updated });
        seek(target.start);
        notify(`Replaced occurrence at ${target.start.toFixed(2)}s`);
      }}
      onReplaceAll={() => {
        if (!project || !searchFindText.trim() || !searchReplaceText.trim()) return;
        const count = project.words.filter(w => matchesCaptionWord(w.text, searchFindText, searchCaseSensitive)).length;
        const updatedWords = replaceAllOccurrences(project.words, searchFindText, searchReplaceText, searchCaseSensitive);
        markEdit({ ...project, words: updatedWords });
        notify(`Replaced ${count} occurrence${count === 1 ? '' : 's'}.`);
        setModal(null);
      }}
      onStartTour={() => setShowTour(true)}
    />

    <OnboardingTour
      isOpen={showTour}
      onClose={handleCloseTour}
    />

    <CommandPalette
      isOpen={showCommandPalette}
      onClose={() => setShowCommandPalette(false)}
      projects={projects}
      onOpenProject={p => void openProject(p)}
      onNewUpload={() => input.current?.click()}
      onOpenModal={m => setModal(m)}
      onStartTour={() => setShowTour(true)}
      onToggleTheme={toggleTheme}
      currentTheme={theme}
      settings={settings}
      onUpdateSettings={updateSettings}
      downloadTranscript={downloadTranscript}
      downloadAudioTrack={downloadAudioTrack}
      copyTranscript={copyTranscript}
      currentProject={project}
    />

    {hasExportRunning && modal !== 'export' && latestExport && (
      <div
        className="floating-export-badge"
        onClick={() => setModal('export')}
        role="button"
        tabIndex={0}
        title="Rendering in background — Click to view details"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModal('export'); } }}
      >
        <LoaderCircle size={14} className="spin" />
        <div className="floating-export-info">
          <span className="floating-export-title">Rendering {latestExport.resolution || 1080}p</span>
          <span className="floating-export-sub">{latestExport.progress || 0}% · Click to view</span>
        </div>
      </div>
    )}

    {accountMenu && (
      <>
        {/* The same transparent catcher the word inspector uses: a click
            anywhere else closes the menu, and it sits under the menu so the
            menu's own clicks never reach it. */}
        <div className="timeline-popover-backdrop" onClick={() => setAccountMenu(null)} />
        <div
          className="account-menu"
          role="menu"
          aria-label="Account"
          style={{ top: accountMenu.top, right: accountMenu.right }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setAccountMenu(null);
              accountButtonRef.current?.focus();
            }
          }}
        >
          <div className="account-menu-who">
            <span className="account-initial lg">{(accountName || accountEmail)[0].toUpperCase()}</span>
            <span className="account-menu-id">
              {accountName && <strong>{accountName}</strong>}
              <small>{accountEmail}</small>
            </span>
          </div>

          <button
            type="button"
            role="menuitem"
            className="account-menu-item"
            autoFocus
            onClick={() => { setAccountMenu(null); setActiveNavPanel('settings'); }}
          >
            <SettingsIcon size={15} />Settings
          </button>

          <button
            type="button"
            role="menuitem"
            className="account-menu-item danger"
            onClick={() => { setAccountMenu(null); void signOut(); }}
          >
            <LogOut size={15} />Sign out
          </button>
        </div>
      </>
    )}
    {timelinePopover && (
      <>
        <div
          className="timeline-popover-backdrop"
          onClick={saveTimelineWordEdit}
        />
        <WordInspector
          word={timelinePopover.word}
          draftText={timelinePopover.draftText}
          position={calculatePopoverPosition(timelinePopover.rect)}
          autoFocus
          onDraftChange={text => setTimelinePopover(p => p ? { ...p, draftText: text } : null)}
          onCommit={saveTimelineWordEdit}
          onRevert={() => setTimelinePopover(null)}
          onToggleHighlight={() => setWordHighlight(timelinePopover.spotlight ? 'clear' : 'highlight')}
          onApplyCase={c => applyTimelineWordCase(c)}
          onSplit={() => {
            handleSplitLine(timelinePopover.word.id);
            setTimelinePopover(null);
          }}
          onDelete={() => {
            handleDeleteWord(timelinePopover.word.id);
            setTimelinePopover(null);
          }}
          onClose={() => setTimelinePopover(null)}
        />
      </>
    )}

    {greenScreenTargetEl && (
      <GreenScreenModal
        asset={{
          id: greenScreenTargetEl.assetId || greenScreenTargetEl.id,
          name: greenScreenTargetEl.name,
          filename: greenScreenTargetEl.name,
          mediaType: greenScreenTargetEl.type,
          size: 0,
          duration: duration,
          createdAt: '',
          url: project ? assetMediaPath(project.id, greenScreenTargetEl.assetId) : '',
          greenScreen: greenScreenTargetEl.greenScreen,
        }}
        onClose={() => setGreenScreenTargetEl(null)}
        onApply={(config) => {
          handleUpdateCanvasElement(greenScreenTargetEl.id, { greenScreen: config });
          setGreenScreenTargetEl(null);
          notify(`Updated green screen for "${greenScreenTargetEl.name}"`);
        }}
      />
    )}
  </div>;
}

/**
 * Sign-in, before the studio exists.
 *
 * A wrapper rather than a branch inside App, because App's startup effects run
 * on mount whatever the render returns — it fetches limits, health and the
 * project list, then polls every seven seconds. Returning a login form from
 * inside it would leave all of that running against a backend that answers 401.
 *
 * Unconfigured, this is not in the way at all: no client, no gate, straight to
 * the studio with the browser's own workspace id, exactly as before.
 */
function Root() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [ready, setReady] = React.useState(!AUTH_ENABLED);
  // A password-reset link signs the user in and then needs to ask for the new
  // password. Without catching this the reset lands them in the editor with the
  // old password still set and nothing to show for the link they clicked.
  const [recovering, setRecovering] = React.useState(false);

  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      rememberSession(data.session);
      setSession(data.session);
      setReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      rememberSession(next);
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'USER_UPDATED') setRecovering(false);
      if (event === 'SIGNED_OUT') forgetMediaTokens();
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="auth-screen" aria-busy="true" />;
  if (AUTH_ENABLED && !session) return <AuthScreen/>;
  if (recovering) return <AuthScreen initialMode="recover"/>;
  // Keyed on the account so signing in as someone else builds a new editor.
  // Without it the previous user's project, words and media stay mounted, and
  // one person's clip renders under another person's session.
  return <App key={session?.user?.id ?? 'local'}/>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
