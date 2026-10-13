import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pipette, Plus, X } from 'lucide-react';

type EyeDropperConstructor = new () => { open(): Promise<{ sRGBHex: string }> };
export function ManualColor({ label, value, disabled, onChange, notify }: {
  label: string; value: string; disabled: boolean; onChange: (color: string) => void; notify: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [hex, setHex] = useState(value.toUpperCase());
  const [sampling, setSampling] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (!sampling) popup.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!sampling && !popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const move = (event: Event) => { if (!sampling && !popup.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', move, true);
    window.addEventListener('resize', move);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', move, true); window.removeEventListener('resize', move); };
  }, [open, sampling]);
  useEffect(() => setHex(value.toUpperCase()), [value]);
  const normalize = (text: string) => {
    const bare = text.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(bare)) return `#${bare}`;
    if (/^[0-9a-f]{3}$/i.test(bare)) return `#${bare.split('').map(c => c + c).join('')}`;
    return null;
  };
  const valid = normalize(hex);
  const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
  return <span className="manual-color-launcher">
    <button type="button" ref={trigger} className="manual-color-trigger" disabled={disabled}
      aria-label={`${label} custom color`} aria-expanded={open} aria-haspopup="dialog"
      title="Custom color: picker, HEX and eyedropper"
      onClick={() => {
        if (open) { setOpen(false); return; }
        const box = trigger.current!.getBoundingClientRect();
        setPosition({ left: Math.max(8, Math.min(box.left, window.innerWidth - 276)),
          top: window.innerHeight - box.bottom > 150 ? box.bottom + 8 : Math.max(8, box.top - 144) });
        setOpen(true);
      }}><Plus size={15} /></button>
    {open && createPortal(<div ref={popup} role="dialog" aria-label={`${label} custom color`} className="manual-color-popover" style={position}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
      <div className="manual-color-popover-heading"><span>{label}</span>
        <button type="button" className="icon-button tiny" aria-label="Close color controls" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={14} /></button>
      </div>
      <div className="manual-color-control">
    <input type="color" aria-label={`${label} color picker`} value={value} disabled={disabled || sampling}
      onChange={event => onChange(event.target.value)} />
    <input type="text" aria-label={`${label} HEX`} value={hex} spellCheck={false} maxLength={7}
      disabled={disabled || sampling} aria-invalid={!valid}
      onChange={event => { setHex(event.target.value); const color = normalize(event.target.value); if (color && event.target.value.replace('#', '').length === 6) onChange(color); }}
      onBlur={() => { if (valid) { onChange(valid); setHex(valid.toUpperCase()); } }}
      onKeyDown={event => { if (event.key === 'Enter' && valid) { onChange(valid); setHex(valid.toUpperCase()); } }} />
    <button type="button" className="icon-button" aria-label={`${label} eyedropper`}
      disabled={disabled || sampling || !EyeDropper}
      title={EyeDropper ? 'Pick a color from the screen' : 'Screen eyedropper is unavailable in this browser; use the color picker or HEX field.'}
      onClick={async () => {
        if (!EyeDropper) return;
        setSampling(true);
        try { const result = await new EyeDropper().open(); onChange(result.sRGBHex); }
        catch (error) { if ((error as Error).name !== 'AbortError') notify('Unable to sample a color. Use the color picker or HEX field.'); }
        finally { setSampling(false); }
      }}><Pipette size={16} /></button>
    {!valid && <span className="manual-color-error">Enter a valid HEX color, such as #FF825C.</span>}
      </div>
    </div>, document.body)}
  </span>;
}
