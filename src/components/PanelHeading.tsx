import React from 'react';
import type { LucideIcon } from 'lucide-react';

/** Shared identity and hierarchy for every editor panel. */
export function PanelHeading({ icon: Icon, title, description }: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return <div className="editor-panel-heading">
    <div className="editor-panel-title-row">
      <span className="editor-panel-icon" aria-hidden="true"><Icon size={18} strokeWidth={2} /></span>
      <h2>{title}</h2>
    </div>
    <p>{description}</p>
  </div>;
}
