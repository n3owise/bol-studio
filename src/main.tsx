import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Accessibility, ArrowDown, ArrowLeft, ArrowRight, AudioLines, Ban, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clapperboard, Download, Edit3, FileAudio, Film, Folder, FolderOpen, Headphones, Layers, Link2, LoaderCircle, Maximize2, Minus, MonitorPlay, MoreHorizontal, Palette, Pause, Pencil, Play, Plus, Redo2, Replace, RotateCcw, Rows2, Scan, Scissors, Search, Settings2, Smile, Sparkles, Split, Star, Subtitles, Trash2, Type, Undo2, Upload, UploadCloud, Video, Volume2, VolumeX, WandSparkles, X, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/noto-sans-devanagari/700.css';
import './styles.css';
import { API, request, upload } from './lib/api';
import { defaults, type Project, type Settings, type Word } from './lib/types';
import { appendWord, autoDetectHighlights, dimensions, drawCaptions, ensureValidIntervals, getContrastColor, groupWords, insertWord, mergeLines, moveWordToLine, moveWordsToLine, moveWordToNextLine, moveWordToPreviousLine, replaceAllOccurrences, splitLineAtWord, subtitleText, templates } from './lib/captions';

const timecode = (s: number) => `${Math.floor(Math.max(0,s)/60).toString().padStart(2,'0')}:${(Math.max(0,s)%60).toFixed(1).padStart(4,'0')}`;
type Health = { status?: string; engine?: string; model?: string; [key: string]: unknown };
type EditState = Pick<Project, 'words' | 'settings' | 'name' | 'videoEnabled'>;

function TemplatePreview({ id }: { id: string }) {
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
  return <span>THINK <b>BIGGER.</b></span>;
}
function TemplateCard({ template, selected, onClick, disabled = false }: { template: typeof templates[number]; selected: boolean; onClick: () => void; disabled?: boolean }) {
  const pillColor = getContrastColor(template.accent);
  return <button className={`template-card ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected} disabled={disabled}>
    <div className={`template-art art-${template.id}`} style={{ '--card-accent': template.accent, '--pill-text': pillColor } as React.CSSProperties}>
      <TemplatePreview id={template.id}/>
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

function App() {
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
  const [rightTab, setRightTab] = useState('templates');
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
  const [resolution, setResolution] = useState(720);
  const [exporting, setExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState(import.meta.env.DEV ? 'Saved locally' : 'Saved to cloud');
  const [dirty, setDirty] = useState(0);
  const [history, setHistory] = useState<EditState[]>([]);
  const [future, setFuture] = useState<EditState[]>([]);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const savedDirty = useRef(0);
  const dirtyRef = useRef(0);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const media = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const duration = project?.duration || 0;
  const words = project?.words ?? [];
  const groups = useMemo(() => groupWords(words, settings.template === 'kinetic' ? 1 : settings.wordsPerLine), [words, settings.wordsPerLine, settings.template]);
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g => g.some(w => w.text.toLowerCase().includes(q)));
  }, [groups, searchQuery]);
  const size = dimensions(settings, project?.width || 720, project?.height || 1280);
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

  const flushSave = useCallback(() => {
    const action = saveChain.current.catch(() => {}).then(async () => {
      const p = projectRef.current; const generation = dirtyRef.current;
      if (!p || generation <= savedDirty.current) return;
      setSaveStatus('Saving…');
      try {
        const result = await request<Project>(`/projects/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words: p.words, settings: p.settings, name: p.name, videoEnabled: p.videoEnabled }) });
        if (projectRef.current?.id === p.id) { savedDirty.current = generation; setSaveStatus(import.meta.env.DEV ? 'Saved locally' : 'Saved to cloud'); setProject(previous => previous?.id === p.id ? { ...previous, revision: result.revision } : previous); }
      } catch (e) { setSaveStatus('Unsaved changes'); notify((e as Error).message); throw e; }
    });
    saveChain.current = action; return action;
  }, [notify]);
  useEffect(() => { if (dirty <= savedDirty.current) return; const timer = setTimeout(() => void flushSave().catch(() => {}), 650); return () => clearTimeout(timer); }, [dirty, flushSave]);
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirtyRef.current > savedDirty.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload',handler); return () => window.removeEventListener('beforeunload',handler); }, []);

  function markEdit(next: Project, record = true) {
    const previous = projectRef.current;
    if (record && previous) { setHistory(h => [...h.slice(-39), { words: previous.words, settings: previous.settings, name: previous.name, videoEnabled: previous.videoEnabled }]); setFuture([]); }
    projectRef.current = next; setProject(next); setSettings(next.settings); setSaveStatus('Saving…'); dirtyRef.current += 1; setDirty(dirtyRef.current);
  }
  function updateSettings(update: Partial<Settings>) {
    const next = { ...settings, ...update }; setSettings(next);
    if (projectRef.current && !busy) markEdit({ ...projectRef.current, settings: next });
  }
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
  function handleDropWords(
    sourceWordIds: string[],
    targetGroupIdx: number,
    targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' }
  ) {
    const p = projectRef.current;
    if (!p || !sourceWordIds.length) return;

    const effectivePerLine = settings.template === 'kinetic' ? 1 : settings.wordsPerLine;
    const currentGroups = groupWords(p.words, effectivePerLine);
    if (targetGroupIdx < 0 || targetGroupIdx >= currentGroups.length) return;
    const targetGroup = currentGroups[targetGroupIdx];

    const validMovingIds = p.words.filter(w => sourceWordIds.includes(w.id)).map(w => w.id);
    if (!validMovingIds.length) return;

    if (typeof targetPosition === 'object' && validMovingIds.includes(targetPosition.targetWordId)) {
      return;
    }

    const neededMax = Math.max(effectivePerLine, targetGroup.length + validMovingIds.length);
    const updatedWords = moveWordsToLine(p.words, validMovingIds, targetGroupIdx, targetPosition, neededMax);

    const nextSettings = neededMax > settings.wordsPerLine && settings.template !== 'kinetic'
      ? { ...settings, wordsPerLine: neededMax }
      : settings;

    markEdit({ ...p, words: updatedWords, settings: nextSettings }, true);
    setSelectedWordIds(new Set(validMovingIds));
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
    notify('Auto-suggested spotlights & emphasis applied.');
  }
  function handleClearAllEmphasis() {
    const p = projectRef.current; if (!p) return;
    markEdit({ ...p, words: p.words.map(w => ({ ...w, emphasis: false, spotlight: false })) });
    notify('All spotlights and emphasis cleared.');
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
  function setWordHighlight(style: 'emphasize' | 'spotlight' | 'clear') {
    if (!timelinePopover) return;
    const wordId = timelinePopover.word.id;
    let nextEmphasis = false;
    let nextSpotlight = false;

    if (style === 'emphasize') {
      const currentEmphasized = timelinePopover.emphasis && !timelinePopover.spotlight;
      nextEmphasis = !currentEmphasized;
      nextSpotlight = false;
    } else if (style === 'spotlight') {
      const currentSpotlight = timelinePopover.spotlight;
      nextSpotlight = !currentSpotlight;
      nextEmphasis = false;
    } else if (style === 'clear') {
      nextEmphasis = false;
      nextSpotlight = false;
    }

    if (selectedWordIds.size > 1 && selectedWordIds.has(wordId)) {
      updateWords(selectedWordIds, {
        emphasis: nextEmphasis,
        spotlight: nextSpotlight,
      });
    } else {
      updateWord(wordId, {
        emphasis: nextEmphasis,
        spotlight: nextSpotlight,
      });
    }

    setTimelinePopover(p =>
      p
        ? {
            ...p,
            emphasis: nextEmphasis,
            spotlight: nextSpotlight,
            word: {
              ...p.word,
              emphasis: nextEmphasis,
              spotlight: nextSpotlight,
            },
          }
        : null
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
    // Allow boundary to adjust shared boundary with neighboring words (down to 0.04s min duration)
    const minStart = prevWord ? Number((prevWord.start + 0.04).toFixed(3)) : 0;
    const maxEnd = nextWord ? Number((nextWord.end - 0.04).toFixed(3)) : duration;

    const startX = e.clientX;
    const origStart = word.start;
    const origEnd = word.end;
    const origPrevEnd = prevWord ? prevWord.end : 0;
    const origNextStart = nextWord ? nextWord.start : duration;

    let currentStart = origStart;
    let currentEnd = origEnd;
    let currentPrevEnd = origPrevEnd;
    let currentNextStart = origNextStart;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const dt = (deltaX / scrollWidth) * duration;

      if (edge === 'left') {
        const rawTargetStart = Number((origStart + dt).toFixed(3));
        currentStart = Math.max(minStart, Math.min(origEnd - MIN_WORD_DURATION, rawTargetStart));
        if (prevWord) {
          currentPrevEnd = Math.min(origPrevEnd, Number((currentStart - 0.005).toFixed(3)));
        }

        const updatedWords = p.words.map(w => {
          if (w.id === word.id) return { ...w, start: currentStart };
          if (prevWord && w.id === prevWord.id) return { ...w, end: currentPrevEnd };
          return w;
        });
        markEdit({ ...p, words: updatedWords }, false);
        seek(currentStart);
      } else {
        const rawTargetEnd = Number((origEnd + dt).toFixed(3));
        currentEnd = Math.min(maxEnd, Math.max(origStart + MIN_WORD_DURATION, rawTargetEnd));
        if (nextWord) {
          currentNextStart = Math.max(origNextStart, Number((currentEnd + 0.005).toFixed(3)));
        }

        const updatedWords = p.words.map(w => {
          if (w.id === word.id) return { ...w, end: currentEnd };
          if (nextWord && w.id === nextWord.id) return { ...w, start: currentNextStart };
          return w;
        });
        markEdit({ ...p, words: updatedWords }, false);
        seek(currentEnd);
      }
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const latestProj = projectRef.current;
      if (!latestProj) return;

      const finalWords = latestProj.words.map(w => {
        if (w.id === word.id) return { ...w, start: currentStart, end: currentEnd };
        if (prevWord && w.id === prevWord.id) return { ...w, end: currentPrevEnd };
        if (nextWord && w.id === nextWord.id) return { ...w, start: currentNextStart };
        return w;
      });
      ensureValidIntervals(finalWords, duration);
      markEdit({ ...latestProj, words: finalWords }, true);
      notify(`Adjusted "${word.text}" duration: ${(currentEnd - currentStart).toFixed(2)}s`);
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
    };

    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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
    setFuture(f => [...f,{ words:p.words,settings:p.settings,name:p.name,videoEnabled:p.videoEnabled }]); setHistory(h => h.slice(0,-1)); markEdit({ ...p,...previous },false);
  }
  function redo() {
    const p = projectRef.current; const next = future.at(-1); if (!p || !next) return;
    setHistory(h => [...h,{ words:p.words,settings:p.settings,name:p.name,videoEnabled:p.videoEnabled }]); setFuture(f => f.slice(0,-1)); markEdit({ ...p,...next },false);
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
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) {
      if (!project || words.length === 0) ctx.clearRect(0, 0, size.width, size.height);
      else drawCaptions(ctx, size.width, size.height, words, settings, time, groups);
    }
  }, [project, words, settings, time, size.width, size.height, groups]);
  useEffect(() => {
    void document.fonts.ready.then(() => {
      const ctx = canvas.current?.getContext('2d');
      if (ctx) {
        if (!project || words.length === 0) ctx.clearRect(0, 0, size.width, size.height);
        else drawCaptions(ctx, size.width, size.height, words, settings, time, groups);
      }
    });
  }, [project, words, settings, time, groups, size.width, size.height]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (timelinePopover) { setTimelinePopover(null); return; }
        if (wordMenu) { setWordMenu(null); return; }
        if (captionToolsOpen) { setCaptionToolsOpen(false); return; }
        if (editingWordId) { setEditingWordId(null); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); void flushSave().catch(()=>{}); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); handleSplitAtCurrent(); return; }
      if ((e.target as HTMLElement)?.closest('input, textarea, select, dialog, button, a, [contenteditable]')) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); setTimelineZoom(z => Math.min(32, Number((z * 1.35).toFixed(2)))); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setTimelineZoom(z => Math.max(1, Number((z / 1.35).toFixed(2)))); return; }
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown',onKey); return () => window.removeEventListener('keydown',onKey);
  },[togglePlay,flushSave,timelinePopover,wordMenu,captionToolsOpen,editingWordId,selectedWord,time,project]);

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
    }
    catch(e) { notify((e as Error).message); }
  }
  async function startExport() {
    if (!project) return;
    const currentProject = project;
    setExporting(true);
    try { await flushSave(); await request(`/projects/${currentProject.id}/exports`,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:exportMode,resolution}) }); const result=await request<Project>(`/projects/${currentProject.id}`); if (projectRef.current?.id === currentProject.id) setProject(p=>p?.id===currentProject.id?{...p,exports:result.exports}:p); }
    catch(e) { notify((e as Error).message); } finally { setExporting(false); }
  }
  function downloadTranscript(format: 'srt' | 'vtt' | 'json') {
    if(!project) return;
    const text=format==='json'?JSON.stringify({name:project.name,words:project.words,settings},null,2):subtitleText(project.words,settings.wordsPerLine,format);
    const blob=new Blob([text],{type:format==='json'?'application/json':'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${project.name.replace(/[^\p{L}\p{N}_-]/gu,'_')}.${format}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function retryTranscription() {
    if(!project) return;
    const currentProject = project;
    try { await flushSave(); const result=await request<Project>(`/projects/${currentProject.id}/transcribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({script:currentProject.script,language:currentProject.language})}); if (projectRef.current?.id === currentProject.id) { setProject(result); projectRef.current=result; setScript(result.script); setLanguage(result.language); } }
    catch(e){notify((e as Error).message);}
  }

  return <div className="app-shell">
    <input ref={input} type="file" accept="video/*,audio/*,.mkv,.m4a,.wav,.mp3,.webm" hidden onChange={e=>void importFile(e.target.files?.[0])}/>

    <header className="studio-navbar">
      <div className="navbar-left">
        <button className="navbar-brand" onClick={() => setModal('projects')} title="Projects workspace" aria-label="Bol Studio - Projects workspace">
          <img src="/bol.studio.svg" alt="bol.studio" className="navbar-brand-logo" />
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
              <span className="navbar-save-badge">
                <span className={`status-dot ${health ? '' : 'offline'}`} />
                {saveStatus}
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
      <main className="editor-grid">
        <section className="style-panel panel">
          <div className="sidebar-header">
            <div className="sidebar-header-left">
              <span className="sidebar-brand-tag">
                <Subtitles size={15} />
                <span>STUDIO</span>
              </span>
              {project?.words.length ? (
                <span className="sidebar-word-count">{project.words.length} words</span>
              ) : null}
            </div>
            <div className="sidebar-header-right">
              {!!(project?.words.length && !busy) && (
                <>
                  <button
                    type="button"
                    className="sidebar-tool-btn"
                    title="Find & Replace words"
                    onClick={() => {
                      setSearchFindText('');
                      setSearchReplaceText('');
                      setModal('search-replace');
                    }}
                  >
                    <Search size={14} />
                    <span>Find</span>
                  </button>
                  <button
                    type="button"
                    className="sidebar-tool-btn"
                    title="Auto-Emphasize key words"
                    onClick={handleAutoStar}
                  >
                    <Sparkles size={14} />
                    <span>Auto Star</span>
                  </button>
                  <button
                    type="button"
                    className="sidebar-tool-btn"
                    title="Clear all emphasis stars"
                    onClick={handleClearAllEmphasis}
                  >
                    <RotateCcw size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="panel-tabs">
            <button className={rightTab === 'templates' ? 'active' : ''} onClick={() => setRightTab('templates')}>
              <Layers size={15} /> Templates
            </button>
            <button className={rightTab === 'customize' ? 'active' : ''} onClick={() => setRightTab('customize')}>
              <Settings2 size={15} /> Caption Settings
            </button>
          </div>
          <div className="style-content">
            {rightTab === 'templates' ? (
              <>
                <div className="style-intro">
                  <div>
                    <h2>Choose Template</h2>
                    <p>15 viral styles engineered for engagement.</p>
                  </div>
                  <span className="template-number">{String(templates.length).padStart(2, '0')}</span>
                </div>
                <div className="template-grid">
                  {templates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={settings.template === template.id}
                      disabled={busy}
                      onClick={() => {
                        updateSettings({ template: template.id, accent: template.accent });
                      }}
                    />
                  ))}
                </div>
                <div className="selected-template-note">
                  <Sparkles size={16} />
                  <div>
                    <strong>{templates.find(t => t.id === settings.template)?.name}</strong>
                    <span>{templates.find(t => t.id === settings.template)?.description}</span>
                  </div>
                  <button className="icon-button" aria-label="Customize selected template" onClick={() => setRightTab('customize')}>
                    <ArrowRight size={18} />
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
                  <div className="position-presets">
                    {[
                      { name: 'Top', value: 22 },
                      { name: 'Middle', value: 50 },
                      { name: 'Bottom', value: 72 },
                    ].map(p => (
                      <button
                        disabled={busy}
                        key={p.name}
                        type="button"
                        onClick={() => updateSettings({ position: p.value })}
                        className={settings.position === p.value ? 'active' : ''}
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
                      max="8"
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
              <p>Click any word on the bottom timeline to open its editor, adjust duration dividers, and feature keywords with vibrant spotlighting.</p>
            </div>
          </div>
        </section>

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
                  className={project.mediaType === 'audio' || (hasVideoLayer && !videoEnabled) ? 'audio-media' : ''}
                  key={`${project.id}-${busy ? 'processing' : 'ready'}-${videoEnabled ? 'video' : 'audio'}`}
                  src={busy ? undefined : `${API}/api/projects/${project.id}/media`}
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
                <canvas ref={canvas} width={size.width} height={size.height} aria-label="Animated caption preview" />
                {busy && (
                  <div className="preview-processing">
                    <LoaderCircle size={18} className="spin" />
                    Captions are on their way
                  </div>
                )}
                {isDraggingOver && (
                  <div className="stage-drag-overlay">
                    <UploadCloud size={36} />
                    <span>Drop to import media</span>
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
                                    <span className="timeline-word-spotlight-badge" title="Spotlight Hero Keyword">⚡</span>
                                  ) : w.emphasis ? (
                                    <span className="timeline-word-star" title="Emphasized Keyword">★</span>
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

                        {/* Bottom Drag Strip */}
                        <div
                          className="timeline-group-drag-strip"
                          title="Drag sentence to move"
                          onMouseDown={(e) => startGroupDrag(e, g)}
                        >
                          <span className="drag-dots">············································</span>
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
      </main>
      <footer className="statusbar">
        <div
          className="statusbar-env"
          title={health ? (import.meta.env.DEV ? 'Local workspace' : 'Cloud workspace (Apex)') : (import.meta.env.DEV ? 'Waiting for local worker' : 'Connecting to cloud AI worker...')}
          aria-label={health ? (import.meta.env.DEV ? 'Local workspace' : 'Cloud workspace (Apex)') : (import.meta.env.DEV ? 'Waiting for local worker' : 'Connecting to cloud AI worker...')}
        >
          <span className={health ? 'status-dot' : 'status-dot offline'} />
        </div>
        <button
          type="button"
          className="statusbar-help-btn"
          title="Studio guide"
          aria-label="Studio guide"
          onClick={() => setModal('help')}
        >
          <CircleHelp size={14} />
        </button>
      </footer>
    </div>

    {notice&&<div className="toast" role="status"><CircleHelp size={18}/><span>{notice}</span><button className="icon-button tiny" aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {uploadProgress!==null&&<div className="upload-toast" role="status"><LoaderCircle className="spin" size={18}/>Uploading file… {uploadProgress}%</div>}
    {modal==='projects'&&<Modal title="Your workspace" onClose={()=>setModal(null)}><p className="modal-description">Projects are saved on this computer, ready whenever you are.</p><button className="button primary full" onClick={()=>{setModal(null);input.current?.click();}}><Plus size={16}/>New upload</button><div className="project-list">{projects.length?projects.map(p=><button key={p.id} onClick={()=>void openProject(p)}><span className="project-list-icon">{p.mediaType==='audio'?<FileAudio size={21}/>:<Film size={21}/>}</span><span><strong>{p.name}</strong><small>{timecode(p.duration)} · {p.status==='ready'?`${p.words?.length??0} words`:p.status}</small></span><ChevronRight size={17}/></button>):<div className="empty-projects"><FolderOpen size={32}/><p>Your first story is one upload away.</p></div>}</div></Modal>}
    {modal==='export'&&<Modal title="Ready for the spotlight?" onClose={()=>setModal(null)}><p className="modal-description">Your captions, animated exactly as you see them.</p><div className="export-options"><button className={exportMode==='burned'?'selected':''} onClick={()=>setExportMode('burned')}><MonitorPlay size={25}/><strong>{project?.mediaType==='audio'?'Caption video':'Captioned video'}</strong><span>MP4 with your audio</span>{exportMode==='burned'&&<Check size={15}/>}</button><button className={exportMode==='green'?'selected':''} onClick={()=>setExportMode('green')}><Layers size={25}/><strong>Green screen</strong><span>Silent MP4 for your editor</span>{exportMode==='green'&&<Check size={15}/>}</button></div><label className="export-resolution">Resolution<select value={resolution} onChange={e=>setResolution(Number(e.target.value))}><option value="720">720p · Faster export</option><option value="1080">1080p · Full HD</option></select></label><div className="export-detail"><span>H.264 · 30 fps</span><span>{project?`${dimensions(settings,project.width,project.height,resolution).width} × ${dimensions(settings,project.width,project.height,resolution).height}`:''}</span><span>No watermark</span></div>{exportMode==='green'&&<p className="export-note">Key out pure green (#00FF00) in Premiere, After Effects, or your editor. Pick a non-green highlight for a cleaner key.</p>}
      {hasExportRunning?<div className="export-progress"><div><LoaderCircle size={16} className="spin"/><span>{latestExport?.message||'Rendering your captions…'}</span><strong>{latestExport?.progress??0}%</strong></div><progress value={latestExport?.progress??0} max={100}/></div>:<button className="button primary full" onClick={()=>void startExport()} disabled={exporting||!project?.words.length}>{exporting?<LoaderCircle size={17} className="spin"/>:<Download size={17}/>}Export {exportMode==='green'?'green screen':'video'}</button>}
      {latestExport?.status==='error'&&<p className="error-message">{latestExport.message}</p>}
      {!!project?.exports?.filter(e=>e.status==='ready'||e.status==='complete').length&&<div className="export-downloads">{project.exports.filter(e=>e.status==='ready'||e.status==='complete').slice(-3).reverse().map(e=><a key={e.id} href={`${API}/api/projects/${project.id}/exports/${e.id}/download`} download><Check size={16}/><span>{e.mode==='green'?'Green screen':'Captioned video'}</span><Download size={16}/></a>)}</div>}
      <div className="subtitle-downloads"><span>Just need the words?</span><div><button onClick={()=>downloadTranscript('srt')}>.SRT</button><button onClick={()=>downloadTranscript('vtt')}>.VTT</button><button onClick={()=>downloadTranscript('json')}>Word timings .JSON</button></div></div></Modal>}
    {modal==='help'&&<Modal title="A little guide to Bol." onClose={()=>setModal(null)} wide><div className="guide-grid"><div><span className="guide-number">01</span><h3>Bring your story</h3><p>Upload a video or audio file. Choose Hindi + English for Hinglish and Roman to write “aap kaise ho” in Latin letters.</p></div><div><span className="guide-number">02</span><h3>Give it a once-over</h3><p>The local Hinglish recognizer times each word. Review names, slang, and spellings. Underlined words have lower model confidence.</p></div><div><span className="guide-number">03</span><h3>Find your emphasis</h3><p>Loudness, pitch, and duration suggest words to highlight. These are suggestions: click any word and toggle its star.</p></div><div><span className="guide-number">04</span><h3>Make some moves</h3><p>Pick a template, adjust color and motion, then export a captioned MP4, green-screen overlay, or subtitle file.</p></div></div><div className="guide-note"><MonitorPlay size={22}/><p><strong>Local by design.</strong> Your recordings stay here. The first transcription downloads the model; later runs use the cached copy. Roman spelling and timing can need corrections, especially with names, music, or overlapping voices.</p></div><div className="guide-shortcuts"><span><kbd>Space</kbd>Play / pause</span><span><kbd>⌘ / Ctrl + S</kbd>Save changes</span></div></Modal>}

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

          <button
            type="button"
            className={`word-menu-item ${
              selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                ? (Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.emphasis) ? 'active' : '')
                : (wordMenu.word.emphasis ? 'active' : '')
            }`}
            onClick={() => {
              if (selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)) {
                const allEmphasized = Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.emphasis);
                const next = !allEmphasized;
                updateWords(selectedWordIds, { emphasis: next, spotlight: false });
              } else {
                const next = !wordMenu.word.emphasis;
                updateWord(wordMenu.word.id, { emphasis: next, spotlight: false });
              }
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Zap size={18} fill={(selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id) ? Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.emphasis) : wordMenu.word.emphasis) ? 'currentColor' : 'none'} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Emphasize</span>
              <span className="word-menu-item-desc">
                {selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                  ? `Toggle star on ${selectedWordIds.size} words`
                  : 'Make this word stand out'}
              </span>
            </div>
          </button>

          <button
            type="button"
            className={`word-menu-item ${
              selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                ? (Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.spotlight) ? 'active' : '')
                : (wordMenu.word.spotlight ? 'active' : '')
            }`}
            onClick={() => {
              if (selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)) {
                const allSpotlight = Array.from(selectedWordIds).every(id => project?.words.find(w => w.id === id)?.spotlight);
                const next = !allSpotlight;
                updateWords(selectedWordIds, { spotlight: next, emphasis: false });
              } else {
                const next = !wordMenu.word.spotlight;
                updateWord(wordMenu.word.id, { spotlight: next, emphasis: false });
              }
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Scan size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Spotlight</span>
              <span className="word-menu-item-desc">
                {selectedWordIds.size > 1 && selectedWordIds.has(wordMenu.word.id)
                  ? `Feature ${selectedWordIds.size} words in spotlight`
                  : 'Feature for maximum impact'}
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
                className={`popover-icon-btn btn-emphasize ${timelinePopover.emphasis && !timelinePopover.spotlight ? 'active' : ''}`}
                title="Emphasize"
                aria-label="Emphasize"
                aria-pressed={timelinePopover.emphasis && !timelinePopover.spotlight}
                onClick={() => setWordHighlight('emphasize')}
              >
                <Star size={14} fill={timelinePopover.emphasis && !timelinePopover.spotlight ? 'currentColor' : 'none'} />
              </button>

              <button
                type="button"
                className={`popover-icon-btn btn-spotlight ${timelinePopover.spotlight ? 'active' : ''}`}
                title="Spotlight"
                aria-label="Spotlight"
                aria-pressed={timelinePopover.spotlight}
                onClick={() => setWordHighlight('spotlight')}
              >
                <Sparkles size={14} />
              </button>

              <button
                type="button"
                className={`popover-icon-btn btn-clear ${!timelinePopover.emphasis && !timelinePopover.spotlight ? 'active' : ''}`}
                title="Clear"
                aria-label="Clear highlight"
                aria-pressed={!timelinePopover.emphasis && !timelinePopover.spotlight}
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
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
