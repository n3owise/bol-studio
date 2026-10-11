import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * A dialog that is a real `<dialog>`.
 *
 * Using the element rather than a positioned div is what gives focus trapping,
 * Escape to close and the inert backdrop for free, instead of three more
 * effects that each have to be kept right.
 */
export function Modal({ title, children, onClose, wide = false }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
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
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-inner"><div className="modal-head"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</div>
  </dialog>;
}
