import type { ReactNode } from 'react';
import { AlertTriangle, Check, Info, LoaderCircle, X, CloudUpload } from 'lucide-react';

export function StudioNotice({ title, children, tone = 'info', progress, actions, onDismiss }: {
  title: string; children?: ReactNode; tone?: 'info' | 'success' | 'warning' | 'error' | 'progress';
  progress?: number; actions?: ReactNode; onDismiss?: () => void;
}) {
  const Icon = tone === 'success' ? Check : tone === 'warning' || tone === 'error' ? AlertTriangle : tone === 'progress' ? CloudUpload : Info;
  const percent = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));
  return <section className={`studio-notice studio-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span className="studio-notice-icon"><Icon size={19} strokeWidth={1.8}/></span>
    <div className="studio-notice-content"><strong>{title}</strong>{children && <div className="studio-notice-description">{children}</div>}
      {percent !== undefined && <div className="studio-notice-meter" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{ transform: `scaleX(${percent / 100})` }}/></div>}
      {actions && <div className="studio-notice-actions">{actions}</div>}
    </div>
    {tone === 'progress' && percent === undefined && <LoaderCircle size={16} className="spin" aria-hidden="true"/>}
    {onDismiss && <button type="button" className="icon-button" aria-label="Dismiss notification" onClick={onDismiss}><X size={16}/></button>}
  </section>;
}
