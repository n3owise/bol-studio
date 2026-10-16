import { useEffect, useRef } from 'react';

type Props = {
  axis: 'panel' | 'timeline';
  value: number | null;
  onChange: (value: number) => void;
  onReset: () => void;
};

export function EditorResizeHandle({ axis, value, onChange, onReset }: Props) {
  const drag = useRef<{ id: number; start: number; size: number } | null>(null);
  const previous = useRef({ cursor: '', select: '' });
  const limits = (el: HTMLElement) => {
    const area = el.closest(axis === 'panel' ? '.editor-grid' : '.preview-panel');
    const size = axis === 'panel' ? area?.clientWidth : area?.clientHeight;
    return { min: axis === 'panel' ? 260 : 160, max: Math.max(axis === 'panel' ? 260 : 160, (size || 800) - (axis === 'panel' ? 320 : 180)) };
  };
  const restore = () => {
    if (!drag.current) return;
    drag.current = null;
    document.body.style.cursor = previous.current.cursor;
    document.body.style.userSelect = previous.current.select;
  };
  useEffect(() => restore, []);
  return <div
    className={`editor-resize-handle editor-resize-${axis}`}
    role="separator" tabIndex={0}
    aria-label={axis === 'panel' ? 'Resize editing panel' : 'Resize timeline'}
    aria-orientation={axis === 'panel' ? 'vertical' : 'horizontal'}
    aria-valuemin={axis === 'panel' ? 260 : 160}
    aria-valuemax={axis === 'panel' ? Math.max(260, window.innerWidth - 320) : Math.max(160, window.innerHeight - 180)}
    aria-valuenow={Math.round(value ?? (axis === 'panel' ? 360 : 280))}
    title="Drag to resize · Double-click to reset · Arrow keys to adjust"
    onDoubleClick={onReset}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const area = event.currentTarget.closest('.editor-grid');
      const box = axis === 'panel' ? area?.querySelector(':scope > .panel') : event.currentTarget.parentElement;
      const rect = box?.getBoundingClientRect();
      if (!rect) return;
      previous.current = { cursor: document.body.style.cursor, select: document.body.style.userSelect };
      drag.current = { id: event.pointerId, start: axis === 'panel' ? event.clientX : event.clientY, size: axis === 'panel' ? rect.width : rect.height };
      document.body.style.cursor = axis === 'panel' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const active = drag.current;
      if (!active || active.id !== event.pointerId) return;
      const delta = axis === 'panel' ? event.clientX - active.start : active.start - event.clientY;
      const { min, max } = limits(event.currentTarget);
      onChange(Math.max(min, Math.min(max, active.size + delta)));
    }}
    onPointerUp={event => {
      restore();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={restore}
    onLostPointerCapture={restore}
    onKeyDown={event => {
      const keys = axis === 'panel' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowDown', 'ArrowUp'];
      if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); onReset(); return; }
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const { min, max } = limits(event.currentTarget);
      const area = axis === 'panel' ? event.currentTarget.closest('.editor-grid')?.querySelector(':scope > .panel') : event.currentTarget.parentElement;
      const rect = area?.getBoundingClientRect();
      const current = value ?? (axis === 'panel' ? rect?.width : rect?.height) ?? min;
      onChange(Math.max(min, Math.min(max, current + (event.key === keys[0] ? -1 : 1) * (event.shiftKey ? 40 : 16))));
    }}
  ><span /></div>;
}
