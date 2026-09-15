import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Captions,
  Sparkles,
  Plus,
  Search,
  Trash2,
  MoreVertical,
  Check,
  Copy,
  Download,
  RefreshCw,
  Play,
  Pause,
  Scissors,
  GitMerge,
  CopyPlus,
  Edit3,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Type,
} from 'lucide-react';
import type { MediaAsset, Project, Settings, Word } from '../lib/types';
import { MAX_WORDS_PER_PAGE } from '../lib/pages';
import { groupWords } from '../lib/pages';

interface WordSnapshot {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  midX: number;
  midY: number;
}

interface RowSnapshot {
  groupIdx: number;
  rowTop: number;
  rowBottom: number;
  words: WordSnapshot[];
  visualLines: WordSnapshot[][];
}

interface CaptionsPanelProps {
  project: Project | null;
  projectAssets: MediaAsset[];
  activeMediaAsset: MediaAsset | null;
  time: number;
  playing: boolean;
  groups: Word[][];
  settings: Settings;
  selectedWord: string | null;
  selectedWordIds: Set<string>;
  duration: number;
  busy: boolean;
  onSelectWord: (wordId: string, e?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => void;
  onSeek: (time: number) => void;
  onTogglePlay?: () => void;
  onUpdateSettings: (update: Partial<Settings>) => void;
  onUpdateWord: (id: string, update: Partial<Word>) => void;
  onUpdateWords: (ids: string[] | Set<string>, update: Partial<Word>) => void;
  onDeleteWord?: (id: string) => void;
  onDeleteWords?: (ids: string[] | Set<string>) => void;
  onDeleteGroup: (group: Word[]) => void;
  onSplitGroup: (group: Word[], wordIndex?: number) => void;
  onSplitLine?: (wordId: string) => void;
  onMergeGroups: (sourceGroupIdx: number, targetGroupIdx: number) => void;
  onMoveToPreviousLine?: (wordId: string) => void;
  onMoveToNextLine?: (wordId: string) => void;
  onDropWord?: (
    sourceWordId: string,
    targetGroupIdx: number,
    targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' }
  ) => void;
  onDropWords?: (
    sourceWordIds: string[],
    targetGroupIdx: number,
    targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' }
  ) => void;
  onDuplicateGroup: (group: Word[]) => void;
  onAddCaptionAtTime: (time: number) => void;
  onEditCaptionGroup: (groupIdx: number, newText: string, newStart: number, newEnd: number) => void;
  onClearAllCaptions: () => void;
  onRegenerateCaptions: (sourceAssetId?: string, script?: string, language?: string, glossary?: string[], isolateVocals?: boolean) => Promise<void>;
  onStartTranscription: (
    sourceAssetId: string | null,
    script: string,
    language: string,
    options: {
      autoPunctuation: boolean;
      filterFiller: boolean;
      multiSpeaker: boolean;
      wordsPerLine: number;
      glossary?: string[];
      isolateVocals?: boolean;
      maxLines: number;
    }
  ) => Promise<void>;
  onCancelTranscription?: () => void;
  onGoToMedia: () => void;
  onBrowseTemplates?: () => void;
  notify: (msg: string) => void;
  downloadTranscript: (format: 'srt' | 'vtt' | 'json') => void;
}

// Helpers for formatted timecodes (e.g. 00:02.8)
function formatTimecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const mins = Math.floor(s / 60);
  const secs = (s % 60).toFixed(1);
  const formattedSecs = (s % 60) < 10 ? `0${secs}` : secs;
  return `${String(mins).padStart(2, '0')}:${formattedSecs}`;
}

function parseTimecode(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const m = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0) {
        return Number((m * 60 + s).toFixed(3));
      }
    }
  } else {
    const s = parseFloat(trimmed);
    if (!isNaN(s) && s >= 0) {
      return Number(s.toFixed(3));
    }
  }
  return null;
}

export const CaptionsPanel: React.FC<CaptionsPanelProps> = ({
  project,
  projectAssets,
  activeMediaAsset,
  time,
  playing,
  groups,
  settings,
  selectedWord,
  selectedWordIds,
  duration,
  busy,
  onSelectWord,
  onSeek,
  onTogglePlay,
  onUpdateWord,
  onUpdateWords,
  onDeleteWord,
  onDeleteGroup,
  onSplitGroup,
  onSplitLine,
  onMergeGroups,
  onDropWord,
  onDropWords,
  onDuplicateGroup,
  onAddCaptionAtTime,
  onEditCaptionGroup,
  onClearAllCaptions,
  onRegenerateCaptions,
  onStartTranscription,
  onCancelTranscription,
  onGoToMedia,
  notify,
  downloadTranscript,
}) => {
  // Panel view modes: 'empty' | 'generate' | 'generating' | 'editor'
  const hasCaptions = groups.length > 0;
  const isGenerating = busy && project && ['queued', 'processing', 'transcribing', 'extracting'].includes(project.status);

  const [panelViewOverride, setPanelViewOverride] = useState<'empty' | 'generate' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'highlighted' | 'edited'>('all');
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [activeRowMenuIdx, setActiveRowMenuIdx] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'regenerate-confirm' | 'clear-confirm' | null>(null);

  // Generation form state
  const compatibleAssets = useMemo(() => {
    return projectAssets.filter(a => a.mediaType === 'video' || a.mediaType === 'audio');
  }, [projectAssets]);

  const [selectedSourceId, setSelectedSourceId] = useState<string>(() => {
    if (activeMediaAsset?.id) return activeMediaAsset.id;
    if (compatibleAssets.length > 0) return compatibleAssets[0].id;
    return 'primary';
  });

  const [spokenLang, setSpokenLang] = useState<'auto' | 'hi' | 'en'>('auto');
  // Brand names, handles and domains the recogniser cannot know. Seeded from
  // the project so they survive a re-run.
  const [brandWords, setBrandWords] = useState((project?.glossary ?? []).join(', '));
  const [isolateVocals, setIsolateVocals] = useState(!!project?.isolateVocals);
  const [captionScript, setCaptionScript] = useState<'roman' | 'native' | 'en' | 'same'>('roman');
  const [autoPunctuation, setAutoPunctuation] = useState(true);
  const [filterFiller, setFilterFiller] = useState(false);
  const [multiSpeaker, setMultiSpeaker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [wordsPerCaption, setWordsPerCaption] = useState(Math.min(settings.wordsPerLine || 5, MAX_WORDS_PER_PAGE));
  const [maxLines, setMaxLines] = useState(2);
  const [autoSplit, setAutoSplit] = useState(true);

  // Inline group editing state
  const [editingGroupIdx, setEditingGroupIdx] = useState<number | null>(null);
  const [draftGroupText, setDraftGroupText] = useState('');
  const [draftGroupStart, setDraftGroupStart] = useState('');
  const [draftGroupEnd, setDraftGroupEnd] = useState('');
  const [groupTimeError, setGroupTimeError] = useState('');

  // Inline word text editing state (double-click on word)
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingWordText, setEditingWordText] = useState('');
  const wordInputRef = useRef<HTMLInputElement | null>(null);

  // Contextual word inspector popover state (single-click on word)
  const [wordPopover, setWordPopover] = useState<{
    word: Word;
    position: { top: number; left: number };
    draftText: string;
  } | null>(null);
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const wordPopoverRef = useRef<HTMLDivElement | null>(null);
  const popoverWordInputRef = useRef<HTMLInputElement | null>(null);

  // Drag and drop state for word chips
  const [draggingWordIds, setDraggingWordIds] = useState<string[] | null>(null);
  const draggingWordIdsRef = useRef<string[] | null>(null);
  const layoutSnapshotRef = useRef<RowSnapshot[] | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<string>('');
  const [dropTarget, setDropTarget] = useState<{
    groupIdx: number;
    targetWordId?: string;
    insert: 'before' | 'after';
    isLineEnd?: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);

  // Global listener for dragend to cleanly clear dragging states if dropped outside or cancelled
  useEffect(() => {
    if (!draggingWordIds) return;
    const handleGlobalDragEnd = () => {
      layoutSnapshotRef.current = null;
      draggingWordIdsRef.current = null;
      setDraggingWordIds(null);
      setDraggingLabel('');
      setDropTarget(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => window.removeEventListener('dragend', handleGlobalDragEnd);
  }, [draggingWordIds]);

  // Auto-scroll ref & user scroll tracking
  const listContainerRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const userScrolledRecentRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine active view mode
  const currentView: 'empty' | 'generate' | 'generating' | 'editor' = useMemo(() => {
    if (isGenerating) return 'generating';
    if (panelViewOverride === 'generate') return 'generate';
    if (!hasCaptions) return 'empty';
    return 'editor';
  }, [isGenerating, panelViewOverride, hasCaptions]);

  // Sync selected source when compatible assets change
  useEffect(() => {
    if (compatibleAssets.length > 0 && !compatibleAssets.some(a => a.id === selectedSourceId)) {
      setSelectedSourceId(compatibleAssets[0].id);
    }
  }, [compatibleAssets, selectedSourceId]);

  // Click outside to close menus and popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setPanelMenuOpen(false);
      }
      if (activeRowMenuIdx !== null) {
        const rowMenuWrap = document.querySelector('.caption-row-menu-wrap');
        if (rowMenuWrap && !rowMenuWrap.contains(target)) {
          setActiveRowMenuIdx(null);
        }
      }
      if (wordPopoverRef.current && !wordPopoverRef.current.contains(target)) {
        if (!(e.target as HTMLElement).closest('.caption-word-chip')) {
          setWordPopover(null);
          setCaseMenuOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeRowMenuIdx]);

  // Active spoken group during playback
  const activeGroupIdx = useMemo(() => {
    return groups.findIndex(g => {
      const gStart = g[0]?.start ?? 0;
      const gEnd = (g[g.length - 1]?.end ?? 0) + 0.08;
      return time >= gStart && time < gEnd;
    });
  }, [groups, time]);

  const panelRef = useRef<HTMLElement | null>(null);

  // Keep outer panel pegged at scroll top 0 so inner flexbox governs scrolling
  useEffect(() => {
    if (panelRef.current && panelRef.current.scrollTop > 0) {
      panelRef.current.scrollTop = 0;
    }
  });

  // Handle user manual scroll
  const handleContainerScroll = () => {
    if (wordPopover) {
      setWordPopover(null);
      setCaseMenuOpen(false);
    }
    userScrolledRecentRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      userScrolledRecentRef.current = false;
    }, 2800);
  };

  // Smoothly scroll active group into view during playback (strictly within list container)
  useEffect(() => {
    if (playing && activeGroupIdx !== -1 && activeRowRef.current && listContainerRef.current) {
      if (userScrolledRecentRef.current) return;
      const container = listContainerRef.current;
      const row = activeRowRef.current;
      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      if (rowRect.top < containerRect.top + 8) {
        const delta = rowRect.top - containerRect.top - 12;
        container.scrollBy({ top: delta, behavior: 'smooth' });
      } else if (rowRect.bottom > containerRect.bottom - 8) {
        const delta = rowRect.bottom - containerRect.bottom + 16;
        container.scrollBy({ top: delta, behavior: 'smooth' });
      }
    }
  }, [activeGroupIdx, playing]);

  // Synchronize popover word object when project words update
  useEffect(() => {
    if (selectedWord && project) {
      const found = project.words.find(w => w.id === selectedWord);
      if (found && wordPopover && (wordPopover.word.id !== found.id || wordPopover.word.text !== found.text || wordPopover.word.emphasis !== found.emphasis || wordPopover.word.spotlight !== found.spotlight)) {
        setWordPopover(p => p ? {
          ...p,
          word: found,
          draftText: found.text,
        } : null);
      }
    }
  }, [selectedWord, project, wordPopover]);

  // Filtered and searched caption groups
  const searchResults = useMemo(() => {
    let list = groups.map((g, idx) => ({ group: g, idx }));

    if (activeFilter === 'highlighted') {
      list = list.filter(({ group }) => group.some(w => w.spotlight));
    } else if (activeFilter === 'edited') {
      list = list.filter(({ group }) => group.some(w => w.text !== w.original));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(({ group }) =>
        group.some(w => w.text.toLowerCase().includes(q)) ||
        group.map(w => w.text).join(' ').toLowerCase().includes(q)
      );
    }

    return list;
  }, [groups, searchQuery, activeFilter]);

  // Selected group index based on selectedWord
  const selectedGroupIdx = useMemo(() => {
    if (!selectedWord) return -1;
    return groups.findIndex(g => g.some(w => w.id === selectedWord));
  }, [groups, selectedWord]);

  // Start inline editing of entire group
  const startInlineGroupEdit = useCallback((idx: number) => {
    if (idx < 0 || idx >= groups.length) return;
    const g = groups[idx];
    setEditingGroupIdx(idx);
    setDraftGroupText(g.map(w => w.text).join(' '));
    setDraftGroupStart(formatTimecode(g[0].start));
    setDraftGroupEnd(formatTimecode(g[g.length - 1].end));
    setGroupTimeError('');
    setActiveRowMenuIdx(null);
    setWordPopover(null);
  }, [groups]);

  // Commit inline group edit
  const commitInlineGroupEdit = useCallback(() => {
    if (editingGroupIdx === null || editingGroupIdx < 0 || editingGroupIdx >= groups.length) return;
    const parsedStart = parseTimecode(draftGroupStart);
    const parsedEnd = parseTimecode(draftGroupEnd);

    if (parsedStart === null || parsedEnd === null) {
      setGroupTimeError('Invalid time format (use mm:ss.s or ss.s)');
      return;
    }
    if (parsedEnd <= parsedStart) {
      setGroupTimeError('End time must be greater than start time');
      return;
    }

    onEditCaptionGroup(editingGroupIdx, draftGroupText.trim(), parsedStart, parsedEnd);
    setEditingGroupIdx(null);
    setGroupTimeError('');
    notify('Caption updated');
  }, [editingGroupIdx, groups.length, draftGroupStart, draftGroupEnd, draftGroupText, onEditCaptionGroup, notify]);

  const cancelInlineGroupEdit = useCallback(() => {
    setEditingGroupIdx(null);
    setGroupTimeError('');
  }, []);

  // Word Chip Single Click -> select, seek, open contextual inspector popover
  const handleWordClick = (e: React.MouseEvent, w: Word) => {
    if (justDraggedRef.current) return;
    e.stopPropagation();
    onSelectWord(w.id, e);
    onSeek(w.start);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const popoverWidth = 250;
    const popoverHeight = 115;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, left));

    let top = rect.bottom + 8;
    if (top + popoverHeight > window.innerHeight - 12) {
      top = Math.max(10, rect.top - popoverHeight - 8);
    }

    setWordPopover({
      word: w,
      position: { top, left },
      draftText: w.text,
    });
    setCaseMenuOpen(false);
  };

  // Word Chip Double Click -> enter inline text edit mode
  const handleWordDoubleClick = (e: React.MouseEvent, w: Word) => {
    e.stopPropagation();
    setWordPopover(null);
    setEditingWordId(w.id);
    setEditingWordText(w.text);
    setTimeout(() => {
      wordInputRef.current?.focus();
      wordInputRef.current?.select();
    }, 20);
  };

  const commitWordEdit = (wordId: string) => {
    const trimmed = editingWordText.trim();
    if (trimmed && project) {
      const orig = project.words.find(w => w.id === wordId);
      if (orig && orig.text !== trimmed) {
        onUpdateWord(wordId, { text: trimmed });
        notify(`Updated word: "${trimmed}"`);
      }
    }
    setEditingWordId(null);
    setEditingWordText('');
  };

  const cancelWordEdit = () => {
    setEditingWordId(null);
    setEditingWordText('');
  };

  // Capture static geometry snapshot of rows and words before layout changes/animations
  const takeLayoutSnapshot = useCallback((): RowSnapshot[] => {
    const container = listContainerRef.current;
    if (!container) return [];

    const containerRect = container.getBoundingClientRect();
    const rowEls = Array.from(container.querySelectorAll<HTMLElement>('.caption-row.compact-card'));

    return rowEls.map((rowEl, rowIdx) => {
      const rowRect = rowEl.getBoundingClientRect();
      const chipsContainer = rowEl.querySelector('.caption-card-chips');
      const wordEls = chipsContainer
        ? Array.from(chipsContainer.querySelectorAll<HTMLElement>('.caption-word-chip-wrapper'))
        : [];

      const words: WordSnapshot[] = wordEls
        .map(wEl => {
          const rect = wEl.getBoundingClientRect();
          const left = rect.left - containerRect.left + container.scrollLeft;
          const right = rect.right - containerRect.left + container.scrollLeft;
          const top = rect.top - containerRect.top + container.scrollTop;
          const bottom = rect.bottom - containerRect.top + container.scrollTop;
          return {
            id: wEl.getAttribute('data-word-id') || '',
            left,
            right,
            top,
            bottom,
            midX: (left + right) / 2,
            midY: (top + bottom) / 2,
          };
        })
        .filter(w => Boolean(w.id));

      // Group words into visual lines by vertical midY
      const visualLines: WordSnapshot[][] = [];
      let currentLine: WordSnapshot[] = [];
      for (const w of words) {
        if (currentLine.length === 0) {
          currentLine.push(w);
        } else {
          const lineMidY = currentLine.reduce((acc, x) => acc + x.midY, 0) / currentLine.length;
          if (Math.abs(w.midY - lineMidY) < 18) {
            currentLine.push(w);
          } else {
            visualLines.push(currentLine);
            currentLine = [w];
          }
        }
      }
      if (currentLine.length > 0) visualLines.push(currentLine);

      const parsedIdx = rowEl.getAttribute('data-group-idx');
      const groupIdx = parsedIdx !== null ? parseInt(parsedIdx, 10) : rowIdx;

      return {
        groupIdx,
        rowTop: rowRect.top - containerRect.top + container.scrollTop,
        rowBottom: rowRect.bottom - containerRect.top + container.scrollTop,
        words,
        visualLines,
      };
    });
  }, []);

  // Pure geometry calculator: matches cursor coordinates against static snapshot
  const getDropTargetFromSnapshot = useCallback((
    clientX: number,
    clientY: number,
    movingIds: string[],
    currentDropTarget: { groupIdx: number; targetWordId?: string; insert: 'before' | 'after'; isLineEnd?: boolean } | null
  ): { groupIdx: number; targetWordId?: string; insert: 'before' | 'after'; isLineEnd?: boolean } | null => {
    let snapshots = layoutSnapshotRef.current;
    if (!snapshots || snapshots.length === 0) {
      snapshots = takeLayoutSnapshot();
      layoutSnapshotRef.current = snapshots;
    }
    const container = listContainerRef.current;
    if (!snapshots || snapshots.length === 0 || !container) return null;

    const containerRect = container.getBoundingClientRect();
    const relX = clientX - containerRect.left + container.scrollLeft;
    const relY = clientY - containerRect.top + container.scrollTop;

    // 1. Find which row the cursor is over vertically (with 12px hysteresis for active row)
    let targetRow: RowSnapshot | undefined;
    if (currentDropTarget) {
      const activeRow = snapshots.find(r => r.groupIdx === currentDropTarget.groupIdx);
      if (activeRow && relY >= activeRow.rowTop - 12 && relY <= activeRow.rowBottom + 12) {
        targetRow = activeRow;
      }
    }

    if (!targetRow) {
      targetRow = snapshots.find(
        r => relY >= r.rowTop - 4 && relY <= r.rowBottom + 4
      );
    }

    if (!targetRow) {
      let bestDist = Infinity;
      for (const r of snapshots) {
        const rowMidY = (r.rowTop + r.rowBottom) / 2;
        const dist = Math.abs(relY - rowMidY);
        if (dist < bestDist) {
          bestDist = dist;
          targetRow = r;
        }
      }
    }

    if (!targetRow) return null;

    const groupIdx = targetRow.groupIdx;
    const nonMovingWords = targetRow.words.filter(w => !movingIds.includes(w.id));
    if (nonMovingWords.length === 0) {
      return { groupIdx, isLineEnd: true, insert: 'after' };
    }

    // Find visual line closest to relY
    let targetLine = targetRow.visualLines[0]?.filter(w => !movingIds.includes(w.id)) || [];
    if (targetRow.visualLines.length > 1) {
      let bestDist = Infinity;
      for (const vl of targetRow.visualLines) {
        const lineWords = vl.filter(w => !movingIds.includes(w.id));
        if (lineWords.length === 0) continue;
        const lineMidY = lineWords.reduce((acc, w) => acc + w.midY, 0) / lineWords.length;
        const dist = Math.abs(relY - lineMidY);
        if (dist < bestDist) {
          bestDist = dist;
          targetLine = lineWords;
        }
      }
    }

    if (targetLine.length === 0) {
      return { groupIdx, isLineEnd: true, insert: 'after' };
    }

    // 8px hysteresis buffer to prevent any oscillation
    const H = 8;
    const isSameRow = currentDropTarget?.groupIdx === groupIdx;

    // Check before first word
    const isBeforeFirst =
      isSameRow &&
      currentDropTarget?.targetWordId === targetLine[0].id &&
      currentDropTarget?.insert === 'before';
    if (relX < targetLine[0].midX + (isBeforeFirst ? H : -H)) {
      return { groupIdx, targetWordId: targetLine[0].id, insert: 'before' };
    }

    // Check after last word
    const lastWord = targetLine[targetLine.length - 1];
    const isAfterLast =
      isSameRow &&
      currentDropTarget?.targetWordId === lastWord.id &&
      currentDropTarget?.insert === 'after';
    if (relX >= lastWord.midX + (isAfterLast ? -H : H)) {
      return { groupIdx, targetWordId: lastWord.id, insert: 'after' };
    }

    // Between words on this visual line
    for (let i = 0; i < targetLine.length - 1; i++) {
      const curr = targetLine[i];
      const nxt = targetLine[i + 1];
      const isAfterCurr =
        isSameRow &&
        currentDropTarget?.targetWordId === curr.id &&
        currentDropTarget?.insert === 'after';
      const minB = curr.midX + (isAfterCurr ? -H : H);
      const maxB = nxt.midX + (isAfterCurr ? H : -H);
      if (relX >= minB && relX < maxB) {
        return { groupIdx, targetWordId: curr.id, insert: 'after' };
      }
    }

    return { groupIdx, targetWordId: lastWord.id, insert: 'after' };
  }, [takeLayoutSnapshot]);

  // Drag and drop handlers for word chips
  const handleWordDragStart = (e: React.DragEvent, w: Word) => {
    if (editingWordId === w.id) {
      e.preventDefault();
      return;
    }
    justDraggedRef.current = true;
    setWordPopover(null);
    setCaseMenuOpen(false);

    let movingIds: string[] = [w.id];
    if (selectedWordIds.has(w.id) && selectedWordIds.size > 1 && project) {
      movingIds = project.words.filter(pw => selectedWordIds.has(pw.id)).map(pw => pw.id);
    }

    // Take snapshot of static geometry before any drop slots are inserted
    layoutSnapshotRef.current = takeLayoutSnapshot();
    draggingWordIdsRef.current = movingIds;
    setDraggingWordIds(movingIds);
    const cleanWordText = w.text.trim().replace(/[.!?।]+$/, '');
    const label = movingIds.length > 1 ? `${movingIds.length} words` : `"${cleanWordText}"`;
    setDraggingLabel(label);

    e.dataTransfer.setData('text/plain', movingIds.join(','));
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'bol-caption-words', wordIds: movingIds }));
    e.dataTransfer.effectAllowed = 'move';

    // Create a crisp floating drag pill badge
    try {
      const ghost = document.createElement('div');
      ghost.className = 'caption-drag-ghost-pill';
      ghost.textContent = label;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 14);
      setTimeout(() => {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }, 0);
    } catch {}
  };

  const handleWordDragEnd = () => {
    layoutSnapshotRef.current = null;
    draggingWordIdsRef.current = null;
    setDraggingWordIds(null);
    setDraggingLabel('');
    setDropTarget(null);
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 200);
  };

  const handleGlobalDragEnter = (e: React.DragEvent) => {
    const movingIds = draggingWordIdsRef.current || draggingWordIds;
    if (!movingIds || !movingIds.length) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleGlobalDragOver = (e: React.DragEvent) => {
    const movingIds = draggingWordIdsRef.current || draggingWordIds;
    if (!movingIds || !movingIds.length) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // Auto-scroll when cursor is near top or bottom edges of the scrollable list container
    const container = listContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const topThreshold = rect.top + 36;
      const bottomThreshold = rect.bottom - 36;
      if (e.clientY < topThreshold) {
        const factor = Math.min(1, Math.max(0, (topThreshold - e.clientY) / 36));
        container.scrollTop -= Math.round(10 * factor);
      } else if (e.clientY > bottomThreshold) {
        const factor = Math.min(1, Math.max(0, (e.clientY - bottomThreshold) / 36));
        container.scrollTop += Math.round(10 * factor);
      }
    }

    const newTarget = getDropTargetFromSnapshot(
      e.clientX,
      e.clientY,
      movingIds,
      dropTarget
    );

    if (!newTarget) return;

    setDropTarget(prev => {
      if (
        prev?.groupIdx === newTarget.groupIdx &&
        prev?.targetWordId === newTarget.targetWordId &&
        prev?.insert === newTarget.insert &&
        prev?.isLineEnd === newTarget.isLineEnd
      ) {
        return prev;
      }
      return newTarget;
    });
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let movingIds = draggingWordIdsRef.current || draggingWordIds;
    if (!movingIds || !movingIds.length) {
      try {
        const data = e.dataTransfer.getData('application/json');
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.type === 'bol-caption-words' && Array.isArray(parsed.wordIds)) {
            movingIds = parsed.wordIds;
          }
        }
      } catch {}
      if (!movingIds || !movingIds.length) {
        const txt = e.dataTransfer.getData('text/plain');
        if (txt) movingIds = txt.split(',').filter(Boolean);
      }
    }

    if (movingIds && movingIds.length && onDropWords) {
      const finalTarget =
        dropTarget ||
        getDropTargetFromSnapshot(e.clientX, e.clientY, movingIds, dropTarget);

      if (finalTarget) {
        if (finalTarget.targetWordId && !movingIds.includes(finalTarget.targetWordId)) {
          onDropWords(movingIds, finalTarget.groupIdx, {
            targetWordId: finalTarget.targetWordId,
            insert: finalTarget.insert,
          });
        } else {
          onDropWords(movingIds, finalTarget.groupIdx, 'end');
        }
      }
    }

    layoutSnapshotRef.current = null;
    draggingWordIdsRef.current = null;
    setDraggingWordIds(null);
    setDraggingLabel('');
    setDropTarget(null);
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 200);
  };

  /** Toggle the one highlight a word can carry. See setWordHighlight in main.tsx. */
  const handleToggleWordHighlight = () => {
    if (!wordPopover) return;
    const w = wordPopover.word;
    const patch = { emphasis: false, spotlight: !w.spotlight };

    if (selectedWordIds.size > 1 && selectedWordIds.has(w.id)) {
      onUpdateWords(selectedWordIds, patch);
    } else {
      onUpdateWord(w.id, patch);
    }

    setWordPopover(p => p ? { ...p, word: { ...p.word, ...patch } } : null);
    notify(patch.spotlight ? `Highlighted "${w.text}"` : `Removed the highlight from "${w.text}"`);
  };

  // Apply Case Transformation
  const applyWordCase = (c: 'normal' | 'uppercase' | 'lowercase' | 'title') => {
    if (!wordPopover) return;
    const w = wordPopover.word;
    let newText = w.text;

    if (c === 'uppercase') {
      newText = w.text.toUpperCase();
    } else if (c === 'lowercase') {
      newText = w.text.toLowerCase();
    } else if (c === 'title') {
      newText = w.text.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    } else if (c === 'normal') {
      newText = w.original || (w.text.charAt(0).toUpperCase() + w.text.substring(1).toLowerCase());
    }

    if (selectedWordIds.size > 1 && selectedWordIds.has(w.id)) {
      const ids = Array.from(selectedWordIds);
      ids.forEach(id => {
        const found = project?.words.find(pw => pw.id === id);
        if (found) {
          let t = found.text;
          if (c === 'uppercase') t = found.text.toUpperCase();
          else if (c === 'lowercase') t = found.text.toLowerCase();
          else if (c === 'title') t = found.text.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
          else if (c === 'normal') t = found.original || found.text;
          onUpdateWord(id, { text: t });
        }
      });
    } else {
      onUpdateWord(w.id, { text: newText });
    }

    setWordPopover(p => p ? {
      ...p,
      word: { ...p.word, text: newText },
      draftText: newText,
    } : null);
    setCaseMenuOpen(false);
    notify(`Changed case to ${c}`);
  };

  // Commit Word Text Edited Directly in Popover
  const handleCommitPopoverWord = useCallback(() => {
    if (!wordPopover) return;
    const trimmed = wordPopover.draftText.trim();
    if (trimmed && trimmed !== wordPopover.word.text) {
      onUpdateWord(wordPopover.word.id, { text: trimmed });
      setWordPopover(p => p ? {
        ...p,
        word: { ...p.word, text: trimmed },
        draftText: trimmed,
      } : null);
      notify(`Updated word: "${trimmed}"`);
    } else if (!trimmed) {
      setWordPopover(p => p ? { ...p, draftText: p.word.text } : null);
    }
  }, [wordPopover, onUpdateWord, notify]);

  // Handle generation start
  const handleGenerate = async () => {
    const targetSource = selectedSourceId === 'primary' ? null : selectedSourceId;
    try {
      await onStartTranscription(targetSource, captionScript, spokenLang, {
        autoPunctuation,
        filterFiller,
        multiSpeaker,
        wordsPerLine: wordsPerCaption,
        maxLines,
        glossary: brandWords.split(',').map(t => t.trim()).filter(Boolean).slice(0, 200),
        isolateVocals,
      });
      setPanelViewOverride(null);
    } catch (e) {
      notify((e as Error).message || 'Failed to start caption generation.');
    }
  };

  // Copy all captions to clipboard
  const handleCopyAll = () => {
    if (!groups.length) return;
    const text = groups.map(g => g.map(w => w.text).join(' ')).join('\n');
    navigator.clipboard.writeText(text);
    notify('All captions copied to clipboard');
    setPanelMenuOpen(false);
  };

  return (
    <section className="captions-panel panel" ref={panelRef} aria-label="Captions Panel">
      {/* PANEL HEADER */}
      <div className="captions-header compact-header">
        <div className="captions-title-block">
          <div className="captions-title-row">
            <span className="captions-icon-badge">
              <Captions size={18} strokeWidth={2.2} />
            </span>
            <h2 className="captions-title">Captions</h2>
          </div>
          <p className="captions-subtitle">Edit your transcript word by word</p>
        </div>

        {currentView === 'editor' && (
          <div className="captions-header-actions" ref={menuRef}>
            <button
              type="button"
              className="icon-button round"
              title="Caption Options"
              aria-label="Caption Options"
              onClick={() => setPanelMenuOpen(prev => !prev)}
            >
              <MoreVertical size={16} />
            </button>

            {panelMenuOpen && (
              <div className="captions-dropdown-menu panel-level-menu">
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    downloadTranscript('srt');
                    setPanelMenuOpen(false);
                  }}
                >
                  <Download size={14} />
                  <span>Export as SRT</span>
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    downloadTranscript('vtt');
                    setPanelMenuOpen(false);
                  }}
                >
                  <Download size={14} />
                  <span>Export as VTT</span>
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    downloadTranscript('json');
                    setPanelMenuOpen(false);
                  }}
                >
                  <Download size={14} />
                  <span>Export as JSON</span>
                </button>
                <button type="button" className="menu-item" onClick={handleCopyAll}>
                  <Copy size={14} />
                  <span>Copy All Captions</span>
                </button>
                <div className="menu-divider" />
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setPanelMenuOpen(false);
                    setModalType('regenerate-confirm');
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Regenerate Captions</span>
                </button>
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={() => {
                    setPanelMenuOpen(false);
                    setModalType('clear-confirm');
                  }}
                >
                  <Trash2 size={14} />
                  <span>Clear All Captions</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. EMPTY STATE */}
      {currentView === 'empty' && (
        <div className="captions-empty-state">
          <div className="empty-icon-wrap">
            <Captions size={44} strokeWidth={1.5} className="empty-cc-icon" />
          </div>
          <h3 className="empty-title">Create captions for your video</h3>
          <p className="empty-description">
            Generate accurate captions from your video's speech.
          </p>

          <button
            type="button"
            className="button primary generate-main-btn"
            onClick={() => {
              if (compatibleAssets.length > 0 || project) {
                setPanelViewOverride('generate');
              } else {
                onGoToMedia();
              }
            }}
          >
            <Sparkles size={16} />
            <span>Generate Captions</span>
          </button>
          <p className="empty-subtext">
            Supports Hindi, English, Hinglish and other supported languages.
          </p>
        </div>
      )}

      {/* 2. GENERATE CAPTIONS FORM */}
      {currentView === 'generate' && (
        <div className="captions-generate-view">
          <div className="generate-header-row">
            <button
              type="button"
              className="back-text-btn"
              onClick={() => setPanelViewOverride(null)}
            >
              ← Back
            </button>
            <h3 className="generate-heading">Generate Captions</h3>
          </div>

          <div className="generate-form-scrollable">
            {/* SOURCE SELECTION */}
            <div className="generate-field-group">
              <label className="generate-label">SOURCE</label>
              <div className="source-select-wrap">
                <select
                  aria-label="Caption Source"
                  className="generate-select"
                  value={selectedSourceId}
                  onChange={e => setSelectedSourceId(e.target.value)}
                >
                  {compatibleAssets.length > 0 ? (
                    compatibleAssets.map(asset => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} {asset.duration ? `(${formatTimecode(asset.duration)})` : ''}
                      </option>
                    ))
                  ) : project ? (
                    <option value="primary">
                      {project.name || project.filename} ({formatTimecode(project.duration || 0)})
                    </option>
                  ) : (
                    <option value="">No media available</option>
                  )}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* SPOKEN LANGUAGE */}
            <div className="generate-field-group">
              <label className="generate-label">Spoken language</label>
              <div className="source-select-wrap">
                <select
                  aria-label="Spoken language"
                  className="generate-select"
                  value={spokenLang}
                  onChange={e => setSpokenLang(e.target.value as 'auto' | 'hi' | 'en')}
                >
                  <option value="auto">Auto-detect (Hindi + English)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="en">English</option>
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* CAPTION SCRIPT */}
            <div className="generate-field-group">
              <label className="generate-label">Caption Script</label>
              <div className="source-select-wrap">
                <select
                  aria-label="Caption Script"
                  className="generate-select"
                  value={captionScript}
                  onChange={e => setCaptionScript(e.target.value as 'roman' | 'native' | 'en' | 'same')}
                >
                  <option value="roman">Hinglish / Roman (&ldquo;Aap kaise ho&rdquo;)</option>
                  <option value="native">Devanagari (&ldquo;आप कैसे हो&rdquo;)</option>
                  <option value="same">Same as spoken speech</option>
                  <option value="en">Translate to English</option>
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* TRANSCRIPTION OPTIONS */}
            <div className="generate-field-group">
              <label className="generate-label">Transcription Options</label>
              <div className="toggle-list">
                <label className="toggle-row">
                  <div className="toggle-text">
                    <span className="toggle-title">Auto punctuation</span>
                    <span className="toggle-desc">Automatically add periods, commas & question marks</span>
                  </div>
                  <input
                    type="checkbox"
                    className="bol-switch"
                    checked={autoPunctuation}
                    onChange={e => setAutoPunctuation(e.target.checked)}
                  />
                </label>

                <label className="toggle-row">
                  <div className="toggle-text">
                    <span className="toggle-title">Filter filler words</span>
                    <span className="toggle-desc">Exclude &ldquo;um&rdquo;, &ldquo;uh&rdquo;, &ldquo;ah&rdquo;</span>
                  </div>
                  <input
                    type="checkbox"
                    className="bol-switch"
                    checked={filterFiller}
                    onChange={e => setFilterFiller(e.target.checked)}
                  />
                </label>

                <label className="toggle-row">
                  <div className="toggle-text">
                    <span className="toggle-title">Detect multiple speakers</span>
                    <span className="toggle-desc">Tag speech by speaker when detected</span>
                  </div>
                  <input
                    type="checkbox"
                    className="bol-switch"
                    checked={multiSpeaker}
                    onChange={e => setMultiSpeaker(e.target.checked)}
                  />
                </label>
              </div>
            </div>

            {/* ADVANCED OPTIONS */}
            <div className="advanced-options-section">
              <button
                type="button"
                className="advanced-toggle-btn"
                onClick={() => setShowAdvanced(prev => !prev)}
              >
                {showAdvanced ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <span>Advanced Options</span>
              </button>

              {showAdvanced && (
                <div className="advanced-content">
                  <div className="advanced-field">
                    <div className="slider-label-row">
                      <span>Maximum words per caption</span>
                      <span className="slider-badge">{wordsPerCaption} words</span>
                    </div>
                    <input
                      aria-label="Maximum words per caption"
                      type="range"
                      min={1}
                      max={MAX_WORDS_PER_PAGE}
                      value={wordsPerCaption}
                      onChange={e => setWordsPerCaption(Number(e.target.value))}
                      className="bol-slider"
                    />
                  </div>

                  <div className="advanced-field">
                    <div className="slider-label-row">
                      <span>Maximum lines</span>
                      <span className="slider-badge">{maxLines} lines</span>
                    </div>
                    <div className="pill-choice-row">
                      <button
                        type="button"
                        className={`choice-pill ${maxLines === 1 ? 'active' : ''}`}
                        onClick={() => setMaxLines(1)}
                      >
                        1 Line
                      </button>
                      <button
                        type="button"
                        className={`choice-pill ${maxLines === 2 ? 'active' : ''}`}
                        onClick={() => setMaxLines(2)}
                      >
                        2 Lines
                      </button>
                    </div>
                  </div>

                  <div className="advanced-field">
                    <div className="slider-label-row">
                      <span>Brand words</span>
                      <span className="slider-badge">
                        {brandWords.split(',').filter(t => t.trim()).length || 'none'}
                      </span>
                    </div>
                    <input
                      type="text"
                      className="brand-words-input"
                      value={brandWords}
                      onChange={e => setBrandWords(e.target.value)}
                      placeholder="kalakar.io, Bol Studio, Ewa"
                      aria-label="Brand words the recognizer should spell your way"
                    />
                    <p className="field-hint">
                      Names, handles and domains, comma separated. Only these are replaced &mdash;
                      nothing else in your transcript is second-guessed.
                    </p>
                  </div>

                  <label className="toggle-row compact">
                    <span className="toggle-title">
                      Clean up background noise
                      <span className="toggle-note">Slower. Helps when music or a room sits under the voice.</span>
                    </span>
                    <input
                      type="checkbox"
                      className="bol-switch"
                      checked={isolateVocals}
                      onChange={e => setIsolateVocals(e.target.checked)}
                    />
                  </label>

                  <label className="toggle-row compact">
                    <span className="toggle-title">Automatic caption splitting</span>
                    <input
                      type="checkbox"
                      className="bol-switch"
                      checked={autoSplit}
                      onChange={e => setAutoSplit(e.target.checked)}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="generate-footer">
            <button
              type="button"
              className="button primary full-width-btn"
              onClick={handleGenerate}
              disabled={busy}
            >
              <Sparkles size={16} />
              <span>Generate Captions</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. GENERATING PROGRESS STATE */}
      {currentView === 'generating' && (
        <div className="captions-generating-view">
          <div className="generating-spinner-wrap">
            <RefreshCw size={36} className="generating-spin-icon spin" />
          </div>
          <h3 className="generating-title">Generating captions...</h3>
          <p className="generating-subtitle">
            {project?.message || 'Analyzing audio and identifying spoken words.'}
          </p>

          <div className="progress-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.max(8, project?.progress || 25)}%` }}
            />
          </div>
          <span className="progress-percentage-label">
            {project?.progress ? `${project.progress}%` : 'Processing…'}
          </span>

          <div className="generating-stages">
            <div className={`stage-item ${(project?.progress ?? 0) >= 20 ? 'completed' : 'active'}`}>
              <span className="stage-dot">
                {(project?.progress ?? 0) >= 20 ? <Check size={12} /> : '●'}
              </span>
              <span>Analyzing audio</span>
            </div>
            <div
              className={`stage-item ${(project?.progress ?? 0) >= 40 ? 'completed' : (project?.progress ?? 0) >= 20 ? 'active' : 'pending'}`}
            >
              <span className="stage-dot">
                {(project?.progress ?? 0) >= 40 ? <Check size={12} /> : (project?.progress ?? 0) >= 20 ? '●' : '○'}
              </span>
              <span>Detecting speech</span>
            </div>
            <div
              className={`stage-item ${(project?.progress ?? 0) >= 80 ? 'completed' : (project?.progress ?? 0) >= 40 ? 'active' : 'pending'}`}
            >
              <span className="stage-dot">
                {(project?.progress ?? 0) >= 80 ? <Check size={12} /> : (project?.progress ?? 0) >= 40 ? '●' : '○'}
              </span>
              <span>Generating captions</span>
            </div>
            <div
              className={`stage-item ${(project?.progress ?? 0) >= 95 ? 'completed' : (project?.progress ?? 0) >= 80 ? 'active' : 'pending'}`}
            >
              <span className="stage-dot">
                {(project?.progress ?? 0) >= 95 ? <Check size={12} /> : (project?.progress ?? 0) >= 80 ? '●' : '○'}
              </span>
              <span>Finalizing captions</span>
            </div>
          </div>

          <div className="generating-cancel-wrap">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                if (onCancelTranscription) onCancelTranscription();
                setPanelViewOverride(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN TRANSCRIPT WORKSPACE */}
      {currentView === 'editor' && (
        <div className="captions-editor-view">
          {/* SEARCH & FILTER BAR */}
          <div className="captions-toolbar">
            <div className="captions-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search captions or words..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="captions-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  title="Clear search"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="captions-filter-row">
              {(['all', 'highlighted', 'edited'] as const).map(filterKey => (
                <button
                  key={filterKey}
                  type="button"
                  className={`caption-filter-pill ${activeFilter === filterKey ? 'active' : ''}`}
                  onClick={() => setActiveFilter(filterKey)}
                >
                  {filterKey === 'all'
                    ? 'All'
                    : filterKey === 'highlighted'
                    ? '⚡ Highlighted'
                    : 'Edited'}
                </button>
              ))}
            </div>
          </div>

          {/* SCROLLABLE CAPTION CARDS */}
          <div
            className="captions-list-container"
            ref={listContainerRef}
            onScroll={handleContainerScroll}
            onDragOver={handleGlobalDragOver}
            onDragEnter={handleGlobalDragEnter}
            onDrop={handleGlobalDrop}
          >
            {searchResults.length === 0 ? (
              <div className="no-search-results">
                <p>
                  {searchQuery.trim()
                    ? `No captions match "${searchQuery}"`
                    : `No ${activeFilter} captions.`}
                </p>
                <button
                  type="button"
                  className="button tiny secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              searchResults.map(({ group, idx }) => {
                const isActiveSpoken = activeGroupIdx === idx;
                const isSelected = selectedGroupIdx === idx;
                const isEditingGroup = editingGroupIdx === idx;
                const startTimeStr = formatTimecode(group[0]?.start ?? 0);
                const endTimeStr = formatTimecode(group[group.length - 1]?.end ?? 0);
                const gDuration = Math.max(0, (group[group.length - 1]?.end ?? 0) - (group[0]?.start ?? 0));

                return (
                  <div
                    key={`caption-group-${idx}-${group[0]?.id || idx}`}
                    ref={isActiveSpoken ? activeRowRef : undefined}
                    data-group-idx={idx}
                    className={`caption-row compact-card ${isActiveSpoken ? 'active-spoken' : ''} ${
                      isSelected ? 'selected' : ''
                    } ${isEditingGroup ? 'is-editing' : ''} ${
                      dropTarget?.groupIdx === idx ? 'is-drop-target' : ''
                    }`}
                    onDragOver={e => {
                      if (!isEditingGroup) {
                        handleGlobalDragOver(e);
                      }
                    }}
                    onDragEnter={e => {
                      if (!isEditingGroup) {
                        handleGlobalDragEnter(e);
                      }
                    }}
                    onDrop={e => {
                      if (!isEditingGroup) {
                        handleGlobalDrop(e);
                      }
                    }}
                    onClick={() => {
                      if (!isEditingGroup && !justDraggedRef.current) {
                        onSeek(group[0].start);
                        onSelectWord(group[0].id);
                      }
                    }}
                  >
                    {isEditingGroup ? (
                      /* INLINE GROUP EDITING CARD */
                      <div className="caption-inline-edit-card" onClick={e => e.stopPropagation()}>
                        <div className="inline-edit-times">
                          <div className="time-input-wrap">
                            <label>Start</label>
                            <input
                              aria-label="Start Time"
                              type="text"
                              value={draftGroupStart}
                              onChange={e => {
                                setDraftGroupStart(e.target.value);
                                setGroupTimeError('');
                              }}
                              className="time-field"
                            />
                          </div>
                          <span className="time-sep">–</span>
                          <div className="time-input-wrap">
                            <label>End</label>
                            <input
                              aria-label="End Time"
                              type="text"
                              value={draftGroupEnd}
                              onChange={e => {
                                setDraftGroupEnd(e.target.value);
                                setGroupTimeError('');
                              }}
                              className="time-field"
                            />
                          </div>
                        </div>

                        {groupTimeError && (
                          <div className="inline-time-error">
                            <AlertCircle size={12} />
                            <span>{groupTimeError}</span>
                          </div>
                        )}

                        <textarea
                          aria-label="Caption Text"
                          value={draftGroupText}
                          onChange={e => setDraftGroupText(e.target.value)}
                          className="inline-edit-textarea"
                          rows={3}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              commitInlineGroupEdit();
                            } else if (e.key === 'Escape') {
                              cancelInlineGroupEdit();
                            }
                          }}
                        />

                        <div className="inline-edit-buttons">
                          <button
                            type="button"
                            className="button tiny secondary"
                            onClick={cancelInlineGroupEdit}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="button tiny primary"
                            onClick={commitInlineGroupEdit}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* COMPACT CAPTION CARD */
                      <>
                        <div className="caption-row-header">
                          <div className="caption-row-header-left">
                            <button
                              type="button"
                              className={`caption-line-play-btn ${isActiveSpoken && playing ? 'is-playing' : ''}`}
                              title={isActiveSpoken && playing ? 'Pause preview' : 'Play line preview'}
                              onClick={e => {
                                e.stopPropagation();
                                if (isActiveSpoken && playing) {
                                  if (onTogglePlay) onTogglePlay();
                                } else {
                                  onSeek(group[0].start);
                                  if (!playing && onTogglePlay) onTogglePlay();
                                }
                              }}
                            >
                              {isActiveSpoken && playing ? (
                                <Pause size={12} fill="currentColor" />
                              ) : (
                                <Play size={12} fill="currentColor" />
                              )}
                            </button>
                            <span className="caption-timecode">
                              {startTimeStr} – {endTimeStr}
                            </span>
                            <span className="caption-group-duration">
                              {gDuration.toFixed(1)}s
                            </span>
                          </div>

                          <div className="caption-row-header-right">
                            {isActiveSpoken && (
                              <span className="active-spoken-badge" title="Spoken Now">
                                ● Speaking
                              </span>
                            )}

                            <div className="caption-row-menu-wrap" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                className="caption-row-menu-btn"
                                title="Caption options"
                                aria-label="Caption options"
                                onClick={() =>
                                  setActiveRowMenuIdx(prev => (prev === idx ? null : idx))
                                }
                              >
                                <MoreVertical size={14} />
                              </button>

                              {activeRowMenuIdx === idx && (
                                <div className="captions-dropdown-menu row-level-menu">
                                  <button
                                    type="button"
                                    className="menu-item"
                                    onClick={() => startInlineGroupEdit(idx)}
                                  >
                                    <Edit3 size={13} />
                                    <span>Edit Caption</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="menu-item"
                                    onClick={() => {
                                      onSplitGroup(group);
                                      setActiveRowMenuIdx(null);
                                    }}
                                  >
                                    <Scissors size={13} />
                                    <span>Split Caption</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="menu-item"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      if (idx > 0) {
                                        onMergeGroups(idx - 1, idx);
                                        setActiveRowMenuIdx(null);
                                      }
                                    }}
                                  >
                                    <GitMerge size={13} />
                                    <span>Merge with Previous</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="menu-item"
                                    disabled={idx >= groups.length - 1}
                                    onClick={() => {
                                      if (idx < groups.length - 1) {
                                        onMergeGroups(idx, idx + 1);
                                        setActiveRowMenuIdx(null);
                                      }
                                    }}
                                  >
                                    <GitMerge size={13} />
                                    <span>Merge with Next</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="menu-item"
                                    onClick={() => {
                                      onDuplicateGroup(group);
                                      setActiveRowMenuIdx(null);
                                    }}
                                  >
                                    <CopyPlus size={13} />
                                    <span>Duplicate</span>
                                  </button>
                                  <div className="menu-divider" />
                                  <button
                                    type="button"
                                    className="menu-item danger"
                                    onClick={() => {
                                      onDeleteGroup(group);
                                      setActiveRowMenuIdx(null);
                                    }}
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete Caption</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* INTERACTIVE WORD CHIPS */}
                        <div
                          className="caption-card-chips"
                          onDragOver={e => {
                            if (!isEditingGroup) {
                              handleGlobalDragOver(e);
                            }
                          }}
                          onDragEnter={e => {
                            if (!isEditingGroup) {
                              handleGlobalDragEnter(e);
                            }
                          }}
                          onDrop={e => {
                            if (!isEditingGroup) {
                              handleGlobalDrop(e);
                            }
                          }}
                        >
                          {(() => {
                            const isTargetThisRow = dropTarget?.groupIdx === idx;
                            const targetWordId = dropTarget?.targetWordId;
                            const insert = dropTarget?.insert;

                            const movingIds = draggingWordIdsRef.current || draggingWordIds || [];
                            const nonMovingWords = group.filter(w => !movingIds.includes(w.id));

                            // Determine if dropping at current target would just be a no-op (same position in the same line)
                            let isSamePosition = false;
                            if (isTargetThisRow && movingIds.length > 0) {
                              const movingInThisGroup = group.filter(w => movingIds.includes(w.id));
                              if (movingInThisGroup.length === movingIds.length) {
                                const firstMovingIdx = group.findIndex(w => w.id === movingIds[0]);
                                const lastMovingIdx = group.findIndex(w => w.id === movingIds[movingIds.length - 1]);
                                if (insert === 'before') {
                                  if (lastMovingIdx !== -1 && group[lastMovingIdx + 1]?.id === targetWordId) {
                                    isSamePosition = true;
                                  }
                                } else if (insert === 'after') {
                                  if (firstMovingIdx > 0 && group[firstMovingIdx - 1]?.id === targetWordId) {
                                    isSamePosition = true;
                                  }
                                }
                              }
                            }

                            const showEmptySlot = isTargetThisRow && !isSamePosition && nonMovingWords.length === 0;

                            return (
                              <>
                                {group.map((w, wIdx) => {
                                  const isWordActive = time >= w.start && time < w.end;
                                  const isWordSelected = selectedWordIds.has(w.id);
                                  const isWordEditing = editingWordId === w.id;
                                  const isWordDragging = movingIds.includes(w.id);

                                  const showSlotBeforeThis =
                                    isTargetThisRow &&
                                    !isSamePosition &&
                                    insert === 'before' &&
                                    targetWordId === w.id;

                                  const showSlotAfterThis =
                                    isTargetThisRow &&
                                    !isSamePosition &&
                                    insert === 'after' &&
                                    targetWordId === w.id;

                                  if (isWordEditing) {
                                    return (
                                      <input
                                        key={w.id || wIdx}
                                        ref={wordInputRef}
                                        type="text"
                                        className="caption-word-chip-input"
                                        value={editingWordText}
                                        onChange={e => setEditingWordText(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            commitWordEdit(w.id);
                                          } else if (e.key === 'Escape') {
                                            cancelWordEdit();
                                          }
                                        }}
                                        onBlur={() => commitWordEdit(w.id)}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                      />
                                    );
                                  }

                                  return (
                                    <React.Fragment key={w.id || wIdx}>
                                      {showSlotBeforeThis && (
                                        <div className="caption-word-drop-slot" key={`drop-slot-before-${w.id}`}>
                                          <span className="caption-word-drop-slot-pill">
                                            ↳ {draggingLabel || 'Drop here'}
                                          </span>
                                        </div>
                                      )}

                                      <div
                                        className={`caption-word-chip-wrapper ${isWordDragging ? 'is-dragging-source' : ''}`}
                                        data-word-id={w.id}
                                      >
                                        <div
                                          role="button"
                                          tabIndex={0}
                                          draggable={!isWordEditing}
                                          onDragStart={e => handleWordDragStart(e, w)}
                                          onDragEnd={handleWordDragEnd}
                                          onDragOver={e => {
                                            if (!isEditingGroup) {
                                              handleGlobalDragOver(e);
                                            }
                                          }}
                                          onDragEnter={e => {
                                            if (!isEditingGroup) {
                                              handleGlobalDragEnter(e);
                                            }
                                          }}
                                          onDrop={e => {
                                            if (!isEditingGroup) {
                                              handleGlobalDrop(e);
                                            }
                                          }}
                                          className={`caption-word-chip ${
                                            isWordSelected ? 'is-selected' : ''
                                          } ${isWordActive ? 'is-active' : ''} ${
                                            isWordSelected && isWordActive ? 'is-selected-and-active' : ''
                                          } ${w.spotlight ? 'is-spotlight' : (w.emphasis ? 'is-emphasized' : '')} ${
                                            isWordDragging ? 'is-dragging' : ''
                                          }`}
                                          onClick={e => handleWordClick(e, w)}
                                          onDoubleClick={e => handleWordDoubleClick(e, w)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              handleWordClick(e as unknown as React.MouseEvent, w);
                                            }
                                          }}
                                          title={`${w.text} (${formatTimecode(w.start)} – ${formatTimecode(w.end)}) · Drag to move · Click to inspect · Double-click to edit`}
                                        >
                                          <span className="caption-word-text">{w.text}</span>
                                          {w.spotlight ? (
                                            <span className="caption-word-spotlight-badge" title="Highlighted">⚡</span>
                                          ) : w.emphasis ? (
                                            <span className="caption-word-star-badge" title="Suggested — click to highlight">⚡</span>
                                          ) : null}
                                        </div>
                                      </div>

                                      {showSlotAfterThis && (
                                        <div className="caption-word-drop-slot" key={`drop-slot-after-${w.id}`}>
                                          <span className="caption-word-drop-slot-pill">
                                            ↳ {draggingLabel || 'Drop here'}
                                          </span>
                                        </div>
                                      )}
                                    </React.Fragment>
                                  );
                                })}

                                {showEmptySlot && (
                                  <div className="caption-word-drop-slot empty-group-slot" key="drop-slot-empty">
                                    <span className="caption-word-drop-slot-pill">
                                      ↳ {draggingLabel || 'Move to this line'}
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* CONTEXTUAL WORD INSPECTOR POPOVER */}
          {wordPopover && (
            <div
              ref={wordPopoverRef}
              className="caption-word-inspector-popover"
              style={{
                position: 'fixed',
                top: `${wordPopover.position.top}px`,
                left: `${wordPopover.position.left}px`,
                zIndex: 9999,
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header with directly editable word input */}
              <div className="popover-header">
                <div className="popover-title-row">
                  <span className="popover-tag">WORD</span>
                  <div className="popover-word-input-wrap">
                    <input
                      ref={popoverWordInputRef}
                      type="text"
                      className="popover-word-input"
                      value={wordPopover.draftText}
                      onChange={e => {
                        const val = e.target.value;
                        setWordPopover(p => p ? { ...p, draftText: val } : null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleCommitPopoverWord();
                          (e.target as HTMLInputElement).blur();
                        } else if (e.key === 'Escape') {
                          setWordPopover(p => p ? { ...p, draftText: p.word.text } : null);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={handleCommitPopoverWord}
                      placeholder="Word text..."
                      title="Click to edit word"
                    />
                    <Edit3 size={11} className="popover-word-input-icon" />
                  </div>
                </div>
                <button
                  type="button"
                  className="popover-close-btn"
                  title="Close inspector"
                  onClick={() => {
                    setWordPopover(null);
                    setCaseMenuOpen(false);
                  }}
                >
                  <X size={13} />
                </button>
              </div>

              {/* Quick Actions (no separate edit button, no timing section) */}
              <div className="popover-section">
                <div className="popover-quick-actions">
                  <button
                    type="button"
                    className={`popover-action-btn ${wordPopover.word.spotlight ? 'active' : ''}`}
                    title={wordPopover.word.spotlight ? 'Remove highlight' : 'Highlight this word (⚡)'}
                    onClick={handleToggleWordHighlight}
                  >
                    <span className="popover-zap-icon">⚡</span>
                    <span>{wordPopover.word.spotlight ? 'Highlighted' : 'Highlight'}</span>
                  </button>
                </div>

                <div className="popover-secondary-actions">
                  {/* Case changer */}
                  <div className="popover-case-wrap">
                    <button
                      type="button"
                      className="popover-action-btn case-toggle"
                      onClick={() => setCaseMenuOpen(prev => !prev)}
                    >
                      <Type size={12} />
                      <span>Case</span>
                      <ChevronDown size={11} />
                    </button>
                    {caseMenuOpen && (
                      <div className="popover-case-dropdown">
                        <button type="button" onClick={() => applyWordCase('normal')}>Normal</button>
                        <button type="button" onClick={() => applyWordCase('uppercase')}>UPPERCASE</button>
                        <button type="button" onClick={() => applyWordCase('lowercase')}>lowercase</button>
                        <button type="button" onClick={() => applyWordCase('title')}>Title Case</button>
                      </div>
                    )}
                  </div>

                  {/* Split Here */}
                  <button
                    type="button"
                    className="popover-action-btn"
                    title="Split caption here"
                    onClick={() => {
                      if (onSplitLine) {
                        onSplitLine(wordPopover.word.id);
                      } else {
                        const currentG = groups.find(g => g.some(w => w.id === wordPopover.word.id));
                        if (currentG) onSplitGroup(currentG);
                      }
                      setWordPopover(null);
                    }}
                  >
                    <Scissors size={12} />
                    <span>Split</span>
                  </button>

                  {/* Delete Word */}
                  <button
                    type="button"
                    className="popover-action-btn danger"
                    title="Delete word"
                    onClick={() => {
                      if (onDeleteWord) {
                        onDeleteWord(wordPopover.word.id);
                      } else {
                        onUpdateWords([wordPopover.word.id], { text: '' });
                      }
                      setWordPopover(null);
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM + ADD CAPTION BUTTON */}
          <div className="captions-footer-add">
            <button
              type="button"
              className="add-caption-btn"
              onClick={() => {
                onAddCaptionAtTime(time);
                setTimeout(() => {
                  if (groups.length > 0) {
                    startInlineGroupEdit(groups.length);
                  }
                }, 100);
              }}
            >
              <Plus size={15} />
              <span>Add Caption</span>
            </button>
          </div>
        </div>
      )}

      {/* REGENERATE CONFIRMATION MODAL */}
      {modalType === 'regenerate-confirm' && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div className="bol-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Regenerate Captions</h3>
              <button
                type="button"
                className="icon-button round"
                onClick={() => setModalType(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Regenerating captions may replace your current caption text and timing.
              </p>
              {/* This is the moment brand words matter: you have seen the
                  transcript spell your domain phonetically and want it fixed on
                  the next pass. The first-run generate view was the only place
                  to set them, which is the one time you have not read the
                  transcript yet. */}
              <label className="modal-field">
                <span>Brand words</span>
                <input
                  type="text"
                  className="brand-words-input"
                  value={brandWords}
                  onChange={e => setBrandWords(e.target.value)}
                  placeholder="kalakar.io, Bol Studio, Ewa"
                  aria-label="Brand words the recognizer should spell your way"
                />
                <span className="field-hint">
                  Names, handles and domains, comma separated. Only these are replaced.
                </span>
              </label>
              <label className="toggle-row compact">
                <span className="toggle-title">
                  Clean up background noise
                  <span className="toggle-note">Slower. Helps when music sits under the voice.</span>
                </span>
                <input
                  type="checkbox"
                  className="bol-switch"
                  checked={isolateVocals}
                  onChange={e => setIsolateVocals(e.target.checked)}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalType(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={async () => {
                  setModalType(null);
                  try {
                    await onRegenerateCaptions(
                      selectedSourceId === 'primary' ? undefined : selectedSourceId,
                      captionScript,
                      spokenLang,
                      brandWords.split(',').map(t => t.trim()).filter(Boolean).slice(0, 200),
                      isolateVocals
                    );
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ALL CONFIRMATION MODAL */}
      {modalType === 'clear-confirm' && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div className="bol-modal danger-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove All Captions</h3>
              <button
                type="button"
                className="icon-button round"
                onClick={() => setModalType(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>Remove all captions from this project?</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalType(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button danger-btn"
                onClick={() => {
                  setModalType(null);
                  onClearAllCaptions();
                }}
              >
                Remove All
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
