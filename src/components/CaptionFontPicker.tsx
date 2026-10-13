import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { captionFonts } from '../lib/caption-fonts';

export function CaptionFontPicker({ label, value, disabled, onChange }: {
  label: string; value: string; disabled: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
  const show = () => {
    if (disabled || !trigger.current) return;
    const box = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - 14;
    const height = Math.min(280, Math.max(below, box.top - 14));
    setPosition({ left: box.left, width: box.width, top: below >= height ? box.bottom + 6 : box.top - height - 6, maxHeight: height });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    popup.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const move = (event: Event) => { if (!popup.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
    };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const choose = (family: string) => { onChange(family); close(true); };
  return <div className="caption-font-picker">
    <button type="button" className="caption-font-trigger" ref={trigger} aria-label={label}
      disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => open ? close() : show()}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); } }}>
      <span style={{ fontFamily: value ? `"${value}", sans-serif` : undefined }}>{value || 'Template default'}</span>
      <ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && createPortal(<div id={id} ref={popup} role="listbox" className="caption-font-options caption-font-popup"
      aria-label={`${label} choices`} style={position}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) close(); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
          const current = options.indexOf(document.activeElement as HTMLButtonElement);
          const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
          options[index]?.focus();
        }
      }}>
      <button type="button" role="option" aria-selected={!value} onClick={() => choose('')}>
        <span>Template default</span>{!value && <Check size={15} />}
      </button>
      {captionFonts.map(font => <button type="button" role="option" key={font.family}
        aria-selected={value === font.family} onClick={() => choose(font.family)}>
        <span><span className="caption-font-name">{font.label}{font.devanagari ? ' · हिन्दी' : ''}</span>
          <span className="caption-font-sample" style={{ fontFamily: `"${font.family}", sans-serif` }}>Aa · Caption{font.devanagari ? ' · नमस्ते' : ''}</span></span>
        {value === font.family && <Check size={15} />}
      </button>)}
    </div>, document.body)}
  </div>;
}
