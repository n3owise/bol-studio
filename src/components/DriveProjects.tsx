import { useEffect, useState } from 'react';
import { FolderOpen, LoaderCircle, Cloud, X, ShieldCheck, ArrowUpRight, RefreshCw, AlertTriangle, Clock3, Unplug } from 'lucide-react';
import { Modal } from './Modal';
import { StudioNotice } from './StudioNotice';
import { connectDrive, driveStatus, savedProjects, type SavedProject } from '../lib/drive';
import { request } from '../lib/api';
export function DriveProjects({ onClose, onOpen, onMode, notify, hasOpenProject, onDisconnect, transferBusy = false }: {
  hasOpenProject: boolean;
  transferBusy?: boolean;
  onDisconnect: () => Promise<void>;
  onClose: () => void; onOpen: (id: string) => Promise<void>; onMode: (mode: 'temporary' | 'drive') => void; notify: (s: string) => void;
}) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ title: string; body: string; label: string; action: () => Promise<void> } | null>(null);
  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const state = await driveStatus(); setStatus(state);
      setProjects(state.connected ? await savedProjects() : []);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const run = async (action: () => Promise<void>) => {
    setWorking(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };
  return <Modal title={status?.connected ? 'Your saved projects' : 'Your workspace'} icon={<Cloud size={22}/>} className="drive-workspace-modal" onClose={onClose} dismissible={!working}>
    {confirmation ? <div className="workspace-confirmation">
      <span className="workspace-warning-symbol"><AlertTriangle size={25}/></span>
      <h3>{confirmation.title}</h3><p>{confirmation.body}</p>
      <div className="modal-actions"><button className="button" disabled={working} onClick={() => setConfirmation(null)}>Go back</button><button className="button primary" disabled={working} onClick={() => void run(async () => { await confirmation.action(); setConfirmation(null); })}>{working ? <LoaderCircle size={16} className="spin"/> : null}{confirmation.label}</button></div>
    </div> : <>
      {status?.connected ? <>
        <div className="workspace-connected"><span><span className="workspace-status-dot"/> Google Drive connected</span><button className="icon-button" aria-label="Refresh saved projects" disabled={loading || working} onClick={() => void refresh()}><RefreshCw size={16} className={loading ? 'spin' : ''}/></button></div>
        <p className="modal-lede">Pick up where you left off, on any device.</p>
      </> : <p className="modal-lede">A quick edit, or a project you can come back to.</p>}
      {loading && <div className="workspace-skeleton" role="status" aria-label="Loading your workspace"><span/><span/><span/></div>}
      {!loading && status?.connected && <>
        <div className="drive-project-list">{projects.map(p => <div className="drive-project" key={p.id}>
          <button className="button" disabled={working} onClick={() => void run(() => onOpen(p.id))}>
            <span className="workspace-file-icon"><FolderOpen size={21}/></span><span className="workspace-file-name">{p.name}<small>{p.revision === 0 ? 'Finishing upload · open to retry' : new Date(p.updated_at).toLocaleString()}</small></span><ArrowUpRight size={16}/>
          </button>
          <button className="icon-button" disabled={working} aria-label={`Remove ${p.name} from saved projects`} onClick={() => setConfirmation({title:'Remove saved project?', body:'This removes it from Bol Studio. Your original files stay in Google Drive.', label:'Remove project', action:async () => { await request(`/cloud/projects/${p.id}`, { method: 'DELETE' }); await refresh(); }})}><X size={16}/></button>
        </div>)}</div>
        {projects.length === 0 && <div className="workspace-empty"><FolderOpen size={28}/><h3>Your next project starts here</h3><p>Upload a video to save it to your Drive workspace.</p></div>}
        <button className="button primary workspace-primary" disabled={working} onClick={() => { onMode('drive'); onClose(); }}><Cloud size={17}/> {hasOpenProject ? 'Use Drive for new uploads' : 'Upload a new video'}</button>
        <div className="workspace-disconnect-row"><div><strong>Google Drive</strong><span>{transferBusy ? 'Finish the current transfer before unlinking.' : 'You can disconnect at any time.'}</span></div><button className="button" disabled={working || transferBusy} onClick={() => setConfirmation({title:'Unlink Google Drive?',body:'This revokes Bol Studio’s Drive access. Your files stay in Google Drive, and you remain signed in to Bol Studio. Reconnect to open saved projects or save further edits.',label:'Unlink Drive',action:async () => { await onDisconnect(); await refresh(); notify('Google Drive unlinked. Your files remain in Drive.'); }})}><Unplug size={16}/>Unlink Drive</button></div>
        <details className="workspace-details"><summary>Storage &amp; privacy</summary><p>Bol Studio uses your Google storage and only accesses files it creates or you select. Audio goes to our caption processor; captions and edits are saved to your account.</p><button className="button" disabled={working} onClick={() => { onMode('temporary'); onClose(); }}>Use temporary mode</button></details>
      </>}
      {!loading && status && !status.connected && <div className="workspace-choices">
        <div className="workspace-choice"><span className="workspace-choice-icon"><Cloud size={22}/></span><h3>Keep it in your Drive</h3><p>Save videos, captions and edits. Continue on any device.</p><div className="workspace-privacy"><ShieldCheck size={16}/><span>Only app-created or selected files. Your other files stay private.</span></div><button className="button primary" disabled={working || !status.configured} onClick={() => {
          if (hasOpenProject) setConfirmation({ title:'Connect your Drive?', body:'Connecting leaves this editing session. Download any unsaved work before continuing.', label:'Continue to Google', action:connectDrive });
          else void run(connectDrive);
        }}><Cloud size={16}/>Connect Google Drive<ArrowUpRight size={15}/></button>{!status.configured && <p>Drive saving is unavailable right now.</p>}</div>
        <div className="workspace-choice workspace-choice--temporary"><Clock3 size={20}/><div><h3>Just this session</h3><p>Download your work before leaving. It won’t be saved to your account.</p></div><button className="button" disabled={working} onClick={() => { onMode('temporary'); onClose(); }}>Continue temporarily</button></div>
      </div>}
    </>}
    {working && <StudioNotice tone="progress" title="Working on it">Keep this tab open while we finish.</StudioNotice>}
    {error && <StudioNotice tone="error" title="Workspace unavailable" actions={<button className="button" disabled={working || loading} onClick={() => void refresh()}><RefreshCw size={14}/>Try again</button>}>{error}</StudioNotice>}
  </Modal>;
}
