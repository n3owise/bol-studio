import React from 'react';
import { Plus, Star } from 'lucide-react';
import { templates } from '../lib/captions';
import type { Settings } from '../lib/types';
import { TemplateCard } from './TemplateCard';

/** Preset selection and effect targeting; typography lives in the Text panel. */
export function StylePanel({ settings, updateSettings, busy, onOpenTextPanel }: {
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => void;
  busy: boolean;
  onOpenTextPanel: () => void;
}) {
  return (
    <section className="style-panel panel">
      <div className="panel-tabs"><button className="active" type="button">Templates</button></div>
      <div className="style-content">
        <div className="setting-field">
    <label htmlFor="caption-effect-scope">Apply preset effects to</label>
    <select id="caption-effect-scope" className="font-select" disabled={busy}
      value={settings.effectScope ?? 'all'}
      onChange={event => updateSettings({ effectScope: event.target.value as 'all' | 'emphasis' })}>
      <option value="all">All words</option>
      <option value="emphasis">Emphasized words only</option>
    </select>
    <p className="field-hint">Emphasized words only keeps supporting words in their normal color with a simple entrance.</p>
        </div>
        <div className="template-grid">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              settings={settings}
              selected={settings.template === template.id}
              disabled={busy}
              thirdLine={settings.accentSecondary || settings.textColor}
              onClick={() => updateSettings({ template: template.id, accent: template.accent })}
            />
          ))}
        </div>
        <div className="template-create-scratch-row">
          <button type="button" className="template-create-scratch-btn" onClick={onOpenTextPanel}>
            <Plus size={15} /><span>Build your own</span>
          </button>
        </div>
        <div className="tip-card">
          <div className="tip-icon"><Star size={17} /></div>
          <strong>Timeline word editor</strong>
          <p>Click any word on the bottom timeline to open its editor, adjust duration dividers, and highlight the keyword each line should grow around.</p>
        </div>
      </div>
    </section>
  );
}
