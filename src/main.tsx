import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Accessibility, ArrowDown, ArrowLeft, ArrowRight, AudioLines, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clapperboard, Download, Edit3, FileAudio, Film, FolderOpen, Headphones, Layers, LoaderCircle, Maximize2, MonitorPlay, MoreHorizontal, Pause, Pencil, Play, Plus, Redo2, Replace, RotateCcw, Rows2, Scan, Search, Settings2, Sparkles, Split, Star, Subtitles, Trash2, Type, Undo2, Upload, Volume2, VolumeX, WandSparkles, X, Zap } from 'lucide-react';
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
import { appendWord, dimensions, drawCaptions, getContrastColor, groupWords, insertWord, mergeLines, moveWordToNextLine, moveWordToPreviousLine, replaceAllOccurrences, splitLineAtWord, subtitleText, templates } from './lib/captions';

const timecode = (s: number) => `${Math.floor(Math.max(0,s)/60).toString().padStart(2,'0')}:${(Math.max(0,s)%60).toFixed(1).padStart(4,'0')}`;
type Health = { status?: string; engine?: string; model?: string; [key: string]: unknown };
type EditState = Pick<Project, 'words' | 'settings' | 'name' | 'videoEnabled'>;

function TemplatePreview({ id }: { id: string }) {
  if (id === 'kinetic') return <strong>BAWAL.</strong>;
  if (id === 'editorial') return <span>make it <b>matter.</b></span>;
  if (id === 'bounce') return <span>thoda <b>extra</b></span>;
  if (id === 'karaoke') return <span>apni <b>vibe</b> hai.</span>;
  if (id === 'neon') return <span>AFTER <b>HOURS</b></span>;
  if (id === 'glow-script') return <span>The <i>quick</i> <b>brown</b></span>;
  if (id === 'scribble') return <span><b>THE WORD</b><small>~ ~ ~</small></span>;
  if (id === 'welcome-stack') return <span>ab <b>ENGLISH</b><small>mein ye</small></span>;
  if (id === 'soft-focus') return <span>The <i>brown</i> fox</span>;
  if (id === 'double-trouble') return <span><b>THE QUICK</b><i>BROWN FOX</i></span>;
  if (id === 'bubble-highlight') return <span>The quick <b>brown</b> fox</span>;
  if (id === 'mumbai') return <span><b>THE QUICK</b><i>brown fox jumps</i></span>;
  if (id === 'editing-school') return <span><b>fox</b></span>;
  if (id === 'kalakar-shadow') return <span>Hello <b>WELCOME</b></span>;
  if (id === 'pop-up') return <span>WE DIDN'T <b>MAKE</b> MONEY</span>;
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
  const [dragging, setDragging] = useState(false);
  const [script, setScript] = useState('roman');
  const [language, setLanguage] = useState('auto');
  const [rightTab, setRightTab] = useState('templates');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
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
  function handleInsertWord(targetId: string, position: 'before' | 'after', text = 'word') {
    const p = projectRef.current; if (!p) return;
    const res = insertWord(p.words, targetId, position, text, duration);
    markEdit({ ...p, words: res.words });
    setSelectedWord(res.newWordId);
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
    seek(res.words.find(w => w.id === res.newWordId)?.start ?? 0);
    notify('Added new caption line.');
  }
  function handleDeleteWord(id: string) {
    const p = projectRef.current; if (!p) return;
    const updated = p.words.filter(w => w.id !== id);
    markEdit({ ...p, words: updated });
    if (selectedWord === id) setSelectedWord(null);
    notify('Word deleted.');
  }
  function handleDeleteLine(group: Word[]) {
    const p = projectRef.current; if (!p || !group.length) return;
    const ids = new Set(group.map(w => w.id));
    const updated = p.words.filter(w => !ids.has(w.id));
    markEdit({ ...p, words: updated });
    if (selectedWord && ids.has(selectedWord)) setSelectedWord(null);
    notify('Caption line deleted.');
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
  function handleAutoStar() {
    const p = projectRef.current; if (!p) return;
    const updated = p.words.map(w => {
      const clean = w.text.replace(/\W/g, '').toLowerCase();
      const hasNum = /\d/.test(w.text);
      const isHook = ['step', 'rule', 'secret', 'trick', 'hack', 'best', 'viral', 'bawal', 'sabse', 'bada', 'shandaar', 'important'].includes(clean) || hasNum;
      const isStop = ['ke', 'ki', 'ka', 'ko', 'se', 'mein', 'par', 'pe', 'ne', 'aur', 'ya', 'bhi', 'hi', 'to', 'the', 'a', 'an', 'and', 'of', 'in', 'on', 'at'].includes(clean);
      const shouldEmphasize = (w.emphasisScore >= 0.73 && !isStop) || (isHook && (w.emphasisScore || 0.6) >= 0.5);
      return { ...w, emphasis: shouldEmphasize };
    });
    markEdit({ ...p, words: updated });
    notify('Auto-suggested emphasis applied.');
  }
  function handleClearAllEmphasis() {
    const p = projectRef.current; if (!p) return;
    markEdit({ ...p, words: p.words.map(w => ({ ...w, emphasis: false, spotlight: false, behind: false })) });
    notify('Cleared all word emphasis.');
  }
  function commitInlineEdit() {
    if (!editingWordId) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      updateWord(editingWordId, { text: trimmed });
    }
    setEditingWordId(null);
  }
  function cancelInlineEdit() {
    setEditingWordId(null);
  }
  function handleWordClick(e: React.MouseEvent<HTMLButtonElement>, word: Word) {
    e.stopPropagation();
    setSelectedWord(word.id);
    seek(word.start);

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 280;
    const menuHeight = 440;
    let top = rect.bottom + 6;
    let left = rect.left;

    if (top + menuHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - menuHeight - 6);
    }
    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - menuWidth - 10);
    }

    setWordMenu({
      word,
      position: { top, left },
    });
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
        if (wordMenu) { setWordMenu(null); return; }
        if (captionToolsOpen) { setCaptionToolsOpen(false); return; }
        if (editingWordId) { setEditingWordId(null); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); void flushSave().catch(()=>{}); return; }
      if ((e.target as HTMLElement)?.closest('input, textarea, select, dialog, button, a, [contenteditable]')) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown',onKey); return () => window.removeEventListener('keydown',onKey);
  },[togglePlay,flushSave,wordMenu,captionToolsOpen,editingWordId]);

  async function importFile(file?: File) {
    if (!file || uploadProgress !== null) return;
    if (file.size > 1024*1024*1024) { notify('Choose a file smaller than 1 GB.'); return; }
    setUploadProgress(0); setPlaying(false); media.current?.pause();
    try {
      await flushSave();
      const result = await upload(file,script,language,setUploadProgress);
      result.name = file.name || result.filename || result.name;
      result.settings = result.settings || defaults; setProject(result); projectRef.current=result; setSettings(result.settings); setTime(0); setSelectedWord(null); setHistory([]); setFuture([]); setShowSearchBar(false); setCaptionToolsOpen(false); setSaveStatus('Saved locally');
      setProjects(list=>[result,...list.filter(p=>p.id!==result.id)]);
    } catch(e) { notify((e as Error).message); }
    finally { setUploadProgress(null); if(input.current) input.current.value=''; }
  }
  async function openProject(p: Project) {
    try { await flushSave(); const result=await request<Project>(`/projects/${p.id}`); const projectScript = result.script || 'roman'; const projectLanguage = result.language || 'auto'; const normalized = { ...result, script: projectScript, language: projectLanguage }; setPlaying(false); setTime(0); setProject(normalized); projectRef.current=normalized; setSettings(normalized.settings); setScript(projectScript); setLanguage(projectLanguage); setSelectedWord(null); setHistory([]); setFuture([]); setShowSearchBar(false); setCaptionToolsOpen(false); setModal(null); }
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
        {project && (
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
        )}
      </div>

      <div className="navbar-center">
        <button className="navbar-brand" onClick={() => setModal('projects')} title="Projects workspace" aria-label="Bol Studio - Projects workspace">
          <img src="/bol.studio.svg" alt="bol.studio" className="navbar-brand-logo" />
        </button>
      </div>

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
          className="nav-btn ghost"
          aria-label="Studio guide"
          title="Quick guide & shortcuts"
          onClick={() => setModal('help')}
        >
          <CircleHelp size={16} />
          <span>Guide</span>
        </button>
        <button
          className="nav-btn secondary"
          onClick={() => input.current?.click()}
          disabled={busy || uploadProgress !== null}
        >
          <Plus size={15} />
          <span>New</span>
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
        <section className="transcript-panel panel">
          <div className="captions-header">
            <div className="captions-header-left">
              <Subtitles size={16} />
              <h2 className="captions-title">Lyrics Editor</h2>
              {project?.words.length && !busy ? <span className="count">{project.words.length}</span> : null}
            </div>
            <div className="captions-header-right">
              {!!(project?.words.length && !busy) && (
                <>
                  <button
                    type="button"
                    className={`caption-search-btn ${showSearchBar ? 'active' : ''}`}
                    title="Search captions"
                    aria-label="Search captions"
                    onClick={() => setShowSearchBar(prev => !prev)}
                  >
                    <Search size={16} />
                  </button>
                  <div className="caption-tools-wrap">
                    <button
                      type="button"
                      className={`caption-sparkles-btn ${captionToolsOpen ? 'active' : ''}`}
                      title="Word emphasis (Magic star)"
                      aria-label="Word emphasis"
                      onClick={() => setCaptionToolsOpen(prev => !prev)}
                    >
                      <Sparkles size={16} />
                    </button>
                    {captionToolsOpen && (
                      <>
                        <div className="dropdown-backdrop" onClick={() => setCaptionToolsOpen(false)} />
                        <div className="caption-tools-dropdown">
                          <button
                            type="button"
                            className="caption-tools-item"
                            onClick={() => {
                              setCaptionToolsOpen(false);
                              handleAutoStar();
                            }}
                          >
                            <Sparkles size={14} />
                            <span>Auto Emphasize</span>
                          </button>
                          <button
                            type="button"
                            className="caption-tools-item"
                            onClick={() => {
                              setCaptionToolsOpen(false);
                              handleClearAllEmphasis();
                            }}
                          >
                            <RotateCcw size={14} />
                            <span>Clear All Stars</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {showSearchBar && !!(project?.words.length && !busy) && (
            <div className="caption-search-bar">
              <Search size={14} color="#6b7280" />
              <input
                autoFocus
                placeholder="Search words..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
              <button
                type="button"
                className="caption-search-replace-btn"
                title="Find & Replace all"
                onClick={() => {
                  setSearchFindText(searchQuery);
                  setSearchReplaceText('');
                  setModal('search-replace');
                }}
              >
                <Replace size={13} />
                <span>Replace</span>
              </button>
            </div>
          )}

              <div className={`transcript-content ${!project ? 'empty-content' : ''}`}>
                {!project && (
                  <>
                    <div
                      className={`upload-card ${dragging ? 'dragging' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => { e.preventDefault(); setDragging(false); void importFile(e.dataTransfer.files[0]); }}
                    >
                      <div className="upload-symbol"><Upload size={27} /><span><Sparkles size={12} /></span></div>
                      <h2>Drop it. Caption it.</h2>
                      <p>Your video, your voice.<br />We’ll find the right words.</p>
                      <button className="button primary full" onClick={() => input.current?.click()} disabled={uploadProgress !== null}>
                        {uploadProgress !== null ? <><LoaderCircle className="spin" size={16} />Uploading {uploadProgress}%</> : <>Choose a file <ArrowRight size={16} /></>}
                      </button>
                      <span className="upload-formats">MP4, MOV, MP3, WAV + more<br />Up to 1 GB · 20 minutes</span>
                    </div>
                    <div className="upload-preferences">
                      <label>Spoken language
                        <select value={language} onChange={e => setLanguage(e.target.value)}>
                          <option value="auto">Hindi + English · Auto</option>
                          <option value="hi">Hindi + English</option>
                          <option value="en">English</option>
                        </select>
                      </label>
                      <label>Write captions in
                        <select value={script} onChange={e => setScript(e.target.value)}>
                          <option value="roman">Hinglish · Roman</option>
                          <option value="native">Hindi · Devanagari</option>
                        </select>
                      </label>
                    </div>
                    <div className="privacy-note"><MonitorPlay size={17} /><span>Your files stay on your computer.<br />No subscription. No watermark.</span></div>
                  </>
                )}
                {project && busy && (
                  <div className="processing-state">
                    <div className="processing-orb"><AudioLines size={32} /></div>
                    <h2>Listening to your story</h2>
                    <p>{project.message || 'Preparing your audio…'}</p>
                    <progress value={project.progress} max={100} />
                    <span>{project.progress}%</span>
                    <div className="process-steps">
                      <span className="done"><Check size={14} />Upload complete</span>
                      <span><LoaderCircle size={14} className="spin" />Transcribing & timing words</span>
                      <span><Sparkles size={14} />Finding words to emphasize</span>
                    </div>
                    <small>The first run loads the speech model. Longer files take more time.</small>
                  </div>
                )}
                {project && !busy && project.status === 'error' && (
                  <div className="processing-state error-state">
                    <CircleHelp size={28} />
                    <h2>Let’s try that again</h2>
                    <p>{project.message}</p>
                    <button className="button primary" onClick={() => void retryTranscription()}>
                      <RotateCcw size={16} /> Retry transcription
                    </button>
                  </div>
                )}
                {project && !busy && project.status !== 'error' && (!project.words.length ? (
                  <div className="processing-state">
                    <AudioLines size={30} />
                    <h2>No speech found</h2>
                    <p>Try a recording with a clearer voice, or write captions manually.</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button className="button secondary" onClick={() => input.current?.click()}>Choose another file</button>
                      <button className="button primary" onClick={handleAddNewLine}>
                        <Plus size={15} /> Add line manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="caption-rows-list">
                    {filteredGroups.length === 0 && searchQuery ? (
                      <div className="lyrics-empty-search">No words matching "{searchQuery}"</div>
                    ) : (
                      <>
                        {filteredGroups.map((group, groupIdx) => {
                          const isCurrentGroup = time >= group[0].start && time <= group.at(-1)!.end;
                          return (
                            <div key={group[0].id} className={`caption-row ${isCurrentGroup ? 'is-current' : ''}`}>
                              <div className="caption-row-left">
                                <div className="caption-num-pill">{groupIdx + 1}</div>
                                <div className="caption-row-words">
                                  {group.map(word => {
                                    const isEditing = editingWordId === word.id;
                                    const isMenuOpen = wordMenu?.word.id === word.id;
                                    const isSpeaking = activeWord?.id === word.id;

                                    if (isEditing) {
                                      return (
                                        <input
                                          key={word.id}
                                          autoFocus
                                          className="word-inline-input"
                                          value={editingText}
                                          onChange={e => setEditingText(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') commitInlineEdit();
                                            else if (e.key === 'Escape') cancelInlineEdit();
                                          }}
                                          onBlur={commitInlineEdit}
                                        />
                                      );
                                    }

                                    return (
                                      <button
                                        key={word.id}
                                        type="button"
                                        className={`caption-word-btn ${word.emphasis ? 'is-emphasized' : ''} ${word.spotlight ? 'is-spotlight' : ''} ${word.behind ? 'is-behind' : ''} ${isMenuOpen ? 'is-menu-open' : ''} ${isSpeaking ? 'is-active-word' : ''}`}
                                        onClick={e => handleWordClick(e, word)}
                                        title={`Click to customize "${word.text}"`}
                                      >
                                        {word.text}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="caption-row-actions">
                                <button
                                  type="button"
                                  className="caption-row-action-btn"
                                  title="Play this caption line"
                                  aria-label="Play caption line"
                                  onClick={() => playInterval(group[0].start, group.at(-1)!.end)}
                                >
                                  <Accessibility size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="caption-row-action-btn"
                                  title="Split caption line"
                                  aria-label="Split line"
                                  onClick={() => {
                                    const targetWord = group[Math.floor((group.length - 1) / 2)];
                                    handleSplitLine(targetWord.id);
                                  }}
                                >
                                  <Rows2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {!searchQuery && (
                          <button
                            type="button"
                            className="caption-add-line-btn"
                            onClick={handleAddNewLine}
                          >
                            <Plus size={14} />
                            <span>Add line</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {selected && !busy ? (
                <div className="word-inspector">
                  <div className="inspector-heading">
                    <span>TIMING &amp; FINE-TUNE</span>
                    <div className="lyrics-card-meta">
                      <span className="inspector-heading-sub">{(selected.end - selected.start).toFixed(2)}s</span>
                      <button
                        type="button"
                        className="icon-button tiny"
                        aria-label="Close word inspector"
                        onClick={() => setSelectedWord(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="timing-grid">
                    <div className="timing-field">
                      <div className="timing-field-label">
                        <span>START</span>
                        <span>{selected.start.toFixed(2)}s</span>
                      </div>
                      <div className="timing-stepper">
                        <button
                          type="button"
                          className="nudge-btn"
                          title="Nudge start -0.05s"
                          onClick={() => handleNudgeWordTiming(selected, 'start', -0.05)}
                        >
                          -0.05
                        </button>
                        <input
                          aria-label="Word start time"
                          type="number"
                          step="0.01"
                          key={`${selected.id}-start-${selected.start}`}
                          defaultValue={selected.start.toFixed(2)}
                          onBlur={e => changeTiming(selected, 'start', Number(e.target.value))}
                        />
                        <button
                          type="button"
                          className="nudge-btn"
                          title="Nudge start +0.05s"
                          onClick={() => handleNudgeWordTiming(selected, 'start', 0.05)}
                        >
                          +0.05
                        </button>
                      </div>
                    </div>
                    <div className="timing-field">
                      <div className="timing-field-label">
                        <span>END</span>
                        <span>{selected.end.toFixed(2)}s</span>
                      </div>
                      <div className="timing-stepper">
                        <button
                          type="button"
                          className="nudge-btn"
                          title="Nudge end -0.05s"
                          onClick={() => handleNudgeWordTiming(selected, 'end', -0.05)}
                        >
                          -0.05
                        </button>
                        <input
                          aria-label="Word end time"
                          type="number"
                          step="0.01"
                          key={`${selected.id}-end-${selected.end}`}
                          defaultValue={selected.end.toFixed(2)}
                          onBlur={e => changeTiming(selected, 'end', Number(e.target.value))}
                        />
                        <button
                          type="button"
                          className="nudge-btn"
                          title="Nudge end +0.05s"
                          onClick={() => handleNudgeWordTiming(selected, 'end', 0.05)}
                        >
                          +0.05
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
        </section>

        <section className="preview-panel">
          <div className="preview-toolbar"><div><span className="section-label">PREVIEW</span></div>{project&&<div className="preview-tools">{hasVideoLayer&&!busy&&<button className={`media-toggle ${videoEnabled?'':'removed'}`} aria-pressed={videoEnabled} aria-label={videoEnabled?'Remove video layer':'Restore video layer'} onClick={()=>setVideoEnabled(!videoEnabled)}>{videoEnabled?<Trash2 size={13}/>:<RotateCcw size={13}/>}<span>{videoEnabled?'Remove video':'Restore video'}</span></button>}<select aria-label="Video aspect ratio" value={settings.aspect} onChange={e=>updateSettings({aspect:e.target.value as Settings['aspect']})} disabled={busy}><option value="original">Original</option><option value="9:16">9:16 · Reel</option><option value="1:1">1:1 · Square</option><option value="16:9">16:9 · Landscape</option></select><button className="icon-button tiny" aria-label="Fullscreen preview" onClick={()=>void preview.current?.requestFullscreen().catch(()=>notify('Fullscreen is unavailable in this browser.'))}><Maximize2 size={15}/></button></div>}</div>
          <div className="preview-stage"><div ref={preview} className={`video-frame ${!project?'empty-frame':''} ${hasVideoLayer&&!videoEnabled?'video-removed':''}`} style={{aspectRatio:`${size.width}/${size.height}`}}>
            {project?<video ref={media} className={project.mediaType==='audio'||(hasVideoLayer&&!videoEnabled)?'audio-media':''} key={`${project.id}-${busy?'processing':'ready'}-${videoEnabled?'video':'audio'}`} src={busy?undefined:`${API}/api/projects/${project.id}/media`} playsInline preload="metadata" muted={muted} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onSeeked={()=>setTime(media.current?.currentTime??0)} onError={()=>notify('The preview could not load. The file may still be processing.')}/>:null}
            {project?.mediaType==='audio'&&<div className="audio-backdrop"><AudioLines size={48}/><span>AUDIO PROJECT</span></div>}
            {project&&<canvas ref={canvas} width={size.width} height={size.height} aria-label="Animated caption preview"/>}
            {busy&&<div className="preview-processing"><LoaderCircle size={18} className="spin"/>Captions are on their way</div>}
          </div></div>
          <div className="playback-controls"><button className="icon-button" aria-label={muted?'Unmute':'Mute'} onClick={()=>setMuted(!muted)} disabled={!project}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><div className="transport"><button className="icon-button" aria-label="Back three seconds" onClick={()=>seek(time-3)} disabled={!project}><ChevronLeft size={21}/></button><button className="play-button" aria-label={playing?'Pause':'Play'} onClick={togglePlay} disabled={!project}>{playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button><button className="icon-button" aria-label="Forward three seconds" onClick={()=>seek(time+3)} disabled={!project}><ChevronRight size={21}/></button></div><span className="playback-time">{timecode(time)} <span>/ {timecode(duration)}</span></span></div>
          <div className="timeline"><div className="timeline-ruler">{Array.from({length:7},(_,i)=><span key={i}>{timecode(duration?duration*i/6:0)}</span>)}</div><div className="waveform-track"><div className="waveform" aria-hidden="true">{(project?.waveform?.length?project.waveform:[]).map((v,i)=><i key={i} style={{height:`${Math.max(8,v*100)}%`,opacity:i/((project?.waveform?.length)||1)<=time/(duration||1)?1:.35}}/>)}</div><input aria-label="Playback position" type="range" min="0" max={duration||1} step="0.01" value={time} onChange={e=>seek(Number(e.target.value))} disabled={!project}/><div className="playhead" style={{left:`${duration?(time/duration*100):0}%`,display:project?'':'none'}}><span/></div></div>{project&&groups.length>0&&<div className="caption-track">{groups.map(g=><button aria-label={`Jump to ${g.map(w=>w.text).join(' ')}`} key={g[0].id} onClick={()=>seek(g[0].start)} style={{left:`${duration?(g[0].start/duration*100):0}%`,width:`${Math.max(.5,(g.at(-1)!.end-g[0].start)/(duration||1)*100)}%`}}>{g.map(w=>w.text).join(' ')}</button>)}</div>}</div>
          <div className="preview-foot"><span><span className="keyboard-key">space</span> play / pause</span><span>{project?`${project.words.length} words · 30 fps export`:''}</span></div>
        </section>

        <section className="style-panel panel">
          <div className="panel-tabs">
            <button className={rightTab === 'templates' ? 'active' : ''} onClick={() => setRightTab('templates')}>
              <Layers size={16} /> Templates
            </button>
            <button className={rightTab === 'customize' ? 'active' : ''} onClick={() => setRightTab('customize')}>
              <Settings2 size={16} /> Caption Settings
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
              <strong>Word-by-word spotlight</strong>
              <p>Star any word in the Lyrics Editor to highlight it with the accent color. The entire sentence stays visible while words come alive.</p>
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
    {uploadProgress!==null&&project&&<div className="upload-toast" role="status"><LoaderCircle className="spin" size={18}/>Uploading new file… {uploadProgress}%</div>}
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
          <button
            type="button"
            className={`word-menu-item ${wordMenu.word.emphasis ? 'active' : ''}`}
            onClick={() => {
              updateWord(wordMenu.word.id, { emphasis: !wordMenu.word.emphasis });
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Zap size={18} fill={wordMenu.word.emphasis ? 'currentColor' : 'none'} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Emphasize</span>
              <span className="word-menu-item-desc">Make this word stand out</span>
            </div>
          </button>

          <button
            type="button"
            className={`word-menu-item ${wordMenu.word.spotlight ? 'active' : ''}`}
            onClick={() => {
              const next = !wordMenu.word.spotlight;
              updateWord(wordMenu.word.id, { spotlight: next, emphasis: next || wordMenu.word.emphasis });
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Scan size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Spotlight</span>
              <span className="word-menu-item-desc">Feature for maximum impact</span>
            </div>
          </button>

          <button
            type="button"
            className={`word-menu-item ${wordMenu.word.behind ? 'active' : ''}`}
            onClick={() => {
              updateWord(wordMenu.word.id, { behind: !wordMenu.word.behind });
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Accessibility size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Send Behind</span>
              <span className="word-menu-item-desc">Move this word behind the subject</span>
            </div>
          </button>

          <hr className="word-menu-divider" />

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

          <button
            type="button"
            className="word-menu-item"
            onClick={() => {
              handleMoveToPreviousLine(wordMenu.word.id);
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
              handleMoveToNextLine(wordMenu.word.id);
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
              handleDeleteWord(wordMenu.word.id);
              setWordMenu(null);
            }}
          >
            <div className="word-menu-item-icon">
              <Trash2 size={18} />
            </div>
            <div className="word-menu-item-content">
              <span className="word-menu-item-title">Delete</span>
              <span className="word-menu-item-desc">Remove this word</span>
            </div>
          </button>
        </div>
      </>
    )}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
