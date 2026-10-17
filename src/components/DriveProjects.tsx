import { useEffect, useState } from 'react';
import { FolderOpen, LoaderCircle, Cloud, ShieldCheck, ArrowUpRight, RefreshCw, Unplug, Clock3 } from 'lucide-react';
import { Modal } from './Modal';
import { StudioNotice } from './StudioNotice';
import { connectDrive, driveStatus, savedProjects, type SavedProject } from '../lib/drive';

export function DriveProjectLibrary({ connected, checking, onOpen, onSettings }: {
  connected: boolean; checking: boolean; onOpen: (id: string) => Promise<void>; onSettings: () => void;
}) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(connected);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setError(''); setProjects([]);
    if (!connected) { setLoading(false); return; }
    setLoading(true);
    void savedProjects().then(rows => { if (live) setProjects(rows); })
      .catch(e => { if (live) setError((e as Error).message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [connected, attempt]);
  return <section className="drive-panel-library" aria-label="Saved Drive projects">
    <div className="drive-panel-title"><h3><Cloud size={17}/>Saved projects</h3><button type="button" className="icon-button" aria-label="Refresh saved projects" disabled={!connected || loading || !!opening} onClick={() => setAttempt(n => n + 1)}><RefreshCw size={15} className={loading ? 'spin' : ''}/></button></div>
    {checking || loading ? <div className="workspace-skeleton" role="status" aria-label="Loading saved projects"><span/><span/></div> : !connected ? <div className="drive-panel-empty"><FolderOpen size={24}/><p>Keep your projects across devices.</p><button className="button" onClick={onSettings}>Connect Drive in Settings<ArrowUpRight size={14}/></button></div> : <>
      <p className="drive-panel-caption">Your Bol Studio projects in Google Drive.</p>
      {!error && projects.length === 0 && <p className="drive-panel-caption">No saved projects yet. Upload a video with Drive mode enabled in Settings.</p>}
      <div className="drive-project-list">{projects.map(p => <button type="button" className="button drive-panel-project" key={p.id} disabled={!!opening} onClick={async () => {
        setOpening(p.id); setError('');
        try { await onOpen(p.id); } catch (e) { setError((e as Error).message); }
        finally { setOpening(null); }
      }}><span className="workspace-file-icon">{opening === p.id ? <LoaderCircle size={19} className="spin"/> : <FolderOpen size={19}/>}</span><span className="workspace-file-name">{p.name}<small>{opening === p.id ? 'Opening project…' : p.revision === 0 ? 'Upload pending · open to retry' : new Date(p.updated_at).toLocaleString()}</small></span><ArrowUpRight size={14}/></button>)}</div>
    </>}
    {error && <StudioNotice tone="error" title="Couldn’t load your project" actions={<button className="button" onClick={() => setAttempt(n => n + 1)}>Try again</button>}>{error}</StudioNotice>}
  </section>;
}

export function DriveConnectionSettings({ connected, mode, hasOpenProject, transferBusy, onDisconnect, onMode, onConnectionChange, notify }: {
  connected: boolean; mode: 'temporary' | 'drive'; hasOpenProject: boolean; transferBusy: boolean;
  onDisconnect: () => Promise<void>; onMode: (mode: 'temporary' | 'drive') => void;
  onConnectionChange: (connected: boolean) => void; notify: (message: string) => void;
}) {
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState<'connect' | 'disconnect' | null>(null);
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    void driveStatus().then(status => { if (live) { setConfigured(status.configured); onConnectionChange(status.connected); } })
      .catch(e => { if (live) setError((e as Error).message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // Parent state changes do not restart the connection request.
  }, [attempt]);
  const run = async (action: () => Promise<void>) => {
    setWorking(true); setError('');
    try { await action(); setConfirmation(null); } catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };
  return <section className="settings-block drive-connection-settings" aria-label="Google Drive connection">
    <div className="section-label"><Cloud size={15}/>Google Drive</div>
    {loading ? <p className="drive-panel-caption"><LoaderCircle className="spin" size={15}/>Checking your connection…</p> : <>
      <div className="drive-connection-state"><span className={connected ? 'workspace-status-dot' : 'drive-offline-dot'}/><strong>{connected ? 'Connected' : 'Not connected'}</strong></div>
      <p className="setting-note">{connected ? 'Your videos stay in Drive. Open saved projects from the Media panel.' : 'Save videos to your own Drive and continue editing on any device.'}</p>
      {connected ? <>
        <div className="drive-mode-control" role="group" aria-label="Storage for new uploads"><button className={`button ${mode === 'drive' ? 'primary' : ''}`} disabled={working} aria-pressed={mode === 'drive'} onClick={() => onMode('drive')}><Cloud size={15}/>Save to Drive</button><button className={`button ${mode === 'temporary' ? 'primary' : ''}`} disabled={working} aria-pressed={mode === 'temporary'} onClick={() => onMode('temporary')}><Clock3 size={15}/>Temporary</button></div>
        <p className="drive-panel-caption">Applies to new uploads. Temporary projects aren’t saved to your account.</p>
        <button className="button drive-unlink-button" disabled={working || transferBusy} onClick={() => setConfirmation('disconnect')}><Unplug size={16}/>Unlink Drive</button>
        {transferBusy && <p className="drive-panel-caption">Finish the current transfer before unlinking.</p>}
      </> : <button className="button primary workspace-primary" disabled={working || !configured} onClick={() => hasOpenProject ? setConfirmation('connect') : void run(connectDrive)}><Cloud size={16}/>Connect Google Drive<ArrowUpRight size={15}/></button>}
      {!configured && <p className="drive-panel-caption">Drive saving is unavailable right now.</p>}
      <details className="workspace-details"><summary><ShieldCheck size={14}/>Storage &amp; privacy</summary><p>Bol Studio only accesses Drive files it creates or you select. Audio goes to our caption processor; captions and edits are saved to your account. Unlinking revokes Drive access without deleting files or signing you out.</p></details>
    </>}
    {error && <StudioNotice tone="error" title="Drive connection unavailable" actions={<button className="button" onClick={() => setAttempt(n => n + 1)}>Try again</button>}>{error}</StudioNotice>}
    {confirmation && <Modal title={confirmation === 'disconnect' ? 'Unlink Google Drive?' : 'Connect your Drive?'} icon={confirmation === 'disconnect' ? <Unplug size={21}/> : <Cloud size={21}/>} dismissible={!working} onClose={() => setConfirmation(null)}>
      <p className="modal-lede">{confirmation === 'disconnect' ? 'Your files stay in Google Drive, and you remain signed in to Bol Studio. Reconnect to open saved projects or save further edits.' : 'Connecting leaves this editing session. Download any unsaved work before continuing.'}</p>
      <div className="modal-actions"><button className="button" disabled={working} onClick={() => setConfirmation(null)}>Go back</button><button className="button primary" disabled={working || (confirmation === 'disconnect' && transferBusy)} onClick={() => void run(confirmation === 'disconnect' ? async () => { await onDisconnect(); notify('Google Drive unlinked. Your files remain in Drive.'); } : connectDrive)}>{working && <LoaderCircle size={15} className="spin"/>}{confirmation === 'disconnect' ? 'Unlink Drive' : 'Continue to Google'}</button></div>
      {error && <StudioNotice tone="error" title="Couldn’t finish">{error}</StudioNotice>}
    </Modal>}
  </section>;
}
