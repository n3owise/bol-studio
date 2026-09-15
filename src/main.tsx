import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Accessibility, AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, AudioLines, Ban, Bold, Camera, Captions, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clapperboard, Clock, Download, Edit3, FileAudio, Film, Folder, FolderOpen, GripHorizontal, Headphones, Image as ImageIcon, Italic, Layers, Link2, LoaderCircle, Maximize2, Minus, MonitorPlay, Moon, MoreHorizontal, Music, Palette, Pause, Pencil, Play, Plus, Redo2, Replace, RotateCcw, Rows2, Scan, Scissors, Search, Settings as SettingsIcon, Settings2, SlidersHorizontal, Smile, Sparkles, Split, SquarePlay, Star, Subtitles, Sun, Trash2, Type, Undo2, Upload, UploadCloud, Video, Volume2, VolumeX, Wand2, WandSparkles, X, Zap, ZoomIn, ZoomOut } from 'lucide-react';
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
import { API, fetchMediaAssets, request, upload, mediaUrl } from './lib/api';
import { defaults, type CanvasTextElement, type CanvasTextType, type CanvasVisualElement, type ExportJob, type GreenScreenSettings, type MediaAsset, type Project, type Settings, type Word } from './lib/types';
import { appendWord, autoDetectHighlights, dimensions, ensureValidIntervals, getContrastColor, insertWord, mergeLines, moveWordToLine, moveWordsToLine, moveWordToNextLine, moveWordToPreviousLine, replaceAllOccurrences, splitLineAtWord, subtitleText, templates } from './lib/captions';
import { MAX_WORDS_PER_PAGE, groupWords } from './lib/pages';
import captionFonts from './lib/caption-fonts.json';
import { Player, type PlayerRef } from '@remotion/player';
import { CaptionTrack } from './remotion/CaptionTrack';
import { treatmentFor } from './remotion/treatments';
import { CAPTION_FPS } from './remotion/Root';
import { drawKeyedMedia } from './lib/chromakey';
import { MediaPanel, GreenScreenModal } from './components/MediaPanel';
import { CaptionsPanel } from './components/CaptionsPanel';
import { TextPanel } from './components/TextPanel';
import { createDefaultTextElement, drawTextElements, transformTextCase } from './lib/text';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';

const timecode = (s: number) => `${Math.floor(Math.max(0,s)/60).toString().padStart(2,'0')}:${(Math.max(0,s)%60).toFixed(1).padStart(4,'0')}`;
type Health = { status?: string; engine?: string; model?: string; [key: string]: unknown };
type EditState = Pick<Project, 'words' | 'settings' | 'name' | 'videoEnabled'> & {
  textElements?: CanvasTextElement[];
  canvasElements?: CanvasVisualElement[];
};

/** Shown when a save fails; the status dot keys off this exact value. */
const UNSAVED = 'Unsaved changes';

function TemplatePreview({ id, thirdLine }: { id: string; thirdLine?: string }) {
  if (id === 'kinetic') return <strong>BAWAAL.</strong>;
  if (id === 'editorial') return <span>dil se <b>bolo.</b></span>;
  if (id === 'bounce') return <span>thoda <b>extra</b></span>;
  if (id === 'karaoke') return <span>apni <b>vibe</b> hai.</span>;
  if (id === 'neon') return <span>CHAMKEE-<b>LA</b></span>;
  if (id === 'glow-script') return <span>Jadoo <i>wali</i> <b>baat</b></span>;
  if (id === 'scribble') return <span><b>GOLMAAL</b><small>~ ~ ~</small></span>;
  if (id === 'welcome-stack') return <span>ab <b>HERO</b><small>ki entry</small></span>;
  if (id === 'soft-focus') return <span>Dil ka <i>sukoon</i></span>;
  if (id === 'double-trouble') return <span><b>JODI</b><i>NO. 1</i></span>;
  if (id === 'bubble-highlight') return <span>Apna <b>Tashan</b> dikhao</span>;
  if (id === 'mumbai') return <span><b>BAMBAIYA</b><i>meri jaan</i></span>;
  if (id === 'editing-school') return <span><b>USTAAD</b></span>;
  if (id === 'kalakar-shadow') return <span>Hello <b>KALAKAR</b></span>;
  if (id === 'pop-up') return <span>PATAKHA <b>DHAMAKA</b></span>;
  // Composition 2 is the three-line preset, so its card shows three lines.
  if (id === 'mogrt-triple') {
    return (
      <span className="mogrt-triple-art">
        <i>creative</i>
        <b>caption</b>
        <u style={{ color: thirdLine }}>presets</u>
      </span>
    );
  }
  if (id.startsWith('mogrt-')) return <span>ye <b>SAB</b> kuch</span>;
  return <span>THINK <b>BIGGER.</b></span>;
}
function TemplateCard({ template, selected, onClick, disabled = false, thirdLine }: { template: typeof templates[number]; selected: boolean; onClick: () => void; disabled?: boolean; thirdLine?: string }) {
  const pillColor = getContrastColor(template.accent);
  return <button className={`template-card ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected} disabled={disabled}>
    <div className={`template-art art-${template.id}`} style={{ '--card-accent': template.accent, '--pill-text': pillColor } as React.CSSProperties}>
      <TemplatePreview id={template.id} thirdLine={thirdLine}/>
      {selected && <span className="template-tick"><Check size={12}/></span>}
    </div>
    <div className="template-label"><span>{template.name}</span><small>{template.tag.split(' · ')[1]}</small></div>
  </button>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close(); }, []);
  const titleId = `modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-inner"><div className="modal-head"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</div>
  </dialog>;
}

const SAMPLE_ITEMS = [
  {
    title: 'Mountain Ascent',
    duration: '0:12',
    thumbnail: '/samples/sample-1.jpg',
  },
  {
    title: 'Personal Story',
    duration: '0:28',
    thumbnail: '/samples/sample-2.jpg',
  },
  {
    title: 'City Skyline',
    duration: '0:15',
    thumbnail: '/samples/sample-3.jpg',
  },
];

type NavPanelId = 'caption' | 'media' | 'text' | 'style' | 'audio' | 'settings';

const NAV_PANELS: { id: NavPanelId; label: string; icon: React.ReactNode }[] = [
  { id: 'caption', label: 'Caption', icon: <Captions size={20} strokeWidth={1.75} /> },
  { id: 'media', label: 'Media', icon: <Camera size={20} strokeWidth={1.75} /> },
  { id: 'text', label: 'Text', icon: <Type size={20} strokeWidth={1.75} /> },
  { id: 'style', label: 'Style', icon: <Clock size={20} strokeWidth={1.75} /> },
  { id: 'audio', label: 'Audio', icon: <Music size={20} strokeWidth={1.75} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} strokeWidth={1.75} /> },
];

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('bol_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

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
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('bol_theme');
      if (!saved) {
        const nextTheme = e.matches ? 'dark' : 'light';
        setTheme(nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
        if (nextTheme === 'dark') {
          document.documentElement.classList.add('theme-dark');
        } else {
          document.documentElement.classList.remove('theme-dark');
        }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', nextTheme === 'dark' ? '#111215' : '#ffffff');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
  const [script, setScript] = useState('roman');
  const [language, setLanguage] = useState('auto');
  const [activeNavPanel, setActiveNavPanel] = useState<NavPanelId>('caption');
  const [rightTab, setRightTab] = useState('templates');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<'all' | 'minimal' | 'bold' | 'kinetic' | 'editorial' | 'fun'>('all');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [draggingWordIds, setDraggingWordIds] = useState<string[]>([]);
  const lastSelectedWordIdRef = useRef<string | null>(null);
  const [wordMenu, setWordMenu] = useState<{ word: Word; position: { top: number; left: number } } | null>(null);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [captionToolsOpen, setCaptionToolsOpen] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchFindText, setSearchFindText] = useState('');
  const [searchReplaceText, setSearchReplaceText] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'export' | 'projects' | 'help' | 'search-replace' | null>(null);
  const [exportMode, setExportMode] = useState<'burned' | 'green'>('burned');
  const [resolution, setResolution] = useState<720 | 1080 | 2160>(720);
  const [exportFps, setExportFps] = useState<24 | 25 | 30 | 50 | 60>(30);
  const [activeExportId, setActiveExportId] = useState<string | null>(null);
  const [lastDownloadedExportId, setLastDownloadedExportId] = useState<string | null>(null);
  const downloadedExportIdsRef = useRef<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  // What this deployment will render. Null means no limit, which is the local
  // default; a hosted instance caps it so a long clip fails now rather than an
  // hour into a render that its shared CPU was never going to finish.
  const [maxExportSeconds, setMaxExportSeconds] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState(import.meta.env.DEV ? 'Saved locally' : 'Saved to cloud');
  const [dirty, setDirty] = useState(0);
  const [history, setHistory] = useState<EditState[]>([]);
  const [future, setFuture] = useState<EditState[]>([]);
  const [projectAssets, setProjectAssets] = useState<MediaAsset[]>([]);
  const [activeMediaAsset, setActiveMediaAsset] = useState<MediaAsset | null>(null);
  const [canvasElements, setCanvasElements] = useState<CanvasVisualElement[]>([]);
  const [selectedCanvasElementId, setSelectedCanvasElementId] = useState<string | null>(null);
  const [greenScreenTargetEl, setGreenScreenTargetEl] = useState<CanvasVisualElement | null>(null);
  const [textElements, setTextElements] = useState<CanvasTextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isEditingCanvasTextId, setIsEditingCanvasTextId] = useState<string | null>(null);
  const [copiedTextStyle, setCopiedTextStyle] = useState<Partial<CanvasTextElement> | null>(null);
  const [snapGuideX, setSnapGuideX] = useState(false);
  const [snapGuideY, setSnapGuideY] = useState(false);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const handleSelectMediaForCanvas = useCallback((asset: MediaAsset) => {
    if (asset.id === 'primary') {
      setActiveMediaAsset(null);
      setVideoEnabled(true);
    } else {
      setActiveMediaAsset(asset);
      if (asset.mediaType === 'video') setVideoEnabled(true);
    }
  }, []);

  const handleUpdateProjectAssets = useCallback((newAssets: MediaAsset[]) => {
    setProjectAssets(newAssets);
    if (activeMediaAsset) {
      const updated = newAssets.find(a => a.id === activeMediaAsset.id);
      if (updated) setActiveMediaAsset(updated);
    }
  }, [activeMediaAsset]);

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
  const groups = useMemo(() => groupWords(words, isSingleWordTemplate(settings.template) ? 1 : settings.wordsPerLine), [words, settings.wordsPerLine, settings.template, isSingleWordTemplate]);
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g => g.some(w => w.text.toLowerCase().includes(q)));
  }, [groups, searchQuery]);
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const q = templateSearch.trim().toLowerCase();
      const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (templateCategory === 'all') return true;
      if (templateCategory === 'minimal') return t.id === 'soft-focus' || t.id === 'editorial' || t.id === 'karaoke';
      if (templateCategory === 'bold') return t.id === 'welcome-stack' || t.id === 'double-trouble' || t.id === 'editing-school' || t.id === 'mumbai';
      if (templateCategory === 'kinetic') return t.id === 'kinetic' || t.id === 'bounce' || t.id === 'pop-up' || t.id.startsWith('mogrt-');
      if (templateCategory === 'editorial') return t.id === 'editorial' || t.id === 'soft-focus' || t.id === 'kalakar-shadow';
      if (templateCategory === 'fun') return t.id === 'scribble' || t.id === 'bubble-highlight' || t.id === 'neon' || t.id === 'glow-script';
      return true;
    });
  }, [templateSearch, templateCategory]);
  // Only stacked lockups have a third line to colour.
  const isStackedTemplate = treatmentFor(settings.template).layout === 'stack';
  const size = dimensions(settings, project?.width || 720, project?.height || 1280);
  const overExportLimit = !!maxExportSeconds && duration > maxExportSeconds;
  const busy = !!project && ['queued','processing','transcribing','extracting'].includes(project.status);
  const hasVideoLayer = project?.mediaType === 'video';
  const videoEnabled = hasVideoLayer && project?.videoEnabled !== false;
  const selected = project?.words.find(w => w.id === selectedWord);
  const activeWord = words.find(w => time >= w.start && time < w.end);
  const latestExport = project?.exports?.at(-1);
  const hasExportRunning = project?.exports?.some(e => ['queued','processing','rendering'].includes(e.status));
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
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

    const ticks: { time: number; label: string; isMajor: boolean }[] = [];
    const count = Math.ceil(duration / majorInterval);
    for (let i = 0; i <= count; i++) {
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
  }, [duration, timelineZoom]);

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
    const onMouseMove = (e: MouseEvent) => {
      if (!timelineTrackRef.current || !duration) return;
      const rect = timelineTrackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      seek(pct * duration);
    };
    const onMouseUp = () => setIsScrubbing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
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

  // Disable browser website zoom globally (trackpad pinch, Ctrl/Cmd+wheel, Cmd+plus/minus)
  useEffect(() => {
    const onGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const onGlobalGesture = (e: Event) => {
      e.preventDefault();
    };

    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault();
          setTimelineZoom(z => Math.min(32, Number((z * 1.35).toFixed(2))));
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          setTimelineZoom(z => Math.max(1, Number((z / 1.35).toFixed(2))));
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          setTimelineZoom(1);
        }
      }
    };

    window.addEventListener('wheel', onGlobalWheel, { passive: false });
    window.addEventListener('gesturestart', onGlobalGesture, { passive: false });
    window.addEventListener('gesturechange', onGlobalGesture, { passive: false });
    window.addEventListener('gestureend', onGlobalGesture, { passive: false });
    window.addEventListener('keydown', onGlobalKeyDown);

    return () => {
      window.removeEventListener('wheel', onGlobalWheel);
      window.removeEventListener('gesturestart', onGlobalGesture);
      window.removeEventListener('gesturechange', onGlobalGesture);
      window.removeEventListener('gestureend', onGlobalGesture);
      window.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, []);

  useEffect(() => () => { if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current); }, []);

  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => {
    void request<{ maxExportSeconds: number | null }>('/limits')
      .then(l => setMaxExportSeconds(l.maxExportSeconds ?? null))
      .catch(() => setMaxExportSeconds(null));
  }, []);
  useEffect(() => {
    let closed = false;
    async function check() {
      try {
        const [h, list] = await Promise.all([request<Health>('/health'), request<Project[]>('/projects')]);
        if (!closed) { setHealth(h); setProjects(Array.isArray(list) ? list : []); }
      } catch { if (!closed) setHealth(null); }
    }
    void check(); const timer = setInterval(check, 7000); return () => { closed = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!project || (!busy && !hasExportRunning)) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const current = await request<Project>(`/projects/${project.id}`);
        if (cancelled) return;
        if (busy) { setProject(current); projectRef.current = current; if (current.status === 'ready') { setSettings(current.settings); notify(`${current.words.length} words, ready for your finishing touch.`); } }
        else setProject(p => p?.id === current.id ? { ...p, exports: current.exports, revision: current.revision } : p);
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
      const downloadUrl = mediaUrl(`/api/projects/${project.id}/exports/${job.id}/download`);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = job.filename || `${project.name || 'export'}-${job.mode}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify('Export complete! Your video download has started.');
    } else if (job.status === 'error') {
      setActiveExportId(null);
      notify(job.message || 'Export failed. Please check the logs.');
    }
  }, [project?.id, project?.exports, activeExportId, notify]);

  const flushSave = useCallback(() => {
    const action = saveChain.current.catch(() => {}).then(async () => {
      const p = projectRef.current; const generation = dirtyRef.current;
      if (!p || generation <= savedDirty.current) return;
      setSaveStatus('Saving…');
      try {
        const result = await request<Project>(`/projects/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            words: p.words,
            settings: p.settings,
            name: p.name,
            videoEnabled: p.videoEnabled,
            textElements: p.textElements,
            canvasElements: p.canvasElements,
          }),
        });
        if (projectRef.current?.id === p.id) {
          savedDirty.current = generation;
          setSaveStatus(import.meta.env.DEV ? 'Saved locally' : 'Saved to cloud');
          setProject(previous => previous?.id === p.id ? { ...previous, revision: result.revision } : previous);
        }
      } catch (e) { setSaveStatus(UNSAVED); notify((e as Error).message); throw e; }
    });
    saveChain.current = action; return action;
  }, [notify]);
  useEffect(() => { if (dirty <= savedDirty.current) return; const timer = setTimeout(() => void flushSave().catch(() => {}), 650); return () => clearTimeout(timer); }, [dirty, flushSave]);
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirtyRef.current > savedDirty.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload',handler); return () => window.removeEventListener('beforeunload',handler); }, []);

  function markEdit(next: Project, record = true) {
    const previous = projectRef.current;
    if (record && previous) {
      setHistory(h => [...h.slice(-39), {
        words: previous.words,
        settings: previous.settings,
        name: previous.name,
        videoEnabled: previous.videoEnabled,
        textElements: previous.textElements,
        canvasElements: previous.canvasElements,
      }]);
      setFuture([]);
    }
    projectRef.current = next;
    setProject(next);
    setSettings(next.settings);
    if (next.textElements !== undefined) {
      setTextElements(next.textElements);
    }
    if (next.canvasElements !== undefined) {
      setCanvasElements(next.canvasElements);
    }
    setSaveStatus('Saving…');
    dirtyRef.current += 1;
    setDirty(dirtyRef.current);
  }
  function updateSettings(update: Partial<Settings>) {
    const next = { ...settings, ...update }; setSettings(next);
    if (projectRef.current && !busy) markEdit({ ...projectRef.current, settings: next });
  }

  const handleAddText = useCallback((type: CanvasTextType) => {
    const curTime = time || 0;
    const totalDuration = duration || projectRef.current?.duration || 10;
    const newEl = createDefaultTextElement(type, curTime, totalDuration);
    const nextList = [...(projectRef.current?.textElements || textElements), newEl];
    setTextElements(nextList);
    setSelectedTextId(newEl.id);
    setActiveNavPanel('text');
    if (projectRef.current && !busy) {
      markEdit({ ...projectRef.current, textElements: nextList });
    }
    notify(`Added ${type} to canvas`);
  }, [time, duration, textElements, busy, notify]);

  const handleUpdateText = useCallback((id: string, update: Partial<CanvasTextElement>) => {
    setTextElements(prev => {
      const nextList = prev.map(el => el.id === id ? { ...el, ...update } : el);
      if (projectRef.current && !busy) {
        markEdit({ ...projectRef.current, textElements: nextList });
      }
      return nextList;
    });
  }, [busy]);

  const handleDeleteText = useCallback((id: string) => {
    setTextElements(prev => {
      const nextList = prev.filter(el => el.id !== id);
      if (selectedTextId === id) setSelectedTextId(null);
      if (isEditingCanvasTextId === id) setIsEditingCanvasTextId(null);
      if (projectRef.current && !busy) {
        markEdit({ ...projectRef.current, textElements: nextList });
      }
      return nextList;
    });
    notify('Removed text element');
  }, [selectedTextId, isEditingCanvasTextId, busy, notify]);

  const handleDuplicateText = useCallback((id: string) => {
    const currentList = projectRef.current?.textElements || textElements;
    const el = currentList.find(t => t.id === id);
    if (!el) return;
    const totalDuration = duration || projectRef.current?.duration || 10;
    const newEl: CanvasTextElement = {
      ...el,
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: Math.min(90, el.x + 3),
      y: Math.min(90, el.y + 3),
      start: el.start + 0.5,
      end: Math.min(totalDuration, el.end + 0.5),
      zIndex: Date.now(),
    };
    const nextList = [...currentList, newEl];
    setTextElements(nextList);
    setSelectedTextId(newEl.id);
    if (projectRef.current && !busy) {
      markEdit({ ...projectRef.current, textElements: nextList });
    }
    notify('Duplicated text element');
  }, [textElements, duration, busy, notify]);

  const handleReorderText = useCallback((id: string, direction: 'forward' | 'backward' | 'front' | 'back') => {
    setTextElements(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const nextList = [...prev];
      const [item] = nextList.splice(idx, 1);
      if (direction === 'forward') {
        nextList.splice(Math.min(nextList.length, idx + 1), 0, item);
      } else if (direction === 'backward') {
        nextList.splice(Math.max(0, idx - 1), 0, item);
      } else if (direction === 'front') {
        nextList.push(item);
      } else if (direction === 'back') {
        nextList.unshift(item);
      }
      const updated = nextList.map((t, i) => ({ ...t, zIndex: 100 + i }));
      if (projectRef.current && !busy) {
        markEdit({ ...projectRef.current, textElements: updated });
      }
      return updated;
    });
  }, [busy]);

  const handleCopyStyle = useCallback((element: CanvasTextElement) => {
    setCopiedTextStyle({
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      textDecoration: element.textDecoration,
      color: element.color,
      backgroundColor: element.backgroundColor,
      backgroundOpacity: element.backgroundOpacity,
      strokeColor: element.strokeColor,
      strokeWidth: element.strokeWidth,
      shadowEnabled: element.shadowEnabled,
      shadowColor: element.shadowColor,
      shadowBlur: element.shadowBlur,
      shadowX: element.shadowX,
      shadowY: element.shadowY,
      opacity: element.opacity,
      lineHeight: element.lineHeight,
      letterSpacing: element.letterSpacing,
      wordSpacing: element.wordSpacing,
      textCase: element.textCase,
      animationIn: element.animationIn,
      animationOut: element.animationOut,
      animationDuration: element.animationDuration,
    });
    notify('Copied text style to clipboard');
  }, [notify]);

  const handlePasteStyle = useCallback((targetId: string) => {
    if (!copiedTextStyle) return;
    handleUpdateText(targetId, copiedTextStyle);
    notify('Applied copied style');
  }, [copiedTextStyle, handleUpdateText, notify]);

  const handleStartDragText = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = textElements.find(t => t.id === id);
    if (!el || el.locked) return;

    setSelectedTextId(id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const frameRect = preview.current?.getBoundingClientRect();
    if (!frameRect) return;

    let currentX = origX;
    let currentY = origY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
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

      setTextElements(prev => prev.map(item => item.id === id ? { ...item, x: newX, y: newY } : item));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setSnapGuideX(false);
      setSnapGuideY(false);
      handleUpdateText(id, { x: currentX, y: currentY });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [textElements, handleUpdateText]);

  const handleStartResizeText = useCallback((e: React.MouseEvent, id: string, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = textElements.find(t => t.id === id);
    if (!el || el.locked) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origFontSize = el.fontSize;
    let currentFontSize = origFontSize;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const delta = (handle.includes('e') || handle.includes('s')) ? (dx + dy) : (-dx - dy);
      const newFontSize = Math.max(12, Math.min(160, Math.round(origFontSize + delta * 0.4)));
      currentFontSize = newFontSize;
      setTextElements(prev => prev.map(item => item.id === id ? { ...item, fontSize: newFontSize } : item));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      handleUpdateText(id, { fontSize: currentFontSize });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [textElements, handleUpdateText]);

  const handleStartDragTimelineText = useCallback((e: React.MouseEvent, id: string, mode: 'move' | 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    const el = textElements.find(t => t.id === id);
    const totalDuration = duration || projectRef.current?.duration;
    if (!el || !totalDuration) return;

    setSelectedTextId(id);
    const startClientX = e.clientX;
    const origStart = el.start;
    const origEnd = el.end;
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

      setTextElements(prev => prev.map(item => item.id === id ? { ...item, start: finalStart, end: finalEnd } : item));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      handleUpdateText(id, { start: finalStart, end: finalEnd });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [textElements, duration, handleUpdateText]);

  const handleUpdateCanvasElement = useCallback((id: string, updates: Partial<CanvasVisualElement>) => {
    setCanvasElements(prev => {
      const next = prev.map(item => item.id === id ? { ...item, ...updates } : item);
      if (projectRef.current && !busy) {
        markEdit({ ...projectRef.current, canvasElements: next });
      }
      return next;
    });
  }, [busy]);

  const handleDeleteCanvasElement = useCallback((id: string) => {
    setCanvasElements(prev => {
      const next = prev.filter(item => item.id !== id);
      if (projectRef.current && !busy) {
        markEdit({ ...projectRef.current, canvasElements: next });
      }
      return next;
    });
    setSelectedCanvasElementId(prev => (prev === id ? null : prev));
  }, [busy]);

  const handleAddMediaToCanvas = useCallback((asset: MediaAsset) => {
    const url = asset.url || `/api/projects/${projectRef.current?.id}/assets/${asset.id}/file`;
    const fullUrl = mediaUrl(url);
    const totalDuration = projectRef.current?.duration || duration || 5;

    if (asset.mediaType === 'image') {
      if (!imageCacheRef.current.has(fullUrl)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = fullUrl;
        imageCacheRef.current.set(fullUrl, img);
      }
    } else if (asset.mediaType === 'video') {
      if (!videoCacheRef.current.has(fullUrl)) {
        const vid = document.createElement('video');
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.src = fullUrl;
        videoCacheRef.current.set(fullUrl, vid);
      }
    }

    const newEl: CanvasVisualElement = {
      id: `canvas-${asset.mediaType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      assetId: asset.id,
      name: asset.name,
      type: asset.mediaType === 'video' ? 'video' : 'image',
      url: fullUrl,
      x: 50,
      y: 50,
      scale: 1.0,
      start: 0,
      end: totalDuration,
      visible: true,
      locked: false,
      greenScreen: asset.greenScreen,
    };

    setCanvasElements(prev => {
      const updated = [...prev, newEl];
      if (projectRef.current && !busy) {
        markEdit({ ...projectRef.current, canvasElements: updated });
      }
      return updated;
    });
    setSelectedCanvasElementId(newEl.id);
    setSelectedTextId(null);
  }, [duration, busy]);

  const handleStartDragCanvasElement = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = canvasElements.find(item => item.id === id);
    if (!el || el.locked) return;

    setSelectedCanvasElementId(id);
    setSelectedTextId(null);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const frameRect = preview.current?.getBoundingClientRect();
    if (!frameRect) return;

    let currentX = origX;
    let currentY = origY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
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
    };

    const onMouseUp = () => {
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

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const delta = (handle.includes('e') || handle.includes('s')) ? (dx + dy) : (-dx - dy);
      const newScale = Math.max(0.15, Math.min(3.5, Number((origScale + delta * 0.005).toFixed(2))));
      currentScale = newScale;
      setCanvasElements(prev => prev.map(item => item.id === id ? { ...item, scale: newScale } : item));
    };

    const onMouseUp = () => {
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
    setSelectedTextId(null);
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

  function loadSample(idx: number) {
    if (projects.length > idx) {
      void openProject(projects[idx]);
    } else if (projects.length > 0) {
      void openProject(projects[0]);
    } else {
      notify('Sample media ready.');
    }
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
    const oldGroupIds = new Set(oldGroup.map(w => w.id));
    const rawTokens = newText.trim().split(/\s+/).filter(Boolean);
    const tokens = rawTokens.length > 0 ? rawTokens : ['caption'];

    const durationPerWord = Math.max(0.04, (newEnd - newStart) / tokens.length);
    const newWordsForGroup: Word[] = tokens.map((token, i) => {
      const existing = oldGroup[i];
      const wordStart = Number((newStart + i * durationPerWord).toFixed(3));
      const wordEnd = Number((newStart + (i + 1) * durationPerWord - 0.005).toFixed(3));
      return {
        id: existing?.id || `w-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        text: token,
        original: token,
        start: wordStart,
        end: Math.max(wordStart + 0.03, wordEnd),
        confidence: existing?.confidence ?? 1,
        emphasis: existing?.emphasis ?? false,
        emphasisScore: existing?.emphasisScore ?? 0.5,
        spotlight: existing?.spotlight,
        behind: existing?.behind,
      };
    });

    const prefix = p.words.filter(w => !oldGroupIds.has(w.id) && w.end <= newStart);
    const suffix = p.words.filter(w => !oldGroupIds.has(w.id) && w.start >= newEnd);
    const updatedWords = [...prefix, ...newWordsForGroup, ...suffix];
    updatedWords.sort((a, b) => a.start - b.start);
    ensureValidIntervals(updatedWords, p.duration || 60);

    markEdit({ ...p, words: updatedWords }, true);
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

    const newWord: Word = {
      id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: 'New caption',
      original: 'New caption',
      start: startTime,
      end: Math.max(startTime + 0.3, endTime),
      confidence: 1,
      emphasis: false,
      emphasisScore: 0.5,
    };

    const updatedWords = [...p.words, newWord];
    updatedWords.sort((a, b) => a.start - b.start);
    ensureValidIntervals(updatedWords, dur);

    markEdit({ ...p, words: updatedWords }, true);
    setSelectedWord(newWord.id);
    setSelectedWordIds(new Set([newWord.id]));
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

    const updatedWords = moveWordsToLine(p.words, validMovingIds, targetGroupIdx, targetPosition, neededMax);

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
  function handleAutoStar() {
    const p = projectRef.current; if (!p) return;
    const updated = autoDetectHighlights(p.words, settings.wordsPerLine);
    markEdit({ ...p, words: updated });
    notify('Suggested highlights applied.');
  }
  function handleClearAllEmphasis() {
    const p = projectRef.current; if (!p) return;
    markEdit({ ...p, words: p.words.map(w => ({ ...w, emphasis: false, spotlight: false })) });
    notify('All highlights cleared.');
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

    if (!selectedWordIds.has(word.id)) {
      setSelectedWordIds(new Set([word.id]));
      setSelectedWord(word.id);
      lastSelectedWordIdRef.current = word.id;
    }

    const menuWidth = 280;
    const menuHeight = 440;
    let top = e.clientY + 4;
    let left = e.clientX;

    if (top + menuHeight > window.innerHeight - 10) {
      top = Math.max(10, e.clientY - menuHeight - 4);
    }
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - menuWidth - 10);
    }

    setWordMenu({
      word,
      position: { top, left },
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
  function calculatePopoverPosition(rect: DOMRect): React.CSSProperties {
    const width = 280;
    const height = 180;
    let top = rect.top - height - 12;
    if (top < 10) top = rect.bottom + 12;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(window.innerWidth - width - 12, left));
    return { top: `${top}px`, left: `${left}px`, width: `${width}px` };
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
      markEdit({ ...latestProj, words: finalWords }, true);
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

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
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
    };

    const onMouseUp = () => {
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
      markEdit({ ...latestProj, words: finalWords }, true);
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
      markEdit({ ...latestProj, words: finalWords }, true);
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
      markEdit({ ...latestProj, words: finalWords }, true);
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
      markEdit({ ...latestProj, words: finalWords }, true);
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
      void media.current.play().catch(() => {});
      setPlaying(true);
      const dur = Math.max(0.1, (end - start) * 1000);
      pauseTimerRef.current = setTimeout(() => {
        media.current?.pause();
        setPlaying(false);
      }, dur + 60);
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
    const p = projectRef.current; const previous = history.at(-1); if (!p || !previous) return;
    setFuture(f => [...f,{ words:p.words,settings:p.settings,name:p.name,videoEnabled:p.videoEnabled,textElements:p.textElements,canvasElements:p.canvasElements }]); setHistory(h => h.slice(0,-1)); markEdit({ ...p,...previous },false);
  }
  function redo() {
    const p = projectRef.current; const next = future.at(-1); if (!p || !next) return;
    setHistory(h => [...h,{ words:p.words,settings:p.settings,name:p.name,videoEnabled:p.videoEnabled,textElements:p.textElements,canvasElements:p.canvasElements }]); setFuture(f => f.slice(0,-1)); markEdit({ ...p,...next },false);
  }
  function seek(value: number) { if (!project) return; const t = Math.max(0,Math.min(duration,value)); setTime(t); if (media.current) media.current.currentTime=t; }
  const togglePlay = useCallback(() => {
    if (!project || !media.current) return;
    if (playing) media.current.pause();
    else { if (media.current.currentTime >= duration-.02) media.current.currentTime=0; void media.current.play().catch(() => notify('This media could not play. Try re-uploading as MP4 or WAV.')); }
  }, [project, playing, duration, notify]);
  useEffect(() => {
    if (!playing || !project) return;
    let frame = 0;
    const tick = () => { if (media.current) setTime(media.current.currentTime); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, project]);
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

    // 1. If active media has greenScreen enabled, render keyed video frame
    if (activeMediaAsset?.greenScreen?.enabled && media.current && hasVideoLayer && videoEnabled) {
      drawKeyedMedia(ctx, media.current, 0, 0, size.width, size.height, activeMediaAsset.greenScreen);
    }

    // 2. Draw canvas overlay image & video elements
    for (const el of canvasElements) {
      if (el.visible === false) continue;
      if (el.start !== undefined && time < el.start) continue;
      if (el.end !== undefined && time > el.end) continue;

      if (el.type === 'video') {
        let vid = videoCacheRef.current.get(el.url);
        if (!vid) {
          vid = document.createElement('video');
          vid.crossOrigin = 'anonymous';
          vid.muted = true;
          vid.playsInline = true;
          vid.preload = 'auto';
          vid.src = el.url;
          videoCacheRef.current.set(el.url, vid);
        }
        if (vid.readyState >= 2) {
          const elW = (size.width * 0.32) * (el.scale || 1.0);
          const elH = (vid.videoHeight / (vid.videoWidth || 1)) * elW;
          const elX = (el.x / 100) * size.width - elW / 2;
          const elY = (el.y / 100) * size.height - elH / 2;
          const elementTime = Math.max(0, time - (el.start || 0));
          if (Math.abs(vid.currentTime - (elementTime % (vid.duration || 1))) > 0.1) {
            vid.currentTime = elementTime % (vid.duration || 1);
          }
          drawKeyedMedia(ctx, vid, elX, elY, elW, elH, el.greenScreen);
        }
      } else {
        let img = imageCacheRef.current.get(el.url);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = el.url;
          img.onload = () => {
            const c = canvas.current?.getContext('2d');
            if (c && projectRef.current && textElements.length > 0) {
              drawTextElements(c, size.width, size.height, textElements, time);
            }
          };
          imageCacheRef.current.set(el.url, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          const elW = (size.width * 0.32) * (el.scale || 1.0);
          const elH = (img.naturalHeight / (img.naturalWidth || 1)) * elW;
          const elX = (el.x / 100) * size.width - elW / 2;
          const elY = (el.y / 100) * size.height - elH / 2;
          drawKeyedMedia(ctx, img, elX, elY, elW, elH, el.greenScreen);
        }
      }
    }

    // 3. Captions are no longer drawn here. They render above this canvas in a
    // Remotion <Player> using the exact composition the exporter renders, so the
    // preview cannot drift from the finished file.

    // 4. Draw visual text elements on top
    if (textElements.length > 0) {
      drawTextElements(ctx, size.width, size.height, textElements, time);
    }
  }, [project, words, settings, time, size.width, size.height, groups, activeMediaAsset, canvasElements, selectedCanvasElementId, hasVideoLayer, videoEnabled, textElements]);

  useEffect(() => {
    void document.fonts.ready.then(() => {
      const ctx = canvas.current?.getContext('2d');
      if (ctx && project) {
        if (textElements.length > 0) {
          drawTextElements(ctx, size.width, size.height, textElements, time);
        }
      }
    });
  }, [project, words, settings, time, groups, size.width, size.height, textElements]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingCanvasTextId) { setIsEditingCanvasTextId(null); return; }
        if (timelinePopover) { setTimelinePopover(null); return; }
        if (wordMenu) { setWordMenu(null); return; }
        if (captionToolsOpen) { setCaptionToolsOpen(false); return; }
        if (editingWordId) { setEditingWordId(null); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); void flushSave().catch(()=>{}); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); handleSplitAtCurrent(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedTextId) {
        e.preventDefault();
        handleDuplicateText(selectedTextId);
        return;
      }
      if ((e.target as HTMLElement)?.closest('input, textarea, select, dialog, button, a, [contenteditable]')) return;
      if (selectedTextId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handleDeleteText(selectedTextId);
        return;
      }
      if (selectedCanvasElementId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handleDeleteCanvasElement(selectedCanvasElementId);
        return;
      }
      if (selectedCanvasElementId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        setCanvasElements(prev => {
          const el = prev.find(t => t.id === selectedCanvasElementId);
          if (!el || el.locked) return prev;
          let nx = el.x;
          let ny = el.y;
          if (e.key === 'ArrowLeft') nx = Math.max(0, nx - step);
          if (e.key === 'ArrowRight') nx = Math.min(100, nx + step);
          if (e.key === 'ArrowUp') ny = Math.max(0, ny - step);
          if (e.key === 'ArrowDown') ny = Math.min(100, ny + step);
          const updated = prev.map(t => t.id === selectedCanvasElementId ? { ...t, x: nx, y: ny } : t);
          if (projectRef.current && !busy) markEdit({ ...projectRef.current, canvasElements: updated });
          return updated;
        });
        return;
      }
      if (selectedTextId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        setTextElements(prev => {
          const el = prev.find(t => t.id === selectedTextId);
          if (!el || el.locked) return prev;
          let nx = el.x;
          let ny = el.y;
          if (e.key === 'ArrowLeft') nx = Math.max(0, nx - step);
          if (e.key === 'ArrowRight') nx = Math.min(100, nx + step);
          if (e.key === 'ArrowUp') ny = Math.max(0, ny - step);
          if (e.key === 'ArrowDown') ny = Math.min(100, ny + step);
          const updated = prev.map(t => t.id === selectedTextId ? { ...t, x: nx, y: ny } : t);
          if (projectRef.current && !busy) markEdit({ ...projectRef.current, textElements: updated });
          return updated;
        });
        return;
      }
      if (selectedWord && !selectedCanvasElementId && !selectedTextId) {
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
      if (e.key === 'ArrowUp') { e.preventDefault(); setTimelineZoom(z => Math.min(32, Number((z * 1.35).toFixed(2)))); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setTimelineZoom(z => Math.max(1, Number((z / 1.35).toFixed(2)))); return; }
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown',onKey); return () => window.removeEventListener('keydown',onKey);
  },[togglePlay,flushSave,timelinePopover,wordMenu,captionToolsOpen,editingWordId,selectedWord,time,project,selectedTextId,selectedCanvasElementId,isEditingCanvasTextId,handleDuplicateText,handleDeleteText,handleDeleteCanvasElement,busy]);

  async function importFile(file?: File) {
    if (!file || uploadProgress !== null) return;
    if (file.size > 1024*1024*1024) { notify('Choose a file smaller than 1 GB.'); return; }
    setUploadProgress(0); setPlaying(false); media.current?.pause();
    try {
      await flushSave();
      const result = await upload(file,script,language,setUploadProgress);
      result.name = file.name || result.filename || result.name;
      result.settings = result.settings || defaults;
      result.words = autoDetectHighlights(result.words || [], result.settings?.wordsPerLine || 4);
      setProject(result); projectRef.current=result; setSettings(result.settings); setTime(0); setSelectedWord(null); setSelectedWordIds(new Set()); setHistory([]); setFuture([]); setShowSearchBar(false); setCaptionToolsOpen(false); setSaveStatus('Saved locally');
      setTextElements(result.textElements || []); setSelectedTextId(null); setIsEditingCanvasTextId(null);
      setProjects(list=>[result,...list.filter(p=>p.id!==result.id)]);
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
      const wordsPerLine = result.settings?.wordsPerLine || 4;
      const hasSpotlight = (result.words || []).some(w => w.spotlight);
      const normalizedWords = hasSpotlight ? (result.words || []) : autoDetectHighlights(result.words || [], wordsPerLine);
      const normalized = { ...result, words: normalizedWords, script: projectScript, language: projectLanguage };
      setPlaying(false); setTime(0); setProject(normalized); projectRef.current=normalized; setSettings(normalized.settings); setScript(projectScript); setLanguage(projectLanguage); setSelectedWord(null); setSelectedWordIds(new Set()); setHistory([]); setFuture([]); setShowSearchBar(false); setCaptionToolsOpen(false); setModal(null);
      setActiveMediaAsset(null); setCanvasElements(result.canvasElements || []); setSelectedCanvasElementId(null);
      setTextElements(result.textElements || []); setSelectedTextId(null); setIsEditingCanvasTextId(null);
    }
    catch(e) { notify((e as Error).message); }
  }
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
  function downloadTranscript(format: 'srt' | 'vtt' | 'json') {
    if(!project) return;
    const text=format==='json'?JSON.stringify({name:project.name,words:project.words,settings},null,2):subtitleText(project.words,settings.wordsPerLine,format);
    const blob=new Blob([text],{type:format==='json'?'application/json':'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${project.name.replace(/[^\p{L}\p{N}_-]/gu,'_')}.${format}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function retryTranscription() {
    if(!project) return;
    const currentProject = project;
    try { await flushSave(); const result=await request<Project>(`/projects/${currentProject.id}/transcribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({script:currentProject.script,language:currentProject.language,glossary:currentProject.glossary ?? [],isolateVocals:!!currentProject.isolateVocals})}); if (projectRef.current?.id === currentProject.id) { setProject(result); projectRef.current=result; setScript(result.script); setLanguage(result.language); } }
    catch(e){notify((e as Error).message);}
  }

  return <div className="app-shell">
    <input ref={input} type="file" accept="video/*,audio/*,.mkv,.m4a,.wav,.mp3,.webm" hidden onChange={e=>void importFile(e.target.files?.[0])}/>

    <header className="studio-navbar">
      <div className="navbar-left">
        <button className="navbar-brand" onClick={() => setModal('projects')} title="Projects workspace" aria-label="Bol Studio - Projects workspace">
          <img src="/bol.studio.svg" alt="bol.studio" className="navbar-brand-logo logo-light-only" />
          <img src="/bol.studio-white.svg" alt="bol.studio" className="navbar-brand-logo logo-dark-only" />
        </button>
        {project && (
          <>
            <div className="nav-divider" />
            <div className="navbar-project">
              <input
                aria-label="Project name"
                className="navbar-project-input"
                value={project.name || project.filename}
                readOnly={busy}
                onChange={e => markEdit({ ...project, name: e.target.value })}
                maxLength={120}
              />
              {/* The dot used to track backend health only, so a failed save
                  showed "Unsaved changes" next to a reassuring green dot. It is
                  the most glanceable part of the badge, so it reflects both. */}
              <span className="navbar-save-badge">
                <span className={`status-dot ${!health ? 'offline' : saveStatus === UNSAVED ? 'unsaved' : ''}`} />
                <span className="save-text">{saveStatus}</span>
              </span>
            </div>
          </>
        )}
      </div>

      <div className="navbar-center" />

      <div className="navbar-right">
        <div className="nav-btn-group">
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo (Cmd+Z)"
            disabled={!history.length || busy}
            onClick={undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo (Cmd+Shift+Z)"
            disabled={!future.length || busy}
            onClick={redo}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="nav-divider" />
        <AnimatedThemeToggler
          theme={theme}
          onThemeChange={setTheme}
          className="theme-toggle-btn"
        />
        <button
          className="nav-btn ghost"
          aria-label="Your projects"
          title="All projects"
          onClick={() => setModal('projects')}
        >
          <FolderOpen size={16} />
          <span>Projects</span>
        </button>
        <button
          className="nav-btn primary"
          onClick={() => setModal('export')}
          disabled={!project?.words.length || busy}
        >
          <Download size={15} />
          <span>Export</span>
          <ChevronDown size={13} />
        </button>
      </div>
    </header>

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
            settings={settings}
            selectedWord={selectedWord}
            selectedWordIds={selectedWordIds}
            duration={duration}
            busy={busy}
            onSelectWord={selectWord}
            onSeek={seek}
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
              await retryTranscription();
            }}
            onCancelTranscription={() => {
              if (projectRef.current) {
                markEdit({ ...projectRef.current, status: 'ready', progress: 100 });
                notify('Transcription cancelled');
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
              setCanvasElements(prev => {
                const updated = prev.filter(el => el.assetId !== assetId);
                if (projectRef.current && !busy) {
                  markEdit({ ...projectRef.current, canvasElements: updated });
                }
                return updated;
              });
            }}
            onUpdateProjectAssets={handleUpdateProjectAssets}
            notify={notify}
            onStartProjectFromUpload={importFile}
          />
        ) : activeNavPanel === 'style' ? (
          <section className="style-panel panel">
            <div className="panel-tabs">
              <button className={rightTab === 'templates' ? 'active' : ''} onClick={() => setRightTab('templates')}>
                Templates
              </button>
              <button className={rightTab === 'customize' ? 'active' : ''} onClick={() => setRightTab('customize')}>
                Caption Settings
              </button>
            </div>

            {rightTab === 'templates' && (
              <>
                <div className="template-search-row">
                  <div className="template-search-input-wrap">
                    <Search size={14} className="template-search-icon" />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={e => setTemplateSearch(e.target.value)}
                      className="template-search-input"
                    />
                    <button type="button" className="template-filter-btn" title="Filter templates">
                      <SlidersHorizontal size={14} />
                    </button>
                  </div>
                </div>

                <div className="template-category-pills">
                  {(['all', 'minimal', 'bold', 'kinetic', 'editorial', 'fun'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`category-pill ${templateCategory === cat ? 'active' : ''}`}
                      onClick={() => setTemplateCategory(cat)}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="style-content">
              {rightTab === 'templates' ? (
                <>
                  <div className="template-grid">
                    {filteredTemplates.map(template => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        selected={settings.template === template.id}
                        disabled={busy}
                        thirdLine={settings.accentSecondary || settings.textColor}
                        onClick={() => {
                          updateSettings({ template: template.id, accent: template.accent });
                        }}
                      />
                    ))}
                  </div>

                  <div className="template-create-scratch-row">
                    <button type="button" className="template-create-scratch-btn" onClick={() => setRightTab('customize')}>
                      <Plus size={15} />
                      <span>Create from scratch</span>
                      <span className="pro-badge">PRO</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="style-intro">
                    <div>
                      <h2>Caption Settings</h2>
                    <p>Typography, layout, animation & colors.</p>
                  </div>
                  <WandSparkles size={23} />
                </div>
                <div className="setting-field">
                  <label htmlFor="caption-font">
                    Font
                    <span>{settings.fontFamily || 'Template default'}</span>
                  </label>
                  <select
                    id="caption-font"
                    className="font-select"
                    disabled={busy}
                    value={settings.fontFamily ?? ''}
                    style={{ fontFamily: settings.fontFamily ? `"${settings.fontFamily}", sans-serif` : undefined }}
                    onChange={e => updateSettings({ fontFamily: e.target.value || undefined })}
                  >
                    <option value="">Template default</option>
                    {captionFonts.map(f => (
                      <option key={f.family} value={f.family}>
                        {f.label}{f.devanagari ? ' · हिन्दी' : ''}
                      </option>
                    ))}
                  </select>
                  {settings.fontFamily && !captionFonts.find(f => f.family === settings.fontFamily)?.devanagari && (
                    <p className="field-hint">
                      No Devanagari in this face — Hindi words fall back to Noto. Pick one marked हिन्दी to keep one font throughout.
                    </p>
                  )}
                  <label htmlFor="caption-size">Font size <span>{settings.fontSize}px</span></label>
                  <div className="slider-row">
                    <button
                      type="button"
                      className="icon-button tiny"
                      title="Decrease font size"
                      onClick={() => updateSettings({ fontSize: Math.max(20, settings.fontSize - 2) })}
                      disabled={busy}
                    >
                      -
                    </button>
                    <input
                      disabled={busy}
                      id="caption-size"
                      type="range"
                      min="24"
                      max="92"
                      value={settings.fontSize}
                      onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                    />
                    <button
                      type="button"
                      className="icon-button tiny"
                      title="Increase font size"
                      onClick={() => updateSettings({ fontSize: Math.min(92, settings.fontSize + 2) })}
                      disabled={busy}
                    >
                      +
                    </button>
                    <span className="slider-number-badge">{settings.fontSize}px</span>
                  </div>
                </div>
                <div className="setting-field">
                  <label htmlFor="caption-position">Vertical Position <span>{settings.position}%</span></label>
                  <input
                    disabled={busy}
                    id="caption-position"
                    type="range"
                    min="15"
                    max="88"
                    value={settings.position}
                    onChange={e => updateSettings({ position: Number(e.target.value) })}
                  />
                </div>
                <div className="setting-field">
                  <label htmlFor="caption-position-x">Horizontal Position <span>{settings.positionX ?? 50}%</span></label>
                  <input
                    disabled={busy}
                    id="caption-position-x"
                    type="range"
                    min="15"
                    max="85"
                    value={settings.positionX ?? 50}
                    onChange={e => updateSettings({ positionX: Number(e.target.value) })}
                  />
                  <div className="position-presets">
                    {[
                      { name: 'Top', x: 50, y: 22 },
                      { name: 'Center', x: 50, y: 50 },
                      { name: 'Left', x: 25, y: 50 },
                      { name: 'Right', x: 75, y: 50 },
                      { name: 'Bottom', x: 50, y: 72 },
                    ].map(p => (
                      <button
                        disabled={busy}
                        key={p.name}
                        type="button"
                        onClick={() => updateSettings({ position: p.y, positionX: p.x })}
                        className={(settings.position === p.y && (settings.positionX ?? 50) === p.x) ? 'active' : ''}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-field">
                  <label htmlFor="words-per-line">Words Per Line (Chunking) <span>{settings.wordsPerLine}</span></label>
                  <div className="slider-row">
                    <input
                      disabled={busy}
                      id="words-per-line"
                      type="range"
                      min="1"
                      max={MAX_WORDS_PER_PAGE}
                      value={settings.wordsPerLine}
                      onChange={e => updateSettings({ wordsPerLine: Number(e.target.value) })}
                    />
                    <span className="slider-number-badge">{settings.wordsPerLine} w</span>
                  </div>
                </div>
                <div className="setting-field">
                  <label htmlFor="motion-strength">Motion Dynamics</label>
                  <div className="segmented-control">
                    {[
                      { label: 'Off', val: 0 },
                      { label: 'Subtle', val: 0.5 },
                      { label: 'Natural', val: 1.0 },
                      { label: 'Extra', val: 1.5 },
                    ].map(m => (
                      <button
                        type="button"
                        key={m.label}
                        disabled={busy}
                        className={settings.motion === m.val ? 'active' : ''}
                        onClick={() => updateSettings({ motion: m.val })}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="toggle-row">
                  <span>ALL CAPS (Capitalize Every Word)</span>
                  <input
                    disabled={busy}
                    type="checkbox"
                    checked={settings.uppercase}
                    onChange={e => updateSettings({ uppercase: e.target.checked })}
                  />
                  <span className="toggle-track" />
                </label>
                {/*
                  Three colours, three roles. These used to be two pickers that
                  both wrote `accent`, while `textColor` had no control at all —
                  which is why captions came out all one shade.
                */}
                <div className="accent-section">
                  <div className="section-label">TEXT COLOR <span>{(settings.textColor || '#ffffff').toUpperCase()}</span></div>
                  <div className="swatches">
                    {['#ffffff', '#f4f4f5', '#bfa4ff', '#72e6ff', '#d4fa41', '#ff8bb5', '#ffd166', '#111318'].map(color => {
                      const isSelected = (settings.textColor || '#ffffff').toLowerCase() === color.toLowerCase();
                      return (
                        <button
                          disabled={busy}
                          key={color}
                          type="button"
                          className={isSelected ? 'selected' : ''}
                          style={{ background: color }}
                          aria-label={`Text color ${color}`}
                          aria-pressed={isSelected}
                          onClick={() => updateSettings({ textColor: color })}
                        >
                          {isSelected && <Check size={16} />}
                        </button>
                      );
                    })}
                    <label className="custom-color" title="Custom text color">
                      <Plus size={17} />
                      <input
                        disabled={busy}
                        aria-label="Custom text color"
                        type="color"
                        value={settings.textColor || '#ffffff'}
                        onChange={e => updateSettings({ textColor: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
                {isStackedTemplate && (
                  <div className="accent-section">
                    <div className="section-label">
                      THIRD LINE <span>{(settings.accentSecondary || 'MATCHES TEXT').toUpperCase()}</span>
                    </div>
                    <div className="swatches">
                      {['#ffd166', '#ff8bb5', '#7ee7c7', '#c9a6ff', '#57c7ff', '#ff825c'].map(color => {
                        const isSelected = (settings.accentSecondary || '').toLowerCase() === color.toLowerCase();
                        return (
                          <button
                            disabled={busy}
                            key={color}
                            type="button"
                            className={isSelected ? 'selected' : ''}
                            style={{ background: color }}
                            aria-label={`Third line color ${color}`}
                            aria-pressed={isSelected}
                            onClick={() => updateSettings({ accentSecondary: color })}
                          >
                            {isSelected && <Check size={16} />}
                          </button>
                        );
                      })}
                      <label className="custom-color" title="Custom third line color">
                        <Plus size={17} />
                        <input
                          disabled={busy}
                          aria-label="Custom third line color"
                          type="color"
                          value={settings.accentSecondary || '#ffd166'}
                          onChange={e => updateSettings({ accentSecondary: e.target.value })}
                        />
                      </label>
                      <button
                        disabled={busy || !settings.accentSecondary}
                        type="button"
                        className="swatch-reset"
                        title="Match the text colour"
                        aria-label="Reset third line to the text colour"
                        onClick={() => updateSettings({ accentSecondary: undefined })}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="accent-section">
                  <div className="section-label">HIGHLIGHT / ACCENT COLOR <span>{settings.accent.toUpperCase()}</span></div>
                  <div className="swatches">
                    {['#d4fa41', '#c2a1ff', '#ff8bb5', '#ff825c', '#72e6ff', '#ffffff', '#10b981', '#f59e0b'].map(color => (
                      <button
                        disabled={busy}
                        key={color}
                        type="button"
                        className={settings.accent === color ? 'selected' : ''}
                        style={{ background: color }}
                        aria-label={`Highlight ${color}`}
                        aria-pressed={settings.accent === color}
                        onClick={() => updateSettings({ accent: color })}
                      >
                        {settings.accent === color && <Check size={16} />}
                      </button>
                    ))}
                    <label className="custom-color" title="Custom highlight color">
                      <Plus size={17} />
                      <input
                        disabled={busy}
                        aria-label="Custom highlight color"
                        type="color"
                        value={settings.accent}
                        onChange={e => updateSettings({ accent: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
                <button
                  disabled={busy}
                  type="button"
                  className="button secondary full"
                  style={{ marginTop: '16px' }}
                  onClick={() => {
                    const tmpl = templates.find(t => t.id === settings.template);
                    updateSettings({
                      ...defaults,
                      template: settings.template,
                      accent: tmpl?.accent ?? defaults.accent,
                      textColor: undefined,
                      accentSecondary: undefined,
                      fontFamily: undefined,
                    });
                    notify('Reset to template defaults.');
                  }}
                >
                  <RotateCcw size={15} /> Reset to Defaults
                </button>
              </>
            )}
            <div className="tip-card">
              <div className="tip-icon"><Star size={17} /></div>
              <strong>Timeline word editor</strong>
              <p>Click any word on the bottom timeline to open its editor, adjust duration dividers, and highlight the keyword each line should grow around.</p>
            </div>
          </div>
        </section>
      ) : activeNavPanel === 'text' ? (
        <TextPanel
          textElements={textElements}
          selectedTextId={selectedTextId}
          onSelectText={(id) => setSelectedTextId(id)}
          onAddText={handleAddText}
          onUpdateText={handleUpdateText}
          onDeleteText={handleDeleteText}
          onDuplicateText={handleDuplicateText}
          onReorderText={handleReorderText}
          copiedStyle={copiedTextStyle}
          onCopyStyle={handleCopyStyle}
          onPasteStyle={handlePasteStyle}
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
                        : 'Supports MP4, MOV, WebM, MP3, WAV, M4A up to 1 GB'}
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


                      <div className="upload-divider">
                        <span className="upload-divider-line" />
                        <span className="upload-divider-text">Or try a sample</span>
                        <span className="upload-divider-line" />
                      </div>

                      <div className="upload-samples-grid">
                        {SAMPLE_ITEMS.map((sample, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="upload-sample-card"
                            title={`Load sample: ${sample.title}`}
                            onClick={e => {
                              e.stopPropagation();
                              loadSample(idx);
                            }}
                          >
                            <img src={sample.thumbnail} alt={sample.title} className="upload-sample-img" />
                            <span className="upload-sample-duration">{sample.duration}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                ref={preview}
                className={`video-frame ${hasVideoLayer && !videoEnabled ? 'video-removed' : ''}`}
                style={{ aspectRatio: `${size.width}/${size.height}` }}
              >
                <video
                  ref={media}
                  className={`${project.mediaType === 'audio' || (hasVideoLayer && !videoEnabled) ? 'audio-media' : ''} ${activeMediaAsset?.greenScreen?.enabled ? 'video-keyed' : ''}`}
                  key={`${project.id}-${busy ? 'processing' : 'ready'}-${videoEnabled ? 'video' : 'audio'}-${activeMediaAsset?.id || 'primary'}`}
                  src={busy ? undefined : mediaUrl(activeMediaAsset ? (activeMediaAsset.url || '') : `/api/projects/${project.id}/media`)}
                  playsInline
                  preload="metadata"
                  muted={muted}
                  onPlay={() => setPlaying(true)}
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
                <canvas
                  ref={canvas}
                  width={size.width}
                  height={size.height}
                  aria-label="Animated caption preview"
                  onClick={() => {
                    if (activeWord) {
                      selectWord(activeWord.id);
                    } else {
                      const curGroup = groups.find(g => time >= g[0].start && time < (g[g.length - 1].end + 0.08));
                      if (curGroup?.length) {
                        selectWord(curGroup[0].id);
                      }
                    }
                  }}
                />
                {settings.showSafeArea && (
                  <div className="safe-area-overlay" aria-hidden="true">
                    <div className="safe-area-guide-box">
                      <div className="safe-area-guide-header">Safe Area · Short Form</div>
                      <div className="safe-area-label top">Header / Profile</div>
                      <div className="safe-area-label right">Action Icons</div>
                      <div className="safe-area-label bottom">Caption & Title</div>
                    </div>
                  </div>
                )}
                {selectedCanvasElementId && (
                  <div className="canvas-element-action-overlay">
                    <button
                      type="button"
                      className="canvas-delete-element-btn"
                      onClick={() => {
                        setCanvasElements(prev => prev.filter(el => el.id !== selectedCanvasElementId));
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

                {/* Interactive Canvas Text Overlays */}
                {textElements.map(el => {
                  const isVisible = el.visible !== false && (time >= el.start && time <= el.end || selectedTextId === el.id);
                  if (!isVisible) return null;
                  const isSelected = selectedTextId === el.id;
                  const isEditing = isEditingCanvasTextId === el.id;

                  return (
                    <div
                      key={el.id}
                      className={`canvas-text-box-wrapper ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg)`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTextId(el.id);
                        setActiveNavPanel('text');
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!el.locked) {
                          setSelectedTextId(el.id);
                          setIsEditingCanvasTextId(el.id);
                        }
                      }}
                      onMouseDown={(e) => {
                        if (el.locked || isEditing) return;
                        handleStartDragText(e, el.id);
                      }}
                    >
                      {isEditing ? (
                        <textarea
                          autoFocus
                          className="canvas-inline-text-editor"
                          value={el.text}
                          style={{
                            fontFamily: el.fontFamily || 'DM Sans',
                            fontSize: `${Math.max(12, Math.round((el.fontSize / 1080) * (preview.current?.clientWidth || 360)))}px`,
                            fontWeight: el.fontWeight || 'bold',
                            fontStyle: el.fontStyle || 'normal',
                            color: el.color || '#FFFFFF',
                            textAlign: el.align === 'justify' ? 'center' : (el.align || 'center'),
                          }}
                          onChange={(e) => handleUpdateText(el.id, { text: e.target.value })}
                          onBlur={() => setIsEditingCanvasTextId(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              setIsEditingCanvasTextId(null);
                            } else if (e.key === 'Escape') {
                              setIsEditingCanvasTextId(null);
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="canvas-text-hit-target"
                          style={{
                            fontFamily: el.fontFamily || 'DM Sans',
                            fontSize: `${Math.max(12, Math.round((el.fontSize / 1080) * (preview.current?.clientWidth || 360)))}px`,
                            fontWeight: el.fontWeight || 'bold',
                            fontStyle: el.fontStyle || 'normal',
                            lineHeight: el.lineHeight || 1.2,
                          }}
                        >
                          <span style={{ opacity: 0, userSelect: 'none', pointerEvents: 'none' }}>
                            {transformTextCase(el.text || ' ', el.textCase)}
                          </span>
                        </div>
                      )}

                      {isSelected && !isEditing && (
                        <>
                          <div className="canvas-selection-box" />
                          {!el.locked && (
                            <>
                              <div className="resize-handle handle-nw" onMouseDown={(e) => handleStartResizeText(e, el.id, 'nw')} />
                              <div className="resize-handle handle-ne" onMouseDown={(e) => handleStartResizeText(e, el.id, 'ne')} />
                              <div className="resize-handle handle-se" onMouseDown={(e) => handleStartResizeText(e, el.id, 'se')} />
                              <div className="resize-handle handle-sw" onMouseDown={(e) => handleStartResizeText(e, el.id, 'sw')} />
                              <div className="resize-handle handle-n" onMouseDown={(e) => handleStartResizeText(e, el.id, 'n')} />
                              <div className="resize-handle handle-e" onMouseDown={(e) => handleStartResizeText(e, el.id, 'e')} />
                              <div className="resize-handle handle-s" onMouseDown={(e) => handleStartResizeText(e, el.id, 's')} />
                              <div className="resize-handle handle-w" onMouseDown={(e) => handleStartResizeText(e, el.id, 'w')} />
                            </>
                          )}

                          {/* Floating Quick Toolbar */}
                          <div className="canvas-floating-toolbar" onMouseDown={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`floating-tool-btn ${el.fontWeight === 'bold' || el.fontWeight === '800' || el.fontWeight === '700' ? 'active' : ''}`}
                              onClick={() => {
                                const isBold = el.fontWeight === 'bold' || el.fontWeight === '800' || el.fontWeight === '700';
                                handleUpdateText(el.id, { fontWeight: isBold ? 'normal' : 'bold' });
                              }}
                              title="Bold"
                            >
                              <Bold size={13} />
                            </button>
                            <button
                              type="button"
                              className={`floating-tool-btn ${el.fontStyle === 'italic' ? 'active' : ''}`}
                              onClick={() => handleUpdateText(el.id, { fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}
                              title="Italic"
                            >
                              <Italic size={13} />
                            </button>
                            <div className="floating-tool-divider" />
                            <button
                              type="button"
                              className={`floating-tool-btn ${el.align === 'left' ? 'active' : ''}`}
                              onClick={() => handleUpdateText(el.id, { align: 'left' })}
                              title="Align Left"
                            >
                              <AlignLeft size={13} />
                            </button>
                            <button
                              type="button"
                              className={`floating-tool-btn ${el.align === 'center' || !el.align ? 'active' : ''}`}
                              onClick={() => handleUpdateText(el.id, { align: 'center' })}
                              title="Align Center"
                            >
                              <AlignCenter size={13} />
                            </button>
                            <button
                              type="button"
                              className={`floating-tool-btn ${el.align === 'right' ? 'active' : ''}`}
                              onClick={() => handleUpdateText(el.id, { align: 'right' })}
                              title="Align Right"
                            >
                              <AlignRight size={13} />
                            </button>
                            <div className="floating-tool-divider" />
                            <label className="floating-color-btn" title="Text Color">
                              <span className="floating-color-swatch" style={{ backgroundColor: el.color || '#FFFFFF' }} />
                              <input
                                type="color"
                                className="floating-color-picker"
                                value={el.color || '#FFFFFF'}
                                onChange={(e) => handleUpdateText(el.id, { color: e.target.value })}
                              />
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Interactive Canvas Media Overlays */}
                {canvasElements.map(el => {
                  const isVisible = el.visible !== false && ((el.start === undefined || time >= el.start) && (el.end === undefined || time <= el.end) || selectedCanvasElementId === el.id);
                  if (!isVisible) return null;
                  const isSelected = selectedCanvasElementId === el.id;

                  return (
                    <div
                      key={el.id}
                      className={`canvas-media-box-wrapper ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
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
                        setSelectedTextId(null);
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
                            >
                              <RotateCcw size={13} />
                            </button>
                            <div className="floating-tool-divider" />
                            <button
                              type="button"
                              className="floating-tool-btn danger"
                              onClick={() => handleDeleteCanvasElement(el.id)}
                              title="Remove from Canvas"
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
                  className={`icon-button tiny ${showSearchBar ? 'active' : ''}`}
                  aria-label="Search and replace"
                  title="Find & Replace"
                  onClick={() => setShowSearchBar(s => !s)}
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
            <div ref={timelineViewportRef} className="timeline-viewport">
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
              >
                {/* 1. Light Dynamic Ruler */}
                <div className="timeline-ruler">
                  {rulerTicks.map((tick, i) => (
                    <div
                      key={i}
                      className={`timeline-ruler-tick ${tick.isMajor ? 'major' : 'minor'}`}
                      style={{ left: `${duration ? (tick.time / duration) * 100 : 0}%` }}
                    >
                      {tick.isMajor && <span className="tick-label">{tick.label}</span>}
                      <span className="tick-line" />
                    </div>
                  ))}
                </div>

                {/* 2. Waveform track with green progress bars */}
                {project?.waveform?.length ? (
                  <div className="timeline-waveform" aria-hidden="true">
                    {project.waveform.map((v, i) => {
                      const isPlayed = i / project.waveform!.length <= (duration ? time / duration : 0);
                      return (
                        <i
                          key={i}
                          className={isPlayed ? 'is-played' : ''}
                          style={{
                            height: `${Math.max(14, v * 100)}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                ) : null}

                {/* 2.5. Text Elements Lane */}
                {project && duration > 0 && textElements.length > 0 && (
                  <div className="timeline-text-lane">
                    {textElements.map(el => {
                      const isSelected = selectedTextId === el.id;
                      const leftPct = Math.max(0, Math.min(100, (el.start / duration) * 100));
                      const widthPct = Math.max(1.2, Math.min(100 - leftPct, ((el.end - el.start) / duration) * 100));

                      return (
                        <div
                          key={el.id}
                          className={`timeline-text-block ${isSelected ? 'selected' : ''} ${el.visible === false ? 'hidden' : ''}`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTextId(el.id);
                            setActiveNavPanel('text');
                            seek(el.start);
                          }}
                          onMouseDown={(e) => handleStartDragTimelineText(e, el.id, 'move')}
                          title={`Text: "${el.text}" (${el.start.toFixed(1)}s - ${el.end.toFixed(1)}s)`}
                        >
                          <div
                            className="timeline-block-handle left"
                            title="Drag to adjust start"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleStartDragTimelineText(e, el.id, 'start');
                            }}
                          />
                          <div className="timeline-text-block-content">
                            <Type size={12} className="timeline-text-icon" />
                            <span className="timeline-text-title">{el.text || 'Text'}</span>
                          </div>
                          <div
                            className="timeline-block-handle right"
                            title="Drag to adjust end"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleStartDragTimelineText(e, el.id, 'end');
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

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
                            setSelectedTextId(null);
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
                  {project && duration > 0 && groups.map((g, gIdx) => {
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
                      >
                        {/* Group Left Trim Bracket */}
                        <div
                          className="timeline-group-bracket left"
                          title="Drag to adjust sentence start"
                          onMouseDown={(e) => startGroupTrim(e, g, 'left')}
                        />

                        {/* Words inside this sentence card */}
                        <div className="timeline-group-words">
                          {g.map((w, wIdx) => {
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
                                  className={`timeline-word-cell white-cell ${isWordSelected ? 'is-selected' : ''} ${isCurrentWord ? 'is-active' : ''} ${w.spotlight ? 'is-spotlight' : (w.emphasis ? 'is-emphasized' : '')}`}
                                  style={{
                                    left: `${wLeftPct}%`,
                                    width: `calc(${wWidthPct}% - 1px)`,
                                  }}
                                  title={`${w.text} (${timecode(w.start)} - ${timecode(w.end)})`}
                                  onMouseDown={(e) => startWordDrag(e, w)}
                                  onContextMenu={(e) => handleWordContextMenu(e, w)}
                                >
                                  {/* Left trim handle */}
                                  <div
                                    className="timeline-word-edge-handle left"
                                    title="Trim word start"
                                    onMouseDown={(e) => startWordHandleDrag(e, w, 'left')}
                                  />

                                  <span className="timeline-word-cell-text">{w.text}</span>
                                  {w.spotlight ? (
                                    <span className="timeline-word-spotlight-badge" title="Highlighted">⚡</span>
                                  ) : w.emphasis ? (
                                    <span className="timeline-word-star" title="Suggested — click the word to highlight it">⚡</span>
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

    {notice&&<div className="toast" role="status"><CircleHelp size={18}/><span>{notice}</span><button className="icon-button tiny" aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {uploadProgress!==null&&<div className="upload-toast" role="status"><LoaderCircle className="spin" size={18}/>Uploading file… {uploadProgress}%</div>}
    {modal==='projects'&&<Modal title="Your workspace" onClose={()=>setModal(null)}><p className="modal-description">Projects are saved on this computer, ready whenever you are.</p><button className="button primary full" onClick={()=>{setModal(null);input.current?.click();}}><Plus size={16}/>New upload</button><div className="project-list">{projects.length?projects.map(p=><button key={p.id} onClick={()=>void openProject(p)}><span className="project-list-icon">{p.mediaType==='audio'?<FileAudio size={21}/>:<Film size={21}/>}</span><span><strong>{p.name}</strong><small>{timecode(p.duration)} · {p.status==='ready'?`${p.words?.length??0} words`:p.status}</small></span><ChevronRight size={17}/></button>):<div className="empty-projects"><FolderOpen size={32}/><p>Your first story is one upload away.</p></div>}</div></Modal>}
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
          <span>Need text subtitles only?</span>
          <div>
            <button type="button" onClick={() => downloadTranscript('srt')}>.SRT</button>
            <button type="button" onClick={() => downloadTranscript('vtt')}>.VTT</button>
            <button type="button" onClick={() => downloadTranscript('json')}>Word timings .JSON</button>
          </div>
        </div>
      </Modal>
    )}
    {modal==='help'&&<Modal title="A little guide to Bol." onClose={()=>setModal(null)} wide><div className="guide-grid"><div><span className="guide-number">01</span><h3>Bring your story</h3><p>Upload a video or audio file. Choose Hindi + English for Hinglish and Roman to write “aap kaise ho” in Latin letters.</p></div><div><span className="guide-number">02</span><h3>Give it a once-over</h3><p>The local Hinglish recognizer times each word against the audio. Review names, slang, and spellings &mdash; the recognizer does not report how sure it is, so give proper nouns a second look.</p></div><div><span className="guide-number">03</span><h3>Find your emphasis</h3><p>Loudness, pitch, and duration suggest a word to highlight in each line, shown with a dashed outline. They are only suggestions: click any word and toggle its highlight to decide for yourself.</p></div><div><span className="guide-number">04</span><h3>Make some moves</h3><p>Pick a template, adjust color and motion, then export a captioned MP4, green-screen overlay, or subtitle file.</p></div></div><div className="guide-note"><MonitorPlay size={22}/><p><strong>Local by design.</strong> Your recordings stay here. The first transcription downloads the model; later runs use the cached copy. Roman spelling and timing can need corrections, especially with names, music, or overlapping voices.</p></div><div className="guide-shortcuts"><span><kbd>Space</kbd>Play / pause</span><span><kbd>⌘ / Ctrl + S</kbd>Save changes</span></div></Modal>}

    {modal === 'search-replace' && (
      <Modal title="Search & Replace" onClose={() => setModal(null)}>
        <div className="search-replace-modal-body">
          <div className="search-replace-field">
            <label>
              <span>Find</span>
              {searchFindText.trim() && project && (
                <span style={{ color: '#34d399' }}>
                  {
                    project.words.filter(w =>
                      searchCaseSensitive
                        ? w.text.includes(searchFindText)
                        : w.text.toLowerCase().includes(searchFindText.toLowerCase())
                    ).length
                  } found
                </span>
              )}
            </label>
            <input
              autoFocus
              type="text"
              placeholder="Word to find..."
              value={searchFindText}
              onChange={e => setSearchFindText(e.target.value)}
            />
          </div>

          <div className="search-replace-field">
            <label><span>Replace with</span></label>
            <input
              type="text"
              placeholder="Replacement text..."
              value={searchReplaceText}
              onChange={e => setSearchReplaceText(e.target.value)}
            />
          </div>

          <label className="search-replace-options">
            <input
              type="checkbox"
              checked={searchCaseSensitive}
              onChange={e => setSearchCaseSensitive(e.target.checked)}
            />
            <span>Match case</span>
          </label>

          <div className="search-replace-actions">
            <button
              type="button"
              className="button secondary compact"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button secondary compact"
              disabled={!searchFindText.trim() || !project}
              onClick={() => {
                if (!project || !searchFindText.trim()) return;
                const idx = project.words.findIndex(w =>
                  searchCaseSensitive
                    ? w.text.includes(searchFindText)
                    : w.text.toLowerCase().includes(searchFindText.toLowerCase())
                );
                if (idx === -1) {
                  notify(`No occurrences found for "${searchFindText}"`);
                  return;
                }
                const target = project.words[idx];
                const updated = searchCaseSensitive
                  ? target.text.replace(searchFindText, searchReplaceText)
                  : target.text.replace(new RegExp(searchFindText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), searchReplaceText);
                updateWord(target.id, { text: updated });
                seek(target.start);
                notify(`Replaced occurrence at ${target.start.toFixed(2)}s`);
              }}
            >
              Replace Next
            </button>
            <button
              type="button"
              className="button primary compact"
              disabled={!searchFindText.trim() || !project}
              onClick={() => {
                if (!project || !searchFindText.trim()) return;
                const count = project.words.filter(w =>
                  searchCaseSensitive
                    ? w.text.includes(searchFindText)
                    : w.text.toLowerCase().includes(searchFindText.toLowerCase())
                ).length;
                const updatedWords = replaceAllOccurrences(project.words, searchFindText, searchReplaceText, searchCaseSensitive);
                markEdit({ ...project, words: updatedWords });
                notify(`Replaced ${count} occurrence${count === 1 ? '' : 's'}.`);
                setModal(null);
              }}
            >
              Replace All
            </button>
          </div>
        </div>
      </Modal>
    )}



    {wordMenu && (
      <>
        <div
          className="word-context-backdrop"
          onClick={() => setWordMenu(null)}
        />
        <div
          className="word-context-menu"
          style={{
            top: `${wordMenu.position.top}px`,
            left: `${wordMenu.position.left}px`,
          }}
        >
          <div className="word-menu-header">
            {selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
              ? `${selectedWordIds.size} words selected`
              : `"${wordMenu.word.text}"`}
          </div>

          {/* One highlight control. Emphasize used to sit above this and did
              nothing the renderer could see unless no word on the page was
              highlighted — see setWordHighlight. */}
          <button
            type="button"
            className={`word-menu-item ${
              selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                ? (Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.spotlight) ? 'active' : '')
                : (wordMenu.word.spotlight ? 'active' : '')
            }`}
            onClick={() => {
              if (selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)) {
                const allHighlighted = Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.spotlight);
                updateWords(selectedWordIds, { spotlight: !allHighlighted, emphasis: false });
              } else {
                updateWord(wordMenu.word.id, { spotlight: !wordMenu.word.spotlight, emphasis: false });
              }
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Zap size={18} fill={(selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id) ? Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.spotlight) : wordMenu.word.spotlight) ? 'currentColor' : 'none'} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Highlight</span>
              <span className="word-menu-item-desc">
                {selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                  ? `Highlight ${selectedWordIds.size} words`
                  : 'Grow this word and give it the accent colour'}
              </span>
            </div>
          </button>

          <button
            type="button"
            className={`word-menu-item ${
              selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                ? (Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.behind) ? 'active' : '')
                : (wordMenu.word.behind ? 'active' : '')
            }`}
            onClick={() => {
              if (selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)) {
                const allBehind = Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.behind);
                updateWords(selectedWordIds, { behind: !allBehind });
              } else {
                updateWord(wordMenu.word.id, { behind: !wordMenu.word.behind });
              }
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Accessibility size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Send Behind</span>
              <span className="word-menu-item-desc">
                {selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                  ? `Send ${selectedWordIds.size} words behind subject`
                  : 'Move this word behind the subject'}
              </span>
            </div>
          </button>

          <hr className="word-menu-divider" />

          {(!selectedWordIds.has(wordMenu.word.id) || selectedWordIds.size <= 1) && (
            <>
              <button
                type="button"
                className="word-menu-item"
                onClick={() => {
                  setEditingWordId(wordMenu.word.id);
                  setEditingText(wordMenu.word.text);
                  setWordMenu(null);
                }}
              >
                <div className="word-menu-item-icon">
                  <Pencil size={18} />
                </div>
                <div className="word-menu-item-content">
                  <span className="word-menu-item-title">Edit</span>
                  <span className="word-menu-item-desc">Modify the text</span>
                </div>
              </button>

              <button
                type="button"
                className="word-menu-item"
                onClick={() => {
                  handleSplitLine(wordMenu.word.id);
                  setWordMenu(null);
                }}
              >
                <div className="word-menu-item-icon">
                  <Split size={18} />
                </div>
                <div className="word-menu-item-content">
                  <span className="word-menu-item-title">Split</span>
                  <span className="word-menu-item-desc">Split caption here</span>
                </div>
              </button>
            </>
          )}

          <button
            type="button"
            className="word-menu-item"
            onClick={() => {
              if (selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)) {
                const p = projectRef.current;
                if (p) {
                  const sorted = p.words.filter(w => selectedWordIds.has(w.id));
                  let cur = p.words;
                  for (const w of sorted) {
                    cur = moveWordToPreviousLine(cur, w.id, settings.wordsPerLine);
                  }
                  markEdit({ ...p, words: cur });
                  notify(`Moved ${sorted.length} words to previous line.`);
                }
              } else {
                handleMoveToPreviousLine(wordMenu.word.id);
              }
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <ArrowLeft size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Previous Line</span>
              <span className="word-menu-item-desc">Move word to previous line</span>
            </div>
          </button>

          <button
            type="button"
            className="word-menu-item"
            onClick={() => {
              if (selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)) {
                const p = projectRef.current;
                if (p) {
                  const sorted = p.words.filter(w => selectedWordIds.has(w.id)).reverse();
                  let cur = p.words;
                  for (const w of sorted) {
                    cur = moveWordToNextLine(cur, w.id);
                  }
                  markEdit({ ...p, words: cur });
                  notify(`Moved ${sorted.length} words to next line.`);
                }
              } else {
                handleMoveToNextLine(wordMenu.word.id);
              }
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <ArrowRight size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Next Line</span>
              <span className="word-menu-item-desc">Move word to next line</span>
            </div>
          </button>

          <hr className="word-menu-divider" />

          <button
            type="button"
            className="word-menu-item"
            onClick={() => {
              const cleanText = wordMenu.word.text.replace(/[.!?।,;:—\-]+$/, '');
              setSearchFindText(cleanText);
              setSearchReplaceText('');
              setModal('search-replace');
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Search size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Search &amp; Replace</span>
              <span className="word-menu-item-desc">Find all occurrences</span>
            </div>
          </button>

          <hr className="word-menu-divider" />

          <button
            type="button"
            className="word-menu-item danger"
            onClick={() => {
              if (selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)) {
                handleDeleteWords(selectedWordIds);
              } else {
                handleDeleteWord(wordMenu.word.id);
              }
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Trash2 size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Delete</span>
              <span className="word-menu-item-desc">
                {selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                  ? `Remove ${selectedWordIds.size} words`
                  : 'Remove this word'}
              </span>
            </div>
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
        <div
          className="timeline-word-popover"
          style={calculatePopoverPosition(timelinePopover.rect)}
        >
          <div className="popover-header">
            <span className="popover-title">Highlight</span>
            <div className="popover-style-group" role="group" aria-label="Highlight style">
              <button
                type="button"
                className={`popover-icon-btn btn-spotlight ${timelinePopover.spotlight ? 'active' : ''}`}
                title={timelinePopover.spotlight ? 'Remove highlight' : 'Highlight this word'}
                aria-label="Highlight this word"
                aria-pressed={timelinePopover.spotlight}
                onClick={() => setWordHighlight('highlight')}
              >
                <Sparkles size={14} />
              </button>

              <button
                type="button"
                className={`popover-icon-btn btn-clear ${!timelinePopover.spotlight ? 'active' : ''}`}
                title="No highlight"
                aria-label="No highlight"
                aria-pressed={!timelinePopover.spotlight}
                onClick={() => setWordHighlight('clear')}
              >
                <Ban size={14} />
              </button>
            </div>
          </div>

          <div className="popover-input-wrapper">
            <textarea
              autoFocus
              aria-label="Edit word text"
              className="popover-word-input"
              value={timelinePopover.draftText}
              rows={2}
              onChange={(e) => setTimelinePopover(p => p ? { ...p, draftText: e.target.value } : null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveTimelineWordEdit();
                } else if (e.key === 'Escape') {
                  setTimelinePopover(null);
                }
              }}
            />
            <span className="popover-input-emoji" title="Word emoji tag" aria-hidden="true">
              <Smile size={16} />
            </span>
          </div>

          <div className="popover-footer">
            <button
              type="button"
              className="popover-btn-delete"
              title="Delete word"
              aria-label="Delete word"
              onClick={() => {
                handleDeleteWord(timelinePopover.word.id);
                setTimelinePopover(null);
              }}
            >
              <Trash2 size={16} />
            </button>

            <div className="popover-footer-actions">
              <button
                type="button"
                className="popover-btn-cancel"
                title="Cancel"
                aria-label="Cancel"
                onClick={() => setTimelinePopover(null)}
              >
                <X size={16} />
              </button>
              <button
                type="button"
                className="popover-btn-confirm"
                title="Save changes (Enter)"
                aria-label="Save changes"
                onClick={saveTimelineWordEdit}
              >
                <Check size={16} />
              </button>
            </div>
          </div>

          <div className="popover-arrow" />
        </div>
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
          url: greenScreenTargetEl.url,
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

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
