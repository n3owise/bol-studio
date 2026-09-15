import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, Star, Type, WandSparkles } from 'lucide-react';
import captionFonts from '../lib/caption-fonts.json';
import { templates } from '../lib/captions';
import { MAX_WORDS_PER_PAGE } from '../lib/pages';
import type { SafeAreaSpec, SafeAreaZone } from '../lib/safe-area';
import { defaults, type Settings } from '../lib/types';
import { TemplateCard } from './TemplateCard';

/**
 * Template picker, colours, type and layout for the caption track.
 *
 * Lifted out of App, which had grown to roughly 4,800 lines around sixty
 * useState calls. Size is not the point on its own — the point is that every
 * bug this session where two parts of the app disagreed about the same thing
 * lived in there, and a file that large is where a second answer to a settled
 * question goes unnoticed.
 *
 * The search box, category filter and tab selection moved in with it: nothing
 * outside this panel ever read them, so they were App state only by accident of
 * where they were declared. `safeArea` did not move, because the preview draws
 * it too — recomputing it here would be exactly the duplication this refactor
 * is meant to remove, so it arrives as a prop from the one place that derives it.
 */
export function StylePanel({ settings, updateSettings, busy, notify, isStackedTemplate, safeArea, safeAreaClash }: {
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => void;
  busy: boolean;
  notify: (message: string) => void;
  isStackedTemplate: boolean;
  safeArea: SafeAreaSpec | null;
  safeAreaClash: SafeAreaZone | null;
}) {
  const [rightTab, setRightTab] = useState('templates');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<'all' | 'minimal' | 'bold' | 'kinetic' | 'editorial' | 'fun'>('all');

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
                <button className={rightTab === 'templates' ? 'active' : ''} onClick={() => setRightTab('templates')}>
                  Templates
                </button>
                <button className={rightTab === 'customize' ? 'active' : ''} onClick={() => setRightTab('customize')}>
                  Caption Settings
                </button>
              </div>

              {rightTab === 'templates' && (
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
                {rightTab === 'templates' ? (
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
                      <button type="button" className="template-create-scratch-btn" onClick={() => setRightTab('customize')}>
                        <Plus size={15} />
                        <span>Create from scratch</span>
                        <span className="pro-badge">PRO</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="style-intro">
                      <div>
                        <h2>Caption Settings</h2>
                      <p>Typography, layout, animation & colors.</p>
                    </div>
                    <WandSparkles size={23} />
                  </div>
                  <div className="setting-field">
                    <label htmlFor="caption-font">
                      Font
                      <span>{settings.fontFamily || 'Template default'}</span>
                    </label>
                    <select
                      id="caption-font"
                      className="font-select"
                      disabled={busy}
                      value={settings.fontFamily ?? ''}
                      style={{ fontFamily: settings.fontFamily ? `"${settings.fontFamily}", sans-serif` : undefined }}
                      onChange={e => updateSettings({ fontFamily: e.target.value || undefined })}
                    >
                      <option value="">Template default</option>
                      {captionFonts.map(f => (
                        <option key={f.family} value={f.family}>
                          {f.label}{f.devanagari ? ' · हिन्दी' : ''}
                        </option>
                      ))}
                    </select>
                    {settings.fontFamily && !captionFonts.find(f => f.family === settings.fontFamily)?.devanagari && (
                      <p className="field-hint">
                        No Devanagari in this face — Hindi words fall back to Noto. Pick one marked हिन्दी to keep one font throughout.
                      </p>
                    )}
                    <label htmlFor="caption-size">Font size <span>{settings.fontSize}px</span></label>
                    <div className="slider-row">
                      <button
                        type="button"
                        className="icon-button tiny"
                        title="Decrease font size"
                        onClick={() => updateSettings({ fontSize: Math.max(20, settings.fontSize - 2) })}
                        disabled={busy}
                      >
                        -
                      </button>
                      <input
                        disabled={busy}
                        id="caption-size"
                        type="range"
                        min="24"
                        max="92"
                        value={settings.fontSize}
                        onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                      />
                      <button
                        type="button"
                        className="icon-button tiny"
                        title="Increase font size"
                        onClick={() => updateSettings({ fontSize: Math.min(92, settings.fontSize + 2) })}
                        disabled={busy}
                      >
                        +
                      </button>
                      <span className="slider-number-badge">{settings.fontSize}px</span>
                    </div>
                  </div>
                  <div className="setting-field">
                    <label htmlFor="caption-position">Vertical Position <span>{settings.position}%</span></label>
                    <input
                      disabled={busy}
                      id="caption-position"
                      type="range"
                      min="15"
                      max="88"
                      value={settings.position}
                      onChange={e => updateSettings({ position: Number(e.target.value) })}
                    />
                  </div>
                  <div className="setting-field">
                    {/* This overlay existed and drew itself, but nothing anywhere
                        could switch it on — so the one thing that catches a
                        caption hidden behind the app's interface was unreachable. */}
                    <label htmlFor="safe-area">Show app interface</label>
                    <div className="segmented-control">
                      {([
                        { id: 'none', label: 'Off' },
                        { id: 'reels', label: 'Reels' },
                        { id: 'shorts', label: 'Shorts' },
                      ] as const).map(option => (
                        <button
                          key={option.id}
                          type="button"
                          disabled={busy}
                          className={(settings.safeArea ?? 'none') === option.id ? 'active' : ''}
                          aria-pressed={(settings.safeArea ?? 'none') === option.id}
                          onClick={() => updateSettings({ safeArea: option.id })}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {safeArea && <p className="setting-note">{safeArea.note}</p>}
                    {safeAreaClash && (
                      <p className="setting-warning">
                        At {settings.position}% your captions sit behind &ldquo;{safeAreaClash.label}&rdquo;
                        on {safeArea?.name}. Move them out of that strip.
                      </p>
                    )}
                  </div>
                  <div className="setting-field">
                    <label htmlFor="caption-position-x">Horizontal Position <span>{settings.positionX ?? 50}%</span></label>
                    <input
                      disabled={busy}
                      id="caption-position-x"
                      type="range"
                      min="15"
                      max="85"
                      value={settings.positionX ?? 50}
                      onChange={e => updateSettings({ positionX: Number(e.target.value) })}
                    />
                    <div className="position-presets">
                      {[
                        { name: 'Top', x: 50, y: 22 },
                        { name: 'Center', x: 50, y: 50 },
                        { name: 'Left', x: 25, y: 50 },
                        { name: 'Right', x: 75, y: 50 },
                        { name: 'Bottom', x: 50, y: 72 },
                      ].map(p => (
                        <button
                          disabled={busy}
                          key={p.name}
                          type="button"
                          onClick={() => updateSettings({ position: p.y, positionX: p.x })}
                          className={(settings.position === p.y && (settings.positionX ?? 50) === p.x) ? 'active' : ''}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-field">
                    <label htmlFor="words-per-line">Words Per Line (Chunking) <span>{settings.wordsPerLine}</span></label>
                    <div className="slider-row">
                      <input
                        disabled={busy}
                        id="words-per-line"
                        type="range"
                        min="1"
                        max={MAX_WORDS_PER_PAGE}
                        value={settings.wordsPerLine}
                        onChange={e => updateSettings({ wordsPerLine: Number(e.target.value) })}
                      />
                      <span className="slider-number-badge">{settings.wordsPerLine} w</span>
                    </div>
                  </div>
                  <div className="setting-field">
                    <label htmlFor="motion-strength">Motion Dynamics</label>
                    <div className="segmented-control">
                      {[
                        { label: 'Off', val: 0 },
                        { label: 'Subtle', val: 0.5 },
                        { label: 'Natural', val: 1.0 },
                        { label: 'Extra', val: 1.5 },
                      ].map(m => (
                        <button
                          type="button"
                          key={m.label}
                          disabled={busy}
                          className={settings.motion === m.val ? 'active' : ''}
                          onClick={() => updateSettings({ motion: m.val })}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="toggle-row">
                    <span>ALL CAPS (Capitalize Every Word)</span>
                    <input
                      disabled={busy}
                      type="checkbox"
                      checked={settings.uppercase}
                      onChange={e => updateSettings({ uppercase: e.target.checked })}
                    />
                    <span className="toggle-track" />
                  </label>
                  {/*
                    Three colours, three roles. These used to be two pickers that
                    both wrote `accent`, while `textColor` had no control at all —
                    which is why captions came out all one shade.
                  */}
                  <div className="accent-section">
                    <div className="section-label">TEXT COLOR <span>{(settings.textColor || '#ffffff').toUpperCase()}</span></div>
                    <div className="swatches">
                      {['#ffffff', '#f4f4f5', '#bfa4ff', '#72e6ff', '#d4fa41', '#ff8bb5', '#ffd166', '#111318'].map(color => {
                        const isSelected = (settings.textColor || '#ffffff').toLowerCase() === color.toLowerCase();
                        return (
                          <button
                            disabled={busy}
                            key={color}
                            type="button"
                            className={isSelected ? 'selected' : ''}
                            style={{ background: color }}
                            aria-label={`Text color ${color}`}
                            aria-pressed={isSelected}
                            onClick={() => updateSettings({ textColor: color })}
                          >
                            {isSelected && <Check size={16} />}
                          </button>
                        );
                      })}
                      <label className="custom-color" title="Custom text color">
                        <Plus size={17} />
                        <input
                          disabled={busy}
                          aria-label="Custom text color"
                          type="color"
                          value={settings.textColor || '#ffffff'}
                          onChange={e => updateSettings({ textColor: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                  {isStackedTemplate && (
                    <div className="accent-section">
                      <div className="section-label">
                        THIRD LINE <span>{(settings.accentSecondary || 'MATCHES TEXT').toUpperCase()}</span>
                      </div>
                      <div className="swatches">
                        {['#ffd166', '#ff8bb5', '#7ee7c7', '#c9a6ff', '#57c7ff', '#ff825c'].map(color => {
                          const isSelected = (settings.accentSecondary || '').toLowerCase() === color.toLowerCase();
                          return (
                            <button
                              disabled={busy}
                              key={color}
                              type="button"
                              className={isSelected ? 'selected' : ''}
                              style={{ background: color }}
                              aria-label={`Third line color ${color}`}
                              aria-pressed={isSelected}
                              onClick={() => updateSettings({ accentSecondary: color })}
                            >
                              {isSelected && <Check size={16} />}
                            </button>
                          );
                        })}
                        <label className="custom-color" title="Custom third line color">
                          <Plus size={17} />
                          <input
                            disabled={busy}
                            aria-label="Custom third line color"
                            type="color"
                            value={settings.accentSecondary || '#ffd166'}
                            onChange={e => updateSettings({ accentSecondary: e.target.value })}
                          />
                        </label>
                        <button
                          disabled={busy || !settings.accentSecondary}
                          type="button"
                          className="swatch-reset"
                          title="Match the text colour"
                          aria-label="Reset third line to the text colour"
                          onClick={() => updateSettings({ accentSecondary: undefined })}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="accent-section">
                    <div className="section-label">HIGHLIGHT / ACCENT COLOR <span>{settings.accent.toUpperCase()}</span></div>
                    <div className="swatches">
                      {['#d4fa41', '#c2a1ff', '#ff8bb5', '#ff825c', '#72e6ff', '#ffffff', '#10b981', '#f59e0b'].map(color => (
                        <button
                          disabled={busy}
                          key={color}
                          type="button"
                          className={settings.accent === color ? 'selected' : ''}
                          style={{ background: color }}
                          aria-label={`Highlight ${color}`}
                          aria-pressed={settings.accent === color}
                          onClick={() => updateSettings({ accent: color })}
                        >
                          {settings.accent === color && <Check size={16} />}
                        </button>
                      ))}
                      <label className="custom-color" title="Custom highlight color">
                        <Plus size={17} />
                        <input
                          disabled={busy}
                          aria-label="Custom highlight color"
                          type="color"
                          value={settings.accent}
                          onChange={e => updateSettings({ accent: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    disabled={busy}
                    type="button"
                    className="button secondary full"
                    style={{ marginTop: '16px' }}
                    onClick={() => {
                      const tmpl = templates.find(t => t.id === settings.template);
                      updateSettings({
                        ...defaults,
                        template: settings.template,
                        accent: tmpl?.accent ?? defaults.accent,
                        textColor: undefined,
                        accentSecondary: undefined,
                        fontFamily: undefined,
                      });
                      notify('Reset to template defaults.');
                    }}
                  >
                    <RotateCcw size={15} /> Reset to Defaults
                  </button>
                </>
              )}
              <div className="tip-card">
                <div className="tip-icon"><Star size={17} /></div>
                <strong>Timeline word editor</strong>
                <p>Click any word on the bottom timeline to open its editor, adjust duration dividers, and highlight the keyword each line should grow around.</p>
              </div>
            </div>
          </section>
  );
}
