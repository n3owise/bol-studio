import React, { useMemo, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, Italic, Strikethrough, Underline, ChevronDown, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, Star, Type, WandSparkles } from 'lucide-react';
import { captionFonts } from '../lib/caption-fonts';
import { templates } from '../lib/captions';
import { treatmentFor } from '../remotion/treatments';
import { MAX_WORDS_PER_PAGE } from '../lib/pages';
import type { SafeAreaSpec, SafeAreaZone } from '../lib/safe-area';
import { defaults, type Settings } from '../lib/types';
import { TemplateCard } from './TemplateCard';

/**
 * The template picker.
 *
 * Typography used to sit behind a second tab here, which put two unrelated
 * jobs under one icon: choosing a look, and then adjusting the type of the one
 * you chose. Those are separate decisions made at separate moments, so the
 * adjusting moved to its own Text panel and this is only the choosing.
 *
 * The search box, category filter and tab selection are local because nothing
 * outside reads them.
 */
export function StylePanel({ settings, updateSettings, busy, onOpenTextPanel }: {
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => void;
  busy: boolean;
  /** "Create from scratch" opened the settings tab; typography now lives elsewhere. */
  onOpenTextPanel: () => void;
}) {
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<'all' | 'minimal' | 'bold' | 'kinetic' | 'editorial' | 'fun'>('all');

  // What the chosen template would make the highlighted word, so the control
  // starts where the design puts it rather than at some arbitrary default.
  const heroScale = treatmentFor(settings.template).heroScale;

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const q = templateSearch.trim().toLowerCase();
      const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (templateCategory === 'all') return true;
      if (templateCategory === 'minimal') return t.id === 'soft-focus' || t.id === 'editorial' || t.id === 'karaoke';
      if (templateCategory === 'bold') return t.id === 'welcome-stack' || t.id === 'double-trouble' || t.id === 'editing-school' || t.id === 'mumbai';
      if (templateCategory === 'kinetic') return t.id === 'kinetic' || t.id === 'bounce' || t.id === 'pop-up' || t.id.startsWith('mogrt-');
      if (templateCategory === 'editorial') return t.id === 'editorial' || t.id === 'soft-focus' || t.id === 'kalakar-shadow';
      if (templateCategory === 'fun') return t.id === 'scribble' || t.id === 'bubble-highlight' || t.id === 'neon' || t.id === 'glow-script';
      return true;
    });
  }, [templateSearch, templateCategory]);

  return (
            <section className="style-panel panel">
              <div className="panel-tabs">
                <button className="active">Templates</button>
              </div>

              {(
                <>
                  <div className="template-search-row">
                    <div className="template-search-input-wrap">
                      <Search size={14} className="template-search-icon" />
                      <input
                        type="text"
                        placeholder="Search templates..."
                        value={templateSearch}
                        onChange={e => setTemplateSearch(e.target.value)}
                        className="template-search-input"
                      />
                      <button type="button" className="template-filter-btn" title="Filter templates">
                        <SlidersHorizontal size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="template-category-pills">
                    {(['all', 'minimal', 'bold', 'kinetic', 'editorial', 'fun'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        className={`category-pill ${templateCategory === cat ? 'active' : ''}`}
                        onClick={() => setTemplateCategory(cat)}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="style-content">
                <>
                    <div className="template-grid">
                      {filteredTemplates.map(template => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          selected={settings.template === template.id}
                          disabled={busy}
                          thirdLine={settings.accentSecondary || settings.textColor}
                          onClick={() => {
                            updateSettings({ template: template.id, accent: template.accent });
                          }}
                        />
                      ))}
                    </div>

                    <div className="template-create-scratch-row">
                      <button type="button" className="template-create-scratch-btn" onClick={onOpenTextPanel}>
                        <Plus size={15} />
                        <span>Create from scratch</span>
                        <span className="pro-badge">PRO</span>
                      </button>
                    </div>
                  </>
              <div className="tip-card">
                <div className="tip-icon"><Star size={17} /></div>
                <strong>Timeline word editor</strong>
                <p>Click any word on the bottom timeline to open its editor, adjust duration dividers, and highlight the keyword each line should grow around.</p>
              </div>
            </div>
          </section>
  );
}
