import React, { useEffect, useId, useRef } from 'react';
import { X, PanelsTopLeft } from 'lucide-react';

/**
 * A dialog that is a real `<dialog>`.
 *
 * Using the element rather than a positioned div is what gives focus trapping,
 * Escape to close and the inert backdrop for free, instead of three more
 * effects that each have to be kept right.
 */
export function Modal({ title, children, onClose, wide = false, className = '', icon, dismissible = true }: {
  title: string;
  icon?: React.ReactNode;
  dismissible?: boolean;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.showModal();
    return () => {
      el?.close();
      // React can remove the dialog before the browser finishes its native
      // cancel action. Restore focus after that removal has committed.
      requestAnimationFrame(() => { if (trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus(); });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${wide ? 'wide' : ''} ${className}`} onCancel={e => { e.preventDefault(); if (dismissible) onClose(); }} onClick={e => { if (dismissible && e.target === e.currentTarget) onClose(); }}>
    <div className="modal-inner"><div className="modal-head"><div className="modal-heading"><span className="modal-symbol" aria-hidden="true">{icon ?? <PanelsTopLeft size={21} strokeWidth={1.7}/>}</span><h2 id={titleId}>{title}</h2></div>{dismissible && <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button>}</div>{children}</div>
  </dialog>;
}
