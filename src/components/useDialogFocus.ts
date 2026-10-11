import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Contain custom dialogs and restore their trigger without changing their layout. */
export function useDialogFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const inert: Array<[HTMLElement, boolean]> = [];
    let branch: HTMLElement = dialog;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          inert.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.getClientRects().length > 0 && !el.closest('[inert]'));
    const focusFirst = () => (controls()[0] ?? dialog).focus();
    dialog.tabIndex = -1;
    focusFirst();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); close.current();
      } else if (event.key === 'Tab') {
        const items = controls();
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (!items.length || (event.shiftKey ? index <= 0 : index < 0 || index === items.length - 1)) {
          event.preventDefault(); (event.shiftKey ? items.at(-1) ?? dialog : items[0] ?? dialog).focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      for (const [element, previous] of inert) element.inert = previous;
      if (trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus();
    };
  }, [open]);
  return ref;
}
