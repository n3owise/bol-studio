import React from 'react';
import { Modal } from './Modal';
import { Keyboard } from 'lucide-react';

interface ShortcutModalProps {
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  category: string;
  items: ShortcutItem[];
}

const SHORTCUTS: ShortcutCategory[] = [
  {
    category: 'Playback & Shuttle',
    items: [
      { keys: ['Space', 'or', 'K'], description: 'Play / Pause playback' },
      { keys: ['←', 'or', '→'], description: 'Nudge playhead by 1 frame (~33ms)' },
      { keys: ['Shift', '← / →'], description: 'Jump playhead by 1.0 second' },
      { keys: ['J'], description: 'Step backward 1 second' },
      { keys: ['L'], description: 'Step forward 1 second' },
      { keys: ['['], description: 'Jump to previous subtitle line' },
      { keys: [']'], description: 'Jump to next subtitle line' },
    ],
  },
  {
    category: 'Editing & Timeline',
    items: [
      { keys: ['Ctrl', 'Z'], description: 'Undo last edit' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo edit' },
      { keys: ['Ctrl', 'S'], description: 'Force save project changes' },
      { keys: ['Ctrl', 'B'], description: 'Split caption line at playhead' },
      { keys: ['Del', 'or', 'Backspace'], description: 'Delete selected word or visual element' },
      { keys: ['Alt', '← / →'], description: 'Nudge selected word timing by 50ms' },
    ],
  },
  {
    category: 'Timeline View & Help',
    items: [
      { keys: ['Ctrl', 'K'], description: 'Open studio command palette' },
      { keys: ['Ctrl', 'Scroll'], description: 'Fluid zoom timeline in / out' },
      { keys: ['↑', 'or', '↓'], description: 'Zoom timeline resolution' },
      { keys: ['?'], description: 'Open / close this keyboard shortcuts guide' },
      { keys: ['Esc'], description: 'Close modals, popovers, and deselect items' },
    ],
  },
];

export function ShortcutModal({ onClose }: ShortcutModalProps) {
  return (
    <Modal title="Keyboard Shortcuts" onClose={onClose} wide>
      <div className="shortcuts-modal-content">
        <p className="shortcuts-modal-intro">
          Speed up your caption and video editing workflow with high-efficiency keyboard controls.
        </p>

        <div className="shortcuts-grid">
          {SHORTCUTS.map(cat => (
            <div key={cat.category} className="shortcuts-category-card">
              <h3 className="shortcuts-category-title">{cat.category}</h3>
              <div className="shortcuts-list">
                {cat.items.map((item, idx) => (
                  <div key={idx} className="shortcut-row">
                    <span className="shortcut-desc">{item.description}</span>
                    <div className="shortcut-keys">
                      {item.keys.map((k, kIdx) =>
                        k === 'or' ? (
                          <span key={kIdx} className="shortcut-or">or</span>
                        ) : (
                          <kbd key={kIdx} className="shortcut-kbd">{k}</kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
