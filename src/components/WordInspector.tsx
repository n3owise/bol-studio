import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { ChevronDown, Edit3, Scissors, Trash2, Type, X } from 'lucide-react';
import type { Word } from '../lib/types';

export type WordCase = 'normal' | 'uppercase' | 'lowercase' | 'title';

/**
 * Recase a word. `normal` restores what the recogniser first wrote, so undoing
 * a case change does not have to guess at the original capitalisation.
 */
export function recase(word: Pick<Word, 'text' | 'original'>, c: WordCase): string {
  switch (c) {
    case 'uppercase': return word.text.toUpperCase();
    case 'lowercase': return word.text.toLowerCase();
    case 'title': return word.text.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
    case 'normal': return word.original || (word.text.charAt(0).toUpperCase() + word.text.substring(1).toLowerCase());
  }
}

export type WordInspectorProps = {
  word: Word;
  /** The text being typed, which is not the word's text until it is committed. */
  draftText: string;
  position: { top: number; left: number };
  onDraftChange: (text: string) => void;
  /** Commit the draft — on blur, or on Enter. */
  onCommit: () => void;
  /** Abandon the draft and put the word's own text back in the field. */
  onRevert: () => void;
  onToggleHighlight: () => void;
  onApplyCase: (c: WordCase) => void;
  onSplit: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** Focus the text field on open. The timeline does; the caption panel does not. */
  autoFocus?: boolean;
};

/**
 * The one editor for a single word, opened from the caption panel and from the
 * timeline alike.
 *
 * The two used to be separate pieces of markup with separate class names — the
 * timeline's offered a highlight pair and save/cancel buttons, the panel's a
 * case menu and a split — so the same word looked and behaved like two
 * different things depending on where it was clicked. Sharing the component is
 * what keeps them from drifting apart again; everything that differs between
 * the two call sites arrives as a callback.
 */
export const WordInspector = forwardRef<HTMLDivElement, WordInspectorProps>(function WordInspector(
  { word, draftText, position, onDraftChange, onCommit, onRevert, onToggleHighlight,
    onApplyCase, onSplit, onDelete, onClose, autoFocus },
  ref,
) {
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.select();
  }, [autoFocus]);

  const applyCase = (c: WordCase) => {
    onApplyCase(c);
    setCaseMenuOpen(false);
  };

  return (
    <div
      ref={ref}
      className="caption-word-inspector-popover"
      style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, zIndex: 9999 }}
      onClick={e => e.stopPropagation()}
    >
      <div className="popover-header">
        <div className="popover-title-row">
          <span className="popover-tag">WORD</span>
          <div className="popover-word-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="popover-word-input"
              value={draftText}
              autoFocus={autoFocus}
              onChange={e => onDraftChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onCommit();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  onRevert();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={onCommit}
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
          onClick={() => { setCaseMenuOpen(false); onClose(); }}
        >
          <X size={13} />
        </button>
      </div>

      <div className="popover-section">
        <div className="popover-quick-actions">
          <button
            type="button"
            className={`popover-action-btn ${word.spotlight ? 'active' : ''}`}
            title={word.spotlight ? 'Remove highlight' : 'Highlight this word (⚡)'}
            aria-pressed={!!word.spotlight}
            onClick={onToggleHighlight}
          >
            <span className="popover-zap-icon">⚡</span>
            <span>{word.spotlight ? 'Highlighted' : 'Highlight'}</span>
          </button>
        </div>

        <div className="popover-secondary-actions">
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
                <button type="button" onClick={() => applyCase('normal')}>Normal</button>
                <button type="button" onClick={() => applyCase('uppercase')}>UPPERCASE</button>
                <button type="button" onClick={() => applyCase('lowercase')}>lowercase</button>
                <button type="button" onClick={() => applyCase('title')}>Title Case</button>
              </div>
            )}
          </div>

          <button type="button" className="popover-action-btn" title="Split caption here" onClick={onSplit}>
            <Scissors size={12} />
            <span>Split</span>
          </button>

          <button type="button" className="popover-action-btn danger" title="Delete word" onClick={onDelete}>
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
});
