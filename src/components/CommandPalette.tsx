import { useDialogFocus } from './useDialogFocus';
import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import {
  Search,
  FolderOpen,
  Upload,
  Keyboard,
  Sparkles,
  Shield,
  Sun,
  Moon,
  Download,
  Copy,
  FileAudio,
  FileText,
  Film,
  X,
  Compass,
  Replace,
  Maximize2,
} from 'lucide-react';
import type { Project, Settings } from '../lib/types';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onNewUpload: () => void;
  onOpenModal: (modal: 'export' | 'projects' | 'help' | 'search-replace' | 'shortcuts') => void;
  onStartTour: () => void;
  onToggleTheme: () => void;
  currentTheme: 'light' | 'dark';
  settings: Settings;
  onUpdateSettings: (update: Partial<Settings>) => void;
  downloadTranscript: (format: 'srt' | 'vtt' | 'json' | 'txt' | 'csv') => void;
  downloadAudioTrack: () => void;
  copyTranscript: () => void;
  currentProject: Project | null;
}

interface CommandItem {
  id: string;
  category: 'Workspace' | 'Stage & View' | 'Export' | 'Projects';
  title: string;
  description?: string;
  icon: React.ReactNode;
  iconTheme?: 'emerald' | 'blue' | 'amber' | 'purple' | 'pink' | 'neutral';
  shortcut?: string;
  perform: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  projects,
  onOpenProject,
  onNewUpload,
  onOpenModal,
  onStartTour,
  onToggleTheme,
  currentTheme,
  settings,
  onUpdateSettings,
  downloadTranscript,
  downloadAudioTrack,
  copyTranscript,
  currentProject,
}: CommandPaletteProps) {
  const dialogRef = useDialogFocus(isOpen, onClose);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const optionsId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Workspace
      {
        id: 'new-upload',
        category: 'Workspace',
        title: 'New Media Upload',
        description: 'Upload video or audio clip for captioning',
        icon: <Upload size={16} />,
        iconTheme: 'emerald',
        shortcut: 'Upload',
        perform: () => {
          onClose();
          onNewUpload();
        },
      },
      {
        id: 'search-replace',
        category: 'Workspace',
        title: 'Search & Replace Words',
        description: 'Find words and replace all occurrences',
        icon: <Replace size={16} />,
        iconTheme: 'amber',
        shortcut: 'Find',
        perform: () => {
          onClose();
          onOpenModal('search-replace');
        },
      },
      {
        id: 'keyboard-shortcuts',
        category: 'Workspace',
        title: 'Keyboard Shortcuts Cheat Sheet',
        description: 'View full NLE and timeline shortcuts list',
        icon: <Keyboard size={16} />,
        iconTheme: 'purple',
        shortcut: '?',
        perform: () => {
          onClose();
          onOpenModal('shortcuts');
        },
      },
      {
        id: 'start-tour',
        category: 'Workspace',
        title: 'Interactive Studio Tour',
        description: 'Re-launch the 3-step walkthrough guide',
        icon: <Compass size={16} />,
        iconTheme: 'pink',
        perform: () => {
          onClose();
          onStartTour();
        },
      },

      // Stage & View
      {
        id: 'toggle-safe-area',
        category: 'Stage & View',
        title: settings.safeArea && settings.safeArea !== 'none' ? `Hide ${settings.safeArea === 'shorts' ? 'YouTube Shorts' : 'Instagram Reels'} Safe Area Guides` : 'Show Instagram Reels Safe Area Guides',
        description: 'Toggle platform UI safe-zone guides over the video',
        icon: <Shield size={16} />,
        iconTheme: 'emerald',
        perform: () => {
          onClose();
          onUpdateSettings({ safeArea: settings.safeArea && settings.safeArea !== 'none' ? 'none' : 'reels' });
        },
      },
      {
        id: 'aspect-9-16',
        category: 'Stage & View',
        title: 'Frame Aspect: 9:16 Vertical (Reels / Shorts / TikTok)',
        icon: <Maximize2 size={16} />,
        iconTheme: 'purple',
        perform: () => {
          onClose();
          onUpdateSettings({ aspect: '9:16' });
        },
      },
      {
        id: 'aspect-1-1',
        category: 'Stage & View',
        title: 'Frame Aspect: 1:1 Square (Instagram Posts)',
        icon: <Maximize2 size={16} />,
        iconTheme: 'blue',
        perform: () => {
          onClose();
          onUpdateSettings({ aspect: '1:1' });
        },
      },
      {
        id: 'aspect-16-9',
        category: 'Stage & View',
        title: 'Frame Aspect: 16:9 Landscape (YouTube / Desktop)',
        icon: <Maximize2 size={16} />,
        iconTheme: 'neutral',
        perform: () => {
          onClose();
          onUpdateSettings({ aspect: '16:9' });
        },
      },
      {
        id: 'toggle-theme',
        category: 'Stage & View',
        title: currentTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        description: 'Toggle interface appearance mode',
        icon: currentTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
        iconTheme: currentTheme === 'dark' ? 'amber' : 'blue',
        shortcut: 'Ctrl+Shift+D',
        perform: () => {
          onClose();
          onToggleTheme();
        },
      },

      // Export
      {
        id: 'export-video',
        category: 'Export',
        title: 'Export Video / Subtitles',
        description: 'Render MP4, green screen, or audio file',
        icon: <Film size={16} />,
        iconTheme: 'emerald',
        perform: () => {
          onClose();
          onOpenModal('export');
        },
      },
      {
        id: 'export-srt',
        category: 'Export',
        title: 'Download .SRT Subtitles',
        description: 'Industry-standard SubRip caption timing format',
        icon: <Download size={16} />,
        iconTheme: 'blue',
        perform: () => {
          onClose();
          downloadTranscript('srt');
        },
      },
      {
        id: 'export-vtt',
        category: 'Export',
        title: 'Download .VTT Subtitles',
        description: 'WebVTT timing format for HTML5 players and web apps',
        icon: <Download size={16} />,
        iconTheme: 'purple',
        perform: () => {
          onClose();
          downloadTranscript('vtt');
        },
      },
      {
        id: 'export-txt',
        category: 'Export',
        title: 'Download Plain Text (.TXT)',
        description: 'Clean readable transcript without timecodes',
        icon: <FileText size={16} />,
        iconTheme: 'neutral',
        perform: () => {
          onClose();
          downloadTranscript('txt');
        },
      },
      {
        id: 'export-csv',
        category: 'Export',
        title: 'Download Spreadsheet (.CSV)',
        description: 'Word-by-word timing data for spreadsheets and NLEs',
        icon: <FileText size={16} />,
        iconTheme: 'emerald',
        perform: () => {
          onClose();
          downloadTranscript('csv');
        },
      },
      {
        id: 'export-audio',
        category: 'Export',
        title: 'Download Dialogue Audio (.M4A)',
        description: 'High-quality standalone audio track',
        icon: <FileAudio size={16} />,
        iconTheme: 'amber',
        perform: () => {
          onClose();
          downloadAudioTrack();
        },
      },
      {
        id: 'copy-transcript',
        category: 'Export',
        title: 'Copy Transcript to Clipboard',
        description: 'Copy plain text transcript instantly',
        icon: <Copy size={16} />,
        iconTheme: 'neutral',
        perform: () => {
          onClose();
          copyTranscript();
        },
      },
    ];

    return list;
  }, [
    projects,
    currentProject,
    settings,
    currentTheme,
    onClose,
    onNewUpload,
    onOpenModal,
    onStartTour,
    onToggleTheme,
    onUpdateSettings,
    downloadTranscript,
    downloadAudioTrack,
    copyTranscript,
    onOpenProject,
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      c =>
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].perform();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  // Keep selected item scrolled into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`.palette-item.is-active`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div
        className="palette-dialog"
        onClick={e => e.stopPropagation()}
        ref={dialogRef} role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div className="palette-input-wrap">
          <Search size={18} className="palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Type a command, action, or project name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-autocomplete="list"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls={optionsId}
            aria-activedescendant={filtered[selectedIndex] ? `${optionsId}-${selectedIndex}` : undefined}
          />
          <button
            type="button"
            className="palette-close-btn"
            onClick={onClose}
            aria-label="Close Command Palette"
          >
            <X size={15} />
          </button>
        </div>

        <div className="palette-list" id={optionsId} ref={listRef} role="listbox" aria-label="Available commands">
          {filtered.length > 0 ? (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  id={`${optionsId}-${index}`}
                  className={`palette-item ${isSelected ? 'is-active' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => item.perform()}
                >
                  <span className={`palette-item-icon ${item.iconTheme || 'neutral'}`}>
                    {item.icon}
                  </span>
                  <div className="palette-item-text">
                    <span className="palette-item-title">{item.title}</span>
                    {item.description && (
                      <span className="palette-item-desc">{item.description}</span>
                    )}
                  </div>
                  {item.shortcut && (
                    <span className="palette-item-shortcut">{item.shortcut}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="palette-empty">No matching commands found.</div>
          )}
        </div>

        <div className="palette-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
