import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './TargetCursor.css';

/** TargetCursor bracket treatment adapted from the supplied React Bits source.
 * The system cursor remains untouched; brackets appear only on opted-in buttons.
 */
export function TargetCursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let target: HTMLButtonElement | null = null;
    let frame = 0;
    const hide = () => {
      target = null;
      cancelAnimationFrame(frame);
      root.style.opacity = '0';
    };
    const draw = () => {
      if (!target?.isConnected || target.disabled || !fine.matches) { hide(); return; }
      const box = target.getBoundingClientRect();
      if (!box.width || !box.height) { hide(); return; }
      root.style.left = `${box.left - 5}px`;
      root.style.top = `${box.top - 5}px`;
      root.style.width = `${box.width + 10}px`;
      root.style.height = `${box.height + 10}px`;
      root.style.setProperty('--target-radius', `${Math.min(12, (parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0) + 5)}px`);
      root.style.opacity = '1';
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !fine.matches) { hide(); return; }
      const next = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button[data-snap-target]:not(:disabled)') : null;
      if (!next) { hide(); return; }
      if (next === target) { draw(); return; }
      cancelAnimationFrame(frame);
      target = next;
      if (reduced.matches) { draw(); return; }
      // Expand from the pointer to the button instead of trailing it elsewhere.
      root.style.transition = 'none';
      root.style.left = `${event.clientX - 9}px`;
      root.style.top = `${event.clientY - 9}px`;
      root.style.width = '18px';
      root.style.height = '18px';
      root.style.opacity = '0';
      frame = requestAnimationFrame(() => {
        root.getBoundingClientRect();
        root.style.transition = '';
        draw();
      });
    };
    const press = () => { if (target && !reduced.matches) root.style.transform = 'scale(.98)'; };
    const release = () => { root.style.transform = ''; draw(); };
    const refresh = () => { if (target) draw(); };
    const observer = new MutationObserver(refresh);
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', press, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    document.documentElement.addEventListener('pointerleave', hide);
    fine.addEventListener('change', hide);
    return () => {
      hide(); observer.disconnect();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
      document.documentElement.removeEventListener('pointerleave', hide);
      fine.removeEventListener('change', hide);
    };
  }, []);
  return createPortal(<div ref={rootRef} className="button-target-cursor" aria-hidden="true">
    {[0,1,2,3].map(corner => <span key={corner} className={`button-target-corner corner-${corner}`} />)}
  </div>, document.body);
}
