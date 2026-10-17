import { useEffect, useState } from 'react';
import { FolderOpen, LoaderCircle, Cloud, X } from 'lucide-react';
import { Modal } from './Modal';
import { connectDrive, driveStatus, savedProjects, type SavedProject } from '../lib/drive';
import { request } from '../lib/api';
export function DriveProjects({ onClose, onOpen, onMode, notify, hasOpenProject }: {
  hasOpenProject: boolean;
  onClose: () => void; onOpen: (id: string) => Promise<void>; onMode: (mode: 'temporary' | 'drive') => void; notify: (s: string) => void;
}) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    try {
      const state = await driveStatus(); setStatus(state);
      if (state.connected) setProjects(await savedProjects());
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void refresh(); }, []);
  const run = async (action: () => Promise<void>) => {
    setWorking(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };
  return <Modal title="Your workspace" onClose={onClose}>
    <p className="modal-lede">{status?.connected ? "Google Drive is connected to your account. Open a saved project to continue on this device." : "Work once, or keep projects in your own Google Drive."}</p>
    <div className="drive-options">
      <button className="button" disabled={working} onClick={() => { onMode('temporary'); onClose(); }}>Continue temporarily</button>
      <p>Temporary files are processed on our server and cleaned up. Download your work before leaving; this mode does not save a project to your account.</p>
      <div className="drive-option">
        <h3><Cloud size={18}/> Save with Google Drive</h3>
        <p>We create a Bol Studio folder and request access only to files the app creates or you explicitly select—not your entire Drive. Audio is sent to our caption processor; editing settings are saved to your Bol Studio account.</p>
        <p>Your available Google storage is used. Disconnecting does not delete your Drive files.</p>
        {!status && !error && <LoaderCircle className="spin" aria-label="Checking Drive connection"/>}
        {status?.connected ? <div className="modal-actions">
          <button className="button primary" disabled={working} onClick={() => { onMode('drive'); onClose(); }}>Use Drive for new uploads</button>
          <button className="button" disabled={working} onClick={() => void run(async () => {
            await request('/cloud/connection', { method: 'DELETE' }); onMode('temporary'); setProjects([]); await refresh(); notify('Drive disconnected. Your files remain in Google Drive.');
          })}>Disconnect</button>
        </div> : <button className="button primary" disabled={working || !status?.configured} onClick={() => { if (!hasOpenProject || window.confirm('Connecting Google Drive leaves this temporary session. Download any work you want to keep before continuing. Continue connecting?')) void run(connectDrive); }}>Connect Google Drive</button>}
        {status && !status.configured && <p role="status">Drive saving is not available yet. You can continue temporarily.</p>}
      </div>
    </div>
    <h3>Saved projects</h3>
    {status?.connected && projects.length === 0 && <p>No saved projects yet. Choose Drive mode and upload a video.</p>}
    <div className="drive-project-list">{projects.map(p => <div className="drive-project" key={p.id}>
      <button className="button" disabled={working} onClick={() => void run(() => onOpen(p.id))}>
        <FolderOpen size={18}/><span>{p.name}<small>{p.revision === 0 ? 'Upload pending · retry opening' : new Date(p.updated_at).toLocaleString()}</small></span>
      </button>
      <button className="icon-button" disabled={working} aria-label={`Remove ${p.name} from saved projects`} onClick={() => {
        if (window.confirm('Remove this project from Bol Studio? Its files will remain in your Google Drive.')) void run(async () => {
          await request(`/cloud/projects/${p.id}`, { method: 'DELETE' }); await refresh();
        });
      }}><X size={17}/></button>
    </div>)}</div>
    {working && <p role="status"><LoaderCircle size={16} className="spin"/> Working… Keep this tab open.</p>}
    {error && <p role="alert">{error}</p>}
  </Modal>;
}
