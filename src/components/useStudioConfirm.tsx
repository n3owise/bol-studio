import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
export function useStudioConfirm() {
  const [message, setMessage] = useState<string | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const finish = useCallback((value: boolean) => { resolveRef.current?.(value); resolveRef.current = null; setMessage(null); }, []);
  useEffect(() => () => { resolveRef.current?.(false); }, []);
  const confirm = useCallback((body: string) => new Promise<boolean>(resolve => {
    resolveRef.current?.(false); resolveRef.current = resolve; setMessage(body);
  }), []);
  const dialog = message && <Modal title="Leave unsaved edits?" icon={<AlertTriangle size={22}/>} className="confirmation-modal" onClose={() => finish(false)}>
    <p className="modal-lede">{message}</p><div className="modal-actions"><button type="button" className="button" onClick={() => finish(false)} autoFocus>Keep editing</button><button type="button" className="button primary" onClick={() => finish(true)}>Open saved project</button></div>
  </Modal>;
  return { confirm, dialog };
}
