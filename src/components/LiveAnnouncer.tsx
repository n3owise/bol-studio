import React, { useEffect, useState } from 'react';

export interface LiveAnnouncerProps {
  notice?: string | null;
  saveStatus?: string | null;
  uploadProgress?: number | null;
  busy?: boolean;
}

/**
 * Screen reader live region announcer for WCAG 4.1.3 (Status Messages).
 * Ensures dynamic updates (saves, notices, upload progress, export) are announced
 * without interrupting current screen reader focus.
 */
export const LiveAnnouncer: React.FC<LiveAnnouncerProps> = React.memo(({
  notice,
  saveStatus,
  uploadProgress,
  busy,
}) => {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (notice) {
      setAnnouncement(notice);
    }
  }, [notice]);

  useEffect(() => {
    if (uploadProgress !== null) {
      if (uploadProgress === 100) {
        setAnnouncement('Upload complete. Processing media.');
      }
    }
  }, [uploadProgress]);

  useEffect(() => {
    if (saveStatus && saveStatus.includes('Unsaved')) {
      setAnnouncement('Unsaved changes pending.');
    } else if (saveStatus && saveStatus.includes('Saved')) {
      setAnnouncement('All changes saved.');
    }
  }, [saveStatus]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcement}
    </div>
  );
});

LiveAnnouncer.displayName = 'LiveAnnouncer';
