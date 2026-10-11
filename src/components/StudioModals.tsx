import React, { useMemo, useState } from 'react';
import { Plus, FileAudio, Film, ChevronRight, FolderOpen, MonitorPlay, Search, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { ShortcutModal } from './ShortcutModal';
import { matchesCaptionWord } from '../lib/captions';
import type { Project } from '../lib/types';

export interface StudioModalsProps {
  modal: 'projects' | 'help' | 'search-replace' | 'shortcuts' | null;
  onClose: () => void;
  authEnabled?: boolean;
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onNewUpload: () => void;
  timecode: (seconds: number) => string;
  project: Project | null;
  searchFindText: string;
  setSearchFindText: (text: string) => void;
  searchReplaceText: string;
  setSearchReplaceText: (text: string) => void;
  searchCaseSensitive: boolean;
  setSearchCaseSensitive: (val: boolean) => void;
  onReplaceNext: () => void;
  onReplaceAll: () => void;
  onStartTour?: () => void;
}

export const StudioModals: React.FC<StudioModalsProps> = React.memo(({
  modal,
  onClose,
  authEnabled,
  projects,
  onOpenProject,
  onNewUpload,
  timecode,
  project,
  searchFindText,
  setSearchFindText,
  searchReplaceText,
  setSearchReplaceText,
  searchCaseSensitive,
  setSearchCaseSensitive,
  onReplaceNext,
  onReplaceAll,
  onStartTour,
}) => {
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSort, setProjectSort] = useState<'newest' | 'oldest' | 'name' | 'duration'>('newest');

  const filteredProjects = useMemo(() => {
    const list = projects.filter(p => {
      if (!projectSearch.trim()) return true;
      const q = projectSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });
    if (projectSort === 'oldest') {
      return [...list].reverse();
    }
    if (projectSort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (projectSort === 'duration') {
      return [...list].sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    return list;
  }, [projects, projectSearch, projectSort]);

  if (!modal) return null;

  if (modal === 'shortcuts') {
    return <ShortcutModal onClose={onClose} />;
  }

  if (modal === 'projects') {
    return (
      <Modal title="Your workspace" onClose={onClose}>
        <p className="modal-description">
          {authEnabled
            ? 'Projects are saved to your account. Cloud storage is temporary for now — export anything you want to keep.'
            : 'Projects are saved on this computer, ready whenever you are.'}
        </p>
        <button
          className="button primary full"
          onClick={() => {
            onClose();
            onNewUpload();
          }}
        >
          <Plus size={16} /> New upload
        </button>
        <div className="projects-toolbar" style={{ marginTop: '14px' }}>
          <div className="projects-search-box">
            <Search size={14} />
            <input
              type="text"
              aria-label="Search projects"
              placeholder="Search projects..."
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
            />
          </div>
          <select
            className="projects-sort-select"
            value={projectSort}
            onChange={e => setProjectSort(e.target.value as any)}
            aria-label="Sort projects"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="duration">Duration</option>
          </select>
        </div>
        <div className="project-list">
          {filteredProjects.length ? (
            filteredProjects.map(p => (
              <button key={p.id} onClick={() => onOpenProject(p)}>
                <span className="project-list-icon">
                  {p.mediaType === 'audio' ? <FileAudio size={21} /> : <Film size={21} />}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {timecode(p.duration)} · {p.status === 'ready' ? `${p.words?.length ?? ('wordCount' in p && typeof p.wordCount === 'number' ? p.wordCount : 0)} words` : p.status}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))
          ) : (
            <div className="empty-projects">
              <FolderOpen size={32} />
              <p>{projects.length ? 'No matching projects found.' : 'Your first story is one upload away.'}</p>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  if (modal === 'help') {
    return (
      <Modal title="A little guide to Bol." onClose={onClose} wide>
        <div className="guide-grid">
          <div>
            <span className="guide-number">01</span>
            <h3>Bring your story</h3>
            <p>
              Upload a video or audio file. Choose Hindi + English for Hinglish and Roman to write “aap kaise ho” in Latin letters.
            </p>
          </div>
          <div>
            <span className="guide-number">02</span>
            <h3>Give it a once-over</h3>
            <p>
              The local Hinglish recognizer times each word against the audio. Review names, slang, and spellings &mdash; the recognizer does not report how sure it is, so give proper nouns a second look.
            </p>
          </div>
          <div>
            <span className="guide-number">03</span>
            <h3>Find your emphasis</h3>
            <p>
              Loudness, pitch, and duration suggest a word to highlight in each line, shown with a dashed outline. They are only suggestions: click any word and toggle its highlight to decide for yourself.
            </p>
          </div>
          <div>
            <span className="guide-number">04</span>
            <h3>Make some moves</h3>
            <p>
              Pick a template, adjust color and motion, then export a captioned MP4, green-screen overlay, or subtitle file.
            </p>
          </div>
        </div>
        {onStartTour && (
          <div className="tour-trigger-banner" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-bg-secondary, rgba(255,255,255,0.04))', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '13px', marginBottom: '2px' }}>New to Bol Studio?</strong>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Take a quick 3-step interactive tour of the stage, styling, and timeline.</span>
            </div>
            <button
              type="button"
              className="button secondary compact"
              onClick={() => {
                onClose();
                onStartTour();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Sparkles size={14} color="#10b981" /> Launch Tour
            </button>
          </div>
        )}
        <div className="guide-note">
          <MonitorPlay size={22} />
          <p>
            <strong>Local by design.</strong> Your recordings stay here. The first transcription downloads the model; later runs use the cached copy. Roman spelling and timing can need corrections, especially with names, music, or overlapping voices.
          </p>
        </div>
        <div className="guide-shortcuts">
          <span><kbd>Space</kbd>Play / pause</span>
          <span><kbd>⌘ / Ctrl + S</kbd>Save changes</span>
        </div>
      </Modal>
    );
  }

  if (modal === 'search-replace') {
    const matchCount = project
      ? project.words.filter(w => matchesCaptionWord(w.text, searchFindText, searchCaseSensitive)).length
      : 0;

    return (
      <Modal title="Search & Replace" onClose={onClose}>
        <div className="search-replace-modal-body">
          <div className="search-replace-field">
            <label htmlFor="caption-find-word">
              <span>Find</span>
              {searchFindText.trim() && project && (
                <span style={{ color: 'var(--color-emphasis-text)' }}>
                  {matchCount} found
                </span>
              )}
            </label>
            <input
              autoFocus
              id="caption-find-word"
              type="text"
              placeholder="Word to find..."
              value={searchFindText}
              onChange={e => setSearchFindText(e.target.value)}
            />
          </div>

          <div className="search-replace-field">
            <label htmlFor="caption-replacement-word"><span>Replace with</span></label>
            <input
              type="text"
              id="caption-replacement-word"
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

          <p className="muted">Matches complete words, ignoring trailing punctuation. Enter replacement text; blank replacements are disabled.</p>
          <div className="search-replace-actions">
            <button
              type="button"
              className="button secondary compact"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button secondary compact"
              disabled={!matchCount || !searchReplaceText.trim() || !project}
              onClick={onReplaceNext}
            >
              Replace Next
            </button>
            <button
              type="button"
              className="button primary compact"
              disabled={!matchCount || !searchReplaceText.trim() || !project}
              onClick={onReplaceAll}
            >
              Replace All
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return null;
});

StudioModals.displayName = 'StudioModals';
