import React, { useState } from 'react';
import { LogOut, Settings, CheckCircle2, UserRound } from 'lucide-react';
import { Modal } from './Modal';

export function ProfilePopup({ name, email, joined, verified, onClose, onSaveName, onSettings, onSignOut }: {
  name: string; email: string; joined: string; verified: boolean;
  onClose: () => void; onSaveName: (name: string) => Promise<void>;
  onSettings: () => void; onSignOut: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  return <Modal title="Your profile" className="profile-popup" onClose={onClose}>
    <div className="profile-identity">
      <span className="profile-avatar" aria-hidden="true">{(name || email || 'U')[0].toUpperCase()}</span>
      <div><strong>{name || 'Add your name'}</strong><p>{email}</p></div>
    </div>
    <form onSubmit={async event => {
      event.preventDefault(); const next = draft.trim();
      if (!next) { setMessage('Enter your name.'); return; }
      setSaving(true); setMessage('');
      try { await onSaveName(next); setMessage('Name saved.'); }
      catch (error) { setMessage((error as Error).message || 'Unable to save your name.'); }
      finally { setSaving(false); }
    }}>
      <label htmlFor="profile-name">Your name</label>
      <div className="profile-name-row">
        <input id="profile-name" autoComplete="name" required maxLength={80} value={draft}
          disabled={saving} onChange={event => { setDraft(event.target.value); setMessage(''); }} placeholder="Enter your name" />
        <button type="submit" className="button secondary" disabled={saving || draft.trim() === name || !draft.trim()}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      {message && <p className="profile-message" role="status">{message}</p>}
    </form>
    <dl className="profile-details">
      <div><dt>Email status</dt><dd>{verified ? <><CheckCircle2 size={14} />Verified</> : 'Unverified'}</dd></div>
      {joined && <div><dt>Member since</dt><dd>{new Date(joined).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</dd></div>}
      <div><dt>Workspace</dt><dd><UserRound size={14} />Temporary session</dd></div>
    </dl>
    <p className="profile-note">Export your work before closing or refreshing the editor.</p>
    <div className="modal-actions">
      <button type="button" className="button secondary" onClick={onSettings}><Settings size={15} />Settings</button>
      <button type="button" className="button secondary" onClick={onSignOut}><LogOut size={15} />Sign out</button>
    </div>
  </Modal>;
}
