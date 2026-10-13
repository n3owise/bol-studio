import { trackEvent } from '../lib/telemetry';
import { PanelHeading } from './PanelHeading';
import React from 'react';
import { Star, WandSparkles } from 'lucide-react';
import { templates } from '../lib/captions';
import type { Settings } from '../lib/types';
import { TemplateCard } from './TemplateCard';

// Retain renderer compatibility for an existing temporary session, but remove
// these presets from the selectable catalog.
const removedPresets = new Set(['double-trouble', 'bubble-highlight', 'scribble', 'bounce']);
const selectableTemplates = templates.filter(template => !removedPresets.has(template.id));

/** Preset selection and effect targeting; typography lives in the Text panel. */
export function StylePanel({ settings, updateSettings, busy, onOpenTextPanel }: {
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => void;
  busy: boolean;
  onOpenTextPanel: () => void;
}) {
  return (
    <section className="style-panel panel">
      <div className="editor-panel-header"><PanelHeading icon={WandSparkles} title="Style" description="Choose a caption preset and its effects." /></div>
      <div className="style-content">
        <div className="setting-field">
    <label htmlFor="caption-effect-scope">Apply preset effects to</label>
    <select id="caption-effect-scope" className="font-select" disabled={busy}
      value={settings.effectScope ?? 'all'}
      onChange={event => updateSettings({ effectScope: event.target.value as 'all' | 'emphasis' })}>
      <option value="all">All words</option>
      <option value="emphasis">Emphasized words only</option>
    </select>
    <p className="field-hint">Emphasized words only keeps supporting words still in their normal color, appearing as they are spoken.</p>
        </div>
        <div className="template-grid">
          {selectableTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              settings={settings}
              selected={settings.template === template.id}
              disabled={busy}
              thirdLine={settings.accentSecondary || settings.textColor}
              onClick={() => { updateSettings({ template: template.id, accent: template.accent }); trackEvent('preset_selected', { preset: template.id }); }}
            />
          ))}
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
