import { StudioNotice } from './components/StudioNotice';
import { useStudioConfirm } from './components/useStudioConfirm';
import { CloudUpload, ShieldCheck } from 'lucide-react';
import './drive-storage.css';
import { DriveProjects } from './components/DriveProjects';
import { driveStatus, uploadDrive, openDriveProject, saveDriveProject, exportToDrive, waitForDrive, retryDriveSave } from './lib/drive';
import { setLocalMedia } from './lib/api';
import { EditorResizeHandle } from './components/EditorResizeHandle';
import { trackEvent } from './lib/telemetry';
import { ProfilePopup } from './components/ProfilePopup';
import { canvasKeyboardChange, editSnapshot, isBrowserZoomKey, playbackFrame, activeCaptionIndex, captionTimeIndex, timeIntervalIndex, timelineGroupWindow, timelineWindowIndices } from './lib/frontend-reliability';
import { assetMediaPath, syncMediaSource } from './lib/media-credentials';
import { editCaptionGroup } from './lib/caption-edit';
import { captionBounds } from './lib/caption-settings';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Ban, Bold, Camera, Captions, Check, CheckCheck, ChevronDown, CircleHelp, Clapperboard, Clock, Edit3, FileAudio, Film, Folder, FolderOpen, GripHorizontal, Headphones, Italic, Link2, LoaderCircle, LogOut, Maximize2, Moon, MoreHorizontal, Palette, Pencil, Redo2, Replace, RotateCcw, Rows2, Scan, Settings as SettingsIcon, Settings2, SlidersHorizontal, Smile, Sparkles, Split, SquarePlay, Star, Subtitles, Sun, Trash2, Type, Undo2, Upload, Video, Volume2, VolumeX, WandSparkles, X, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import '@fontsource/noto-sans-devanagari/700.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
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
import { type PlayerRef } from '@remotion/player';
import { captionWordsPerPage, treatmentFor } from './remotion/treatments';
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
import { ensureMediaToken, forgetMediaTokens } from './lib/api';
import { AUTH_ENABLED, supabase } from './lib/auth';
import { timecode } from './lib/timecode';
import { StudioTimeline } from './components/StudioTimeline';
import { PreviewStage } from './components/PreviewStage';
import { UploadDropzone } from './components/UploadDropzone';
import { ExportModal } from './components/ExportModal';
import { useStudioTheme } from './lib/useStudioTheme';
import { stageFileDropHandlers } from './lib/stage-file-drop';

type EditState = Pick<Project, 'words' | 'settings' | 'name' | 'videoEnabled' | 'activeMediaAssetId'> & {
  canvasElements?: CanvasVisualElement[];
};

/** Shown when a save fails; the status dot keys off this exact value. */
const NAV_PANELS: { id: NavPanelId; label: string; icon: React.ReactNode }[] = [
  { id: 'caption', label: 'Caption', icon: <Captions size={20} strokeWidth={1.75} /> },
  { id: 'media', label: 'Media', icon: <Camera size={20} strokeWidth={1.75} /> },
  { id: 'text', label: 'Text', icon: <Type size={20} strokeWidth={1.75} /> },
  { id: 'style', label: 'Style', icon: <Clock size={20} strokeWidth={1.75} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} strokeWidth={1.75} /> },
];

export default function App() {
  const { theme, persistTheme, toggleTheme } = useStudioTheme();
  const { confirm: confirmUnsaved, dialog: unsavedDialog } = useStudioConfirm();

  const [project, setProject] = useState<Project | null>(null);
  const modeChosen = useRef(false);
  const [storageMode, setStorageMode] = useState<'temporary' | 'drive'>('temporary');
  const [driveReady, setDriveReady] = useState(false);
  const [driveCheck, setDriveCheck] = useState<'checking' | 'ready' | 'failed'>(AUTH_ENABLED ? 'checking' : 'ready');
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadPreviewType, setUploadPreviewType] = useState('video');
  const exportDestinations = useRef(new Map<string, 'download' | 'drive'>());
  const [exportDriveBusy, setExportDriveBusy] = useState(false);
  const transferActive = useRef(false);
  useEffect(() => {
    if (!AUTH_ENABLED) return;
    let live = true;
    setDriveCheck('checking');
    void driveStatus().then(status => {
      if (!live) return;
      setDriveReady(status.connected);
      setDriveCheck('ready');
      if (status.connected) setSessionNotice(false);
      if (status.connected && !modeChosen.current) setStorageMode('drive');
    }).catch(() => { if (live) setDriveCheck('failed'); });
    const url = new URL(window.location.href);
    if (url.searchParams.has('drive')) {
      if (url.searchParams.get('drive') === 'failed') setWorkspaceOpen(true);
      url.searchParams.delete('drive'); window.history.replaceState(null, '', url);
    }
    return () => { live = false; };
  }, [connectionAttempt]);
  useEffect(() => () => { if (uploadPreview) URL.revokeObjectURL(uploadPreview); }, [uploadPreview]);

  const projectRef = useRef<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  useEffect(() => { transferActive.current = uploadProgress !== null || exportDriveBusy || !!project?.cloudAudioOnly; }, [uploadProgress, exportDriveBusy, project?.cloudAudioOnly]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [timelineHover, setTimelineHover] = useState<{ xPct: number; time: number } | null>(null);
  const [script, setScript] = useState('roman');
  const [language, setLanguage] = useState('auto');
  const editorScrollRef = useRef<HTMLElement>(null);
  const mobilePanelScroll = useRef<Record<string, number>>({});
  const [mobileTimelineExpanded, setMobileTimelineExpanded] = useState(false);
  const [editorPanelWidth, setEditorPanelWidth] = useState<number | null>(null);
  const [editorTimelineHeight, setEditorTimelineHeight] = useState<number | null>(null);
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
  /**
   * The local-session notice: projects live only in this tab for now, so say
   * so once per visit, before anyone puts work in. Session storage rather than
   * local, so a new visit is reminded again while the warning is still true.
   */
  const [sessionNotice, setSessionNotice] = useState(() => {
    try { return sessionStorage.getItem('bol_local_notice_seen') !== '1'; } catch { return true; }
  });
  const dismissSessionNotice = () => {
    setSessionNotice(false);
    try { sessionStorage.setItem('bol_local_notice_seen', '1'); } catch { /* private window */ }
  };
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  /** What sign-up asked for, when it was asked. Blank for accounts made before
   *  the field existed, so every reader of it falls back to the email. */
  const [accountName, setAccountName] = useState('');
  const [accountJoined, setAccountJoined] = useState('');
  const [accountVerified, setAccountVerified] = useState(false);
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
  const captionTimingRef = useRef<Map<string, number>>(new Map());
  const exportTimingRef = useRef<Map<string, number>>(new Map());
  const elapsedTelemetry = (timings: Map<string, number>, id: string) => {
    const start = timings.get(id); timings.delete(id);
    return start === undefined ? {} : { elapsed_seconds: Math.round((performance.now() - start) / 1000) };
  };
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
      if (project && project.status === 'ready' && project.words.length > 0 && !languagePrompt && !modal && !showCommandPalette && !localStorage.getItem('bol_tour_completed')) {
        setShowTour(true);
      }
    } catch {
      // localStorage disabled or unavailable
    }
  }, [project?.id, project?.status, project?.words.length, languagePrompt, modal, showCommandPalette]);

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
  const isSingleWordTemplate = useCallback((tpl: string) => {
    return captionWordsPerPage(tpl, 2) === 1;
  }, []);
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
    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);
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
      setAccountJoined(data.user?.created_at ?? '');
      setAccountVerified(!!data.user?.email_confirmed_at);
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
      if (document.hidden) return;
      try {
        const h = await request<Health>('/health');
        if (!closed) setHealth(h);
      } catch { if (!closed) setHealth(null); }
    }
    void check(); const timer = setInterval(check, 60000); return () => { closed = true; clearInterval(timer); };
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
          if (current.status === 'error') trackEvent('captions_failed', elapsedTelemetry(captionTimingRef.current, current.id));
          if (current.status === 'ready') {
            trackEvent('captions_completed', elapsedTelemetry(captionTimingRef.current, current.id));
            // Recognition establishes a new editing baseline; old snapshots must
            // never replace these generated words with the pre-generation scene.
            setHistory([]); setFuture([]);
            setSelectedWord(null); setSelectedWordIds(new Set());
            savedProjectRef.current = current; setSettings(current.settings);
            setSaveStatus(current.cloudAudioOnly ? 'Original saving to Drive…' : current.cloudId ? (current.cloudSaveError ? 'Not saved — retry save' : 'Saved to your workspace') : 'Temporary session');
            if (current.cloudSaveError) { dirtyRef.current += 1; setDirty(dirtyRef.current); }
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
      trackEvent('export_completed', elapsedTelemetry(exportTimingRef.current, job.id));
      downloadedExportIdsRef.current.add(job.id);
      setActiveExportId(null);
      setLastDownloadedExportId(job.id);
      // The token is waited for rather than assumed: this fires the moment a
      // render finishes, which can be long after the one minted when the project
      // was opened, and a download URL without one is refused — which the browser
      // shows as simply nothing happening.
      void (async () => {
        if (exportDestinations.current.get(job.id) === 'drive') {
          setExportDriveBusy(true);
          try {
            await exportToDrive(project, job.id);
            notify('Export saved in your Bol Studio Google Drive folder.');
          } catch (e) { notify(`${(e as Error).message} You can retry Save to Drive from Export.`); }
          finally { setExportDriveBusy(false); }
          return;
        }
        await ensureMediaToken(project.id);
        const link = document.createElement('a');
        link.href = mediaUrl(`/api/projects/${project.id}/exports/${job.id}/download`);
        link.download = job.filename || `${project.name || 'export'}-${job.mode}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notify('Export complete! Your video download has started.');
      })().catch(e => notify((e as Error).message));
    } else if (job.status === 'error') {
      trackEvent('export_failed', elapsedTelemetry(exportTimingRef.current, job.id));
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
          if (result.cloudId) {
            setSaveStatus('Saving to Drive workspace…');
            await saveDriveProject(result);
            projectRef.current = { ...projectRef.current!, cloudRevision: result.cloudRevision };
          }
          savedDirty.current = generation;
          setSaveStatus(result.cloudAudioOnly ? 'Original saving to Drive…' : result.cloudId ? 'Saved to your workspace' : 'Temporary session');
          setProject(previous => previous?.id === p.id ? { ...previous, revision: result.revision, cloudRevision: result.cloudRevision } : previous);
        }
      } catch (e) {
        setSaveStatus(UNSAVED);
        if (e instanceof ApiError && e.status === 409 && p.cloudId) {
          notify('This Drive project changed on another device. Download your subtitles to keep a copy, then reopen the saved project from your workspace.');
          throw e;
        }
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
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirtyRef.current > savedDirty.current || transferActive.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload',handler); return () => window.removeEventListener('beforeunload',handler); }, []);

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
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);
      setSnapGuideX(false);
      setSnapGuideY(false);
      handleUpdateCanvasElement(id, { x: currentX, y: currentY });
    };

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
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
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);
      handleUpdateCanvasElement(id, { scale: currentScale });
    };

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
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
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);
      handleUpdateCanvasElement(id, { start: finalStart, end: finalEnd });
    };

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
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
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);

      const latestProj = projectRef.current;
      if (!latestProj) return;

      const finalWords = latestProj.words.map(w =>
        w.id === word.id ? { ...w, start: currentStart, end: currentEnd } : w
      );
      ensureValidIntervals(finalWords, duration);
      commitDrag(p, { ...latestProj, words: finalWords });
      notify(`Adjusted "${word.text}" timing: ${timecode(currentStart)} - ${timecode(currentEnd)} (${(currentEnd - currentStart).toFixed(2)}s)`);
    };

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
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
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);

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

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
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
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);

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

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
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
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);

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

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
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
      window.removeEventListener('pointermove', onMouseMove);
      window.removeEventListener('pointerup', onMouseUp);
      window.removeEventListener('pointercancel', onMouseUp);

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

    window.addEventListener('pointermove', onMouseMove);
    window.addEventListener('pointerup', onMouseUp);
    window.addEventListener('pointercancel', onMouseUp);
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
    // Capture Space before a focused button or select can activate itself. Text editors
    // and dialogs keep their native keyboard behavior; Enter still activates buttons.
    const onPlaybackSpace = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || (e.code !== 'Space' && e.key !== ' ')) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (document.querySelector('[aria-modal="true"], dialog[open]') ||
          target?.closest('input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
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
    if (driveCheck !== 'ready') { notify('Wait for your workspace connection check, or choose temporary mode.'); if (input.current) input.current.value = ''; return; }
    if (file.size > 1024*1024*1024) { notify('Choose a file smaller than 1 GB.'); return; }
    trackEvent('upload_started', { size_mb: Math.round(file.size / 1048576), media_type: file.type.startsWith('video/') ? 'video' : 'audio' });
    const uploadStartedAt = performance.now();
    setUploadProgress(0); setPlaying(false); media.current?.pause();
    setUploadPreview(URL.createObjectURL(file)); setUploadPreviewType(file.type.startsWith('audio/') ? 'audio' : 'video');
    setStorageMessage(storageMode === 'drive' ? 'Saving to your Google Drive…' : 'Uploading temporary processing file…');
    try {
      await flushSave();
      if (projectRef.current) await waitForDrive(projectRef.current);
      const result = storageMode === 'drive'
        ? await uploadDrive(file, script, language, setUploadProgress, setStorageMessage, (complete, error) => {
          if (error) { notify(error.message); setSaveStatus('Drive save interrupted'); return; }
          if (!complete) return;
          const metadata = { cloudAudioOnly: false, cloudRevision: complete.cloudRevision, mediaType: complete.mediaType,
            filename: complete.filename, width: complete.width, height: complete.height };
          if (projectRef.current?.id === complete.id) {
            projectRef.current = { ...projectRef.current, ...metadata };
            setProject(current => current?.id === complete.id ? { ...current, ...metadata } : current);
            setSaveStatus(complete.cloudSaveError ? 'Not saved — retry save' : complete.cloudRevision === 0 ? 'Original saved · captions processing' : 'Saved to your workspace');
          }
        })
        : await upload(file,script,language,setUploadProgress);
      setLocalMedia(result.id, file);
      result.name = file.name || result.filename || result.name;
      result.settings = result.settings || defaults;
      setProject(result); projectRef.current=result; setSettings(result.settings); setTime(0); setSelectedWord(null); setSelectedWordIds(new Set()); setHistory([]); setFuture([]); setCaptionToolsOpen(false); setSaveStatus(result.cloudAudioOnly ? 'Original saving to Drive…' : result.cloudId ? 'Saved to your workspace' : 'Temporary session');
      savedProjectRef.current = result; savedDirty.current = dirtyRef.current;
           setProjects(list=>[result,...list.filter(p=>p.id!==result.id)]);
      setImportAutoHighlight(result.settings.autoHighlight !== false);
      setLanguagePrompt('open');
      trackEvent('upload_completed', { elapsed_seconds: Math.round((performance.now() - uploadStartedAt) / 1000) });
      void refreshLimits();
    } catch(e) { trackEvent('upload_failed'); notify((e as Error).message); }
    finally { setUploadProgress(null); setUploadPreview(null); if (!projectRef.current?.cloudAudioOnly) setStorageMessage(''); if(input.current) input.current.value=''; }
  }

  const { handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = stageFileDropHandlers({
    dragCounterRef, setIsDraggingOver, handleAddMediaToCanvas, notify, importFile,
  });
  async function openProject(p: Project) {
    try {
      await flushSave();
      if (projectRef.current) await waitForDrive(projectRef.current);
      const result=await request<Project>(`/projects/${p.id}`);
      setLocalMedia(result.id); savedProjectRef.current = result; savedDirty.current = dirtyRef.current;
      setSaveStatus(result.cloudAudioOnly ? 'Original saving to Drive…' : result.cloudId ? 'Saved to your workspace' : 'Temporary session');
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
  function pauseForExport() {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    media.current?.pause();
    captionPlayer.current?.pause();
    setPlaying(false);
  }
  function openExport() {
    pauseForExport();
    setModal('export');
  }
  async function startExport(destination: 'download' | 'drive' = 'download') {
    if (!project) return;
    pauseForExport();
    const currentProject = project;
    const exportStartedAt = performance.now();
    trackEvent('export_started', { mode: exportMode, resolution, fps: exportFps });
    setExporting(true);
    setLastDownloadedExportId(null);
    try {
      await flushSave();
      await waitForDrive(currentProject);
      const job = await request<ExportJob>(`/projects/${currentProject.id}/exports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: exportMode, resolution, fps: exportFps }),
      });
      if (job?.id) {
        exportDestinations.current.set(job.id, destination);
        exportTimingRef.current.set(job.id, exportStartedAt);
        setActiveExportId(job.id);
      }
      const result = await request<Project>(`/projects/${currentProject.id}`);
      if (projectRef.current?.id === currentProject.id) {
        setProject(p => p?.id === currentProject.id ? { ...p, exports: result.exports } : p);
      }
    } catch (e) {
      trackEvent('export_failed');
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
      if (currentProject.isolateVocals) await waitForDrive(currentProject);
      captionTimingRef.current.set(currentProject.id, performance.now());
      trackEvent('captions_started');
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
    catch(e){trackEvent('captions_failed', elapsedTelemetry(captionTimingRef.current, currentProject.id));notify((e as Error).message);}
  }
  const retryTranscription = () => startTranscription();

  return <div className="app-shell">
    <input ref={input} disabled={driveCheck !== 'ready'} type="file" accept="video/*,audio/*,.mkv,.m4a,.wav,.mp3,.webm" hidden onChange={e=>void importFile(e.target.files?.[0])}/>

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
      onOpenExport={openExport}
      onOpenShortcuts={() => setModal('shortcuts')}
      onOpenWorkspace={AUTH_ENABLED ? () => setWorkspaceOpen(true) : undefined}
      workspaceLabel={storageMode === 'drive' ? 'Drive workspace and saved projects' : 'Temporary mode · saved projects and storage options'}
    />

    {workspaceOpen && <DriveProjects onClose={() => setWorkspaceOpen(false)} notify={notify} hasOpenProject={!!project}
      onMode={mode => { modeChosen.current = true; setStorageMode(mode); if (mode === 'drive') setDriveReady(true); }}
      onOpen={async id => {
        try { await flushSave(); if (projectRef.current) await waitForDrive(projectRef.current); } catch {
          if (!await confirmUnsaved('Your latest edits haven’t finished saving. Opening another project will discard those edits in this tab.')) return;
        }
        const saved = await openDriveProject(id); savedDirty.current = dirtyRef.current; conflictRef.current = null; await openProject(saved);
        setWorkspaceOpen(false); setStorageMode('drive'); setDriveReady(true);
      }}/>}
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
              onClick={() => {
                const portrait = window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches;
                const scroll = portrait ? editorScrollRef.current?.querySelector<HTMLElement>(':scope > .panel') : editorScrollRef.current;
                if (scroll && window.matchMedia('(max-width: 900px)').matches) mobilePanelScroll.current[activeNavPanel] = scroll.scrollTop;
                setActiveNavPanel(panel.id);
                requestAnimationFrame(()=>{
                  const nextScroll = portrait ? editorScrollRef.current?.querySelector<HTMLElement>(':scope > .panel') : editorScrollRef.current;
                  if(nextScroll && window.matchMedia('(max-width: 900px)').matches) nextScroll.scrollTop = mobilePanelScroll.current[panel.id] || 0;
                });
                trackEvent('panel_opened', { panel: panel.id }); }}
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

      <main className="editor-grid" ref={editorScrollRef} style={{ '--editor-panel-width': `${editorPanelWidth ?? 360}px` } as React.CSSProperties}>
        <EditorResizeHandle axis="panel" value={editorPanelWidth} onChange={setEditorPanelWidth} onReset={() => setEditorPanelWidth(null)} />
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
              <UploadDropzone
                isDraggingOver={isDraggingOver}
                uploadProgress={uploadProgress}
                input={input}
                storageChecking={driveCheck === 'checking'}
                driveConnected={driveReady && storageMode === 'drive'}
                onOpenProjects={() => setWorkspaceOpen(true)}
              />
            ) : (
              <PreviewStage
                preview={preview}
                hasVideoLayer={hasVideoLayer}
                videoEnabled={videoEnabled}
                size={size}
                media={media}
                togglePlay={togglePlay}
                setPreviewHover={setPreviewHover}
                draggingCaption={draggingCaption}
                project={project}
                activeMediaAsset={activeMediaAsset}
                busy={busy}
                muted={muted}
                mediaResumeRef={mediaResumeRef}
                playbackRate={playbackRate}
                notify={notify}
                setPlaying={setPlaying}
                setTime={setTime}
                captionPlayer={captionPlayer}
                words={words}
                settings={settings}
                duration={duration}
                previewHover={previewHover}
                activePage={activePage}
                setDraggingCaption={setDraggingCaption}
                setCaptionSnap={setCaptionSnap}
                setCaptionPosition={setCaptionPosition}
                captionSnap={captionSnap}
                updateSettings={updateSettings}
                thisLineOnly={thisLineOnly}
                setThisLineOnly={setThisLineOnly}
                projectRef={projectRef}
                markEdit={markEdit}
                canvas={canvas}
                safeArea={safeArea}
                selectedCanvasElementId={selectedCanvasElementId}
                handleDeleteCanvasElement={handleDeleteCanvasElement}
                setSelectedCanvasElementId={setSelectedCanvasElementId}
                snapGuideX={snapGuideX}
                snapGuideY={snapGuideY}
                canvasElements={canvasElements}
                time={time}
                handleUpdateCanvasElement={handleUpdateCanvasElement}
                handleStartDragCanvasElement={handleStartDragCanvasElement}
                handleStartResizeCanvasElement={handleStartResizeCanvasElement}
                setGreenScreenTargetEl={setGreenScreenTargetEl}
                isDraggingOver={isDraggingOver}
              />
            )}
          </div>

          {/* Clean White Timeline matching Image 2 */}
          <StudioTimeline
            timelineContainerRef={timelineContainerRef}
            editorTimelineHeight={editorTimelineHeight}
            mobileTimelineExpanded={mobileTimelineExpanded}
            setEditorTimelineHeight={setEditorTimelineHeight}
            setMobileTimelineExpanded={setMobileTimelineExpanded}
            time={time}
            duration={duration}
            seek={seek}
            project={project}
            playing={playing}
            togglePlay={togglePlay}
            playbackRate={playbackRate}
            setPlaybackRate={setPlaybackRate}
            handleSplitAtCurrent={handleSplitAtCurrent}
            timelineZoom={timelineZoom}
            setTimelineZoom={setTimelineZoom}
            modal={modal}
            setModal={setModal}
            preview={preview}
            notify={notify}
            timelineViewportRef={timelineViewportRef}
            readTimelineWindow={readTimelineWindow}
            timelineTrackRef={timelineTrackRef}
            setIsScrubbing={setIsScrubbing}
            handleTimelineTrackClick={handleTimelineTrackClick}
            setTimelineHover={setTimelineHover}
            rulerTicks={rulerTicks}
            timelineHover={timelineHover}
            isScrubbing={isScrubbing}
            canvasElements={canvasElements}
            selectedCanvasElementId={selectedCanvasElementId}
            setSelectedCanvasElementId={setSelectedCanvasElementId}
            handleStartDragTimelineMedia={handleStartDragTimelineMedia}
            visibleTimelineIndices={visibleTimelineIndices}
            groups={groups}
            startGroupTrim={startGroupTrim}
            selectedWordIds={selectedWordIds}
            heroWordIds={heroWordIds}
            startWordDrag={startWordDrag}
            handleWordContextMenu={handleWordContextMenu}
            setSelectedWord={setSelectedWord}
            setTimelinePopover={setTimelinePopover}
            startWordHandleDrag={startWordHandleDrag}
            startWordDividerDrag={startWordDividerDrag}
            startGroupDrag={startGroupDrag}
            handleAddWord={handleAddWord}
          />
        </section>
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
            onOpenExports={openExport}
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
    <div className="studio-notifications" aria-label="Studio notifications">
      {driveCheck === 'failed' && <StudioNotice tone="warning" title="Can’t reach your workspace" actions={<><button className="button" onClick={() => setConnectionAttempt(n => n + 1)}>Try again</button><button className="button" onClick={() => { modeChosen.current = true; setStorageMode('temporary'); setDriveCheck('ready'); dismissSessionNotice(); }}>Work temporarily</button></>}>Your saved projects are safe. Check your connection and retry.</StudioNotice>}
      {storageMessage && !uploadPreview && <StudioNotice tone={storageMessage.includes('interrupted') ? 'warning' : 'progress'} title={storageMessage.includes('interrupted') ? 'Drive save paused' : 'Saving to your Drive'} actions={project?.cloudAudioOnly && storageMessage.includes('interrupted') ? <button className="button" onClick={() => void retryDriveSave(project).catch(e => notify((e as Error).message))}>Retry save</button> : undefined}>{storageMessage.includes('interrupted') ? 'Keep this tab open. Retry before exporting.' : storageMessage}</StudioNotice>}
      {notice && <StudioNotice title={notice} onDismiss={() => setNotice('')}/>}
      {uploadProgress !== null && !uploadPreview && <StudioNotice tone="progress" title={`Uploading your video · ${Math.round(uploadProgress)}%`} progress={uploadProgress}>Keep this tab open. We’ll take it from here.</StudioNotice>}
    </div>
    {unsavedDialog}
    {modal === 'export' && (
      <ExportModal
        setModal={setModal}
        exportMode={exportMode}
        setExportMode={setExportMode}
        project={project}
        settings={settings}
        resolution={resolution}
        setResolution={setResolution}
        exportFps={exportFps}
        setExportFps={setExportFps}
        hasExportRunning={hasExportRunning}
        latestExport={latestExport}
        overExportLimit={overExportLimit}
        duration={duration}
        maxExportSeconds={maxExportSeconds}
        startExport={() => startExport('download')}
        driveAvailable={!!project?.cloudId && driveReady}
        exportDriveBusy={exportDriveBusy}
        startDriveExport={() => startExport('drive')}
        retryDriveExport={async () => {
          if (!project || !latestExport) return;
          setExportDriveBusy(true);
          try { await exportToDrive(project, latestExport.id); notify('Export saved to Google Drive.'); }
          catch (e) { notify((e as Error).message); }
          finally { setExportDriveBusy(false); }
        }}
        exporting={exporting}
        lastDownloadedExportId={lastDownloadedExportId}
        downloadTranscript={downloadTranscript}
        downloadAudioTrack={downloadAudioTrack}
        copyTranscript={copyTranscript}
      />
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
    {uploadPreview && uploadProgress !== null && <Modal title={storageMode === 'drive' ? 'Saving your video' : 'Preparing your video'} icon={<CloudUpload size={22}/>} className="upload-progress-modal" dismissible={false} onClose={() => {}}>
      {uploadPreviewType === 'video' ? <video className="drive-upload-preview" src={uploadPreview} controls playsInline/> : <audio src={uploadPreview} controls/>}
      <StudioNotice tone="progress" title={uploadProgress < 100 ? `Uploading · ${Math.round(uploadProgress)}%` : 'Preparing your editing session'} progress={uploadProgress}>{storageMessage || 'Getting your video ready…'}</StudioNotice>
      <p className="upload-reassurance">Preview while you wait. Keep this tab open until we’re done.</p>
    </Modal>}
    {sessionNotice && driveCheck === 'ready' && !driveReady && !workspaceOpen && <Modal title="Your next project" icon={<ShieldCheck size={22}/>} className="session-notice-modal" onClose={dismissSessionNotice}>
      <p className="modal-lede">Edit once, or save it for later. Your choice.</p>
      {!AUTH_ENABLED && <p className="session-signin-note"><ShieldCheck size={15}/> Sign in to save with Google Drive.</p>}
      <div className="session-mode-note"><Clock size={19}/><div><strong>Just this session</strong><p>Media goes to our caption processor. Download before leaving; temporary edits aren’t saved to your account.</p></div></div>
      <div className="modal-actions">
        <button type="button" className="button" onClick={() => { modeChosen.current = true; setStorageMode('temporary'); dismissSessionNotice(); }}>Continue temporarily</button>
        <button type="button" className="button primary" disabled={!AUTH_ENABLED} onClick={() => { dismissSessionNotice(); setWorkspaceOpen(true); }}>Save with Google Drive</button>
      </div>
    </Modal>}
    {languagePrompt && project && <Modal title="Caption setup" className="caption-setup-modal" onClose={()=>setLanguagePrompt(null)}>
      <p className="modal-lede">Choose how your captions look.</p>

      <div className="caption-setup-section-label">
        Language &amp; script
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

      <div className="highlight-choice">
        <div className="highlight-choice-head">
          <strong>Word emphasis</strong>
          <em>
            Make one word stand out, or keep all words evenly styled.
          </em>
        </div>
        <div className="highlight-mockups" role="radiogroup" aria-label="Emphasized words option">
          {([
            {
              on: true,
              label: 'Highlight keywords',
              desc: 'One word per caption stands out.',
            },
            {
              on: false,
              label: 'Even styling',
              desc: 'All words use the same emphasis.',
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
      <p className="modal-footnote">You can change these in the Captions panel.</p>
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
      isOpen={showTour && !languagePrompt && !modal && !showCommandPalette && !saveConflict}
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
        onClick={openExport}
        role="button"
        tabIndex={0}
        title="Rendering in background — Click to view details"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openExport(); } }}
      >
        <LoaderCircle size={14} className="spin" />
        <div className="floating-export-info">
          <span className="floating-export-title">Rendering {latestExport.resolution || 1080}p</span>
          <span className="floating-export-sub">{latestExport.progress || 0}% · Click to view</span>
        </div>
      </div>
    )}

    {accountMenu && <ProfilePopup name={accountName} email={accountEmail}
      driveProject={!!project?.cloudId}
      workspaceLabel={project?.cloudId ? (project.cloudAudioOnly ? 'Saving to Google Drive' : 'Google Drive project') : 'Temporary session'}
      joined={accountJoined} verified={accountVerified} onClose={() => setAccountMenu(null)}
      onSaveName={async name => {
        if (!supabase) throw new Error('Account service is unavailable.');
        const { data, error } = await supabase.auth.updateUser({ data: { full_name: name } });
        if (error) throw error;
        setAccountName(String(data.user.user_metadata.full_name ?? name));
      }}
      onSettings={() => { setAccountMenu(null); setActiveNavPanel('settings'); }}
      onSignOut={() => { setAccountMenu(null); void signOut(); }} />}
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
