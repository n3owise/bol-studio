import React, { useEffect, useRef, useState } from 'react';
import { Undo2, Redo2, Download, ChevronDown, Keyboard, MoreHorizontal, FolderOpen } from 'lucide-react';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';
import type { Project } from '../lib/types';
import type { Health } from '../lib/shell';

export interface StudioNavbarProps {
  project: Project | null;
  busy: boolean;
  health: Health | boolean | null;
  saveStatus: string;
  hasUndo: boolean;
  hasRedo: boolean;
  theme: 'light' | 'dark';
  authEnabled?: boolean;
  accountEmail?: string | null;
  accountName?: string | null;
  accountMenuOpen?: boolean;
  onRenameProject: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onToggleAccountMenu?: (rect: DOMRect | null) => void;
  onOpenExport: () => void;
  onOpenShortcuts?: () => void;
  onOpenWorkspace?: () => void;
  workspaceLabel?: string;
}

export const StudioNavbar: React.FC<StudioNavbarProps> = React.memo(({
  project,
  busy,
  health,
  saveStatus,
  hasUndo,
  hasRedo,
  theme,
  authEnabled,
  accountEmail,
  accountName,
  accountMenuOpen,
  onRenameProject,
  onUndo,
  onRedo,
  onThemeChange,
  onToggleAccountMenu,
  onOpenExport,
  onOpenShortcuts,
  onOpenWorkspace,
  workspaceLabel,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [moreOpen]);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="studio-navbar" ref={headerRef}>
      <div className="navbar-left">
        <div className="navbar-brand" title="Bol Studio" aria-label="Bol Studio">
          <img src="/bol.studio.svg" alt="bol.studio" className="navbar-brand-logo logo-light-only" />
          <img src="/bol.studio-white.svg" alt="bol.studio" className="navbar-brand-logo logo-dark-only" />
        </div>
        {project && (
          <>
            <div className="nav-divider" />
            <div className="navbar-project">
              <input
                aria-label="Project name"
                className="navbar-project-input"
                value={project.name || project.filename}
                readOnly={busy}
                onChange={e => onRenameProject(e.target.value)}
                maxLength={120}
              />
              <span className="navbar-save-badge">
                <span className={`status-dot ${!health ? 'offline' : saveStatus.includes('Unsaved') ? 'unsaved' : ''}`} />
                <span className="save-text">{saveStatus}</span>
              </span>
            </div>
          </>
        )}
      </div>

      <div className="navbar-center" />

      <div className="navbar-right">
        <button className="mobile-more-button icon-button" aria-label="More editor actions" aria-expanded={moreOpen} aria-controls="navbar-secondary-actions" onClick={()=>setMoreOpen(!moreOpen)}><MoreHorizontal size={20}/></button>
        <div id="navbar-secondary-actions" className={`navbar-secondary-actions ${moreOpen ? 'is-open' : ''}`} onKeyDown={e=>{if(e.key==='Escape')setMoreOpen(false);}}>
        {onOpenWorkspace && <button type="button" className="icon-button" aria-label={workspaceLabel || 'Saved projects and storage options'} title={workspaceLabel} onClick={onOpenWorkspace}><FolderOpen size={19}/></button>}
        <div className="nav-btn-group">
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo (Cmd+Z)"
            disabled={!hasUndo || busy}
            onClick={onUndo}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo (Cmd+Shift+Z)"
            disabled={!hasRedo || busy}
            onClick={onRedo}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="nav-divider" />
        <AnimatedThemeToggler
          theme={theme}
          onThemeChange={onThemeChange}
          className="theme-toggle-btn"
        />
        {onOpenShortcuts && (
          <button
            className="icon-button"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={onOpenShortcuts}
          >
            <Keyboard size={16} />
          </button>
        )}
        </div>
        {authEnabled && accountEmail && (
          <button
            ref={accountButtonRef}
            className="nav-btn ghost"
            aria-label={`Account — ${accountName || accountEmail}`}
            title={accountName ? `${accountName} — ${accountEmail}` : accountEmail}
            aria-haspopup="dialog"
            aria-expanded={accountMenuOpen}
            onClick={() => {
              if (onToggleAccountMenu) {
                const rect = accountButtonRef.current?.getBoundingClientRect() || null;
                onToggleAccountMenu(rect);
              }
            }}
          >
            <span className="account-initial">{(accountName || accountEmail)[0].toUpperCase()}</span>
          </button>
        )}
        <button
          className="nav-btn primary"
          onClick={onOpenExport}
          disabled={!project?.words.length || busy}
        >
          <Download size={15} />
          <span>Export</span>
          <ChevronDown size={13} />
        </button>
      </div>
    </header>
  );
});

StudioNavbar.displayName = 'StudioNavbar';
