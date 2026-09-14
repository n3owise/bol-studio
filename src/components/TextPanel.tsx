import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Type,
  Heading,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Trash2,
  Copy,
  Clipboard,
  Lock,
  Unlock,
  ChevronDown,
  Search,
  Quote,
  Tag,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Sliders,
} from 'lucide-react';
import type { CanvasTextElement, CanvasTextType, TextAnimationIn, TextAnimationOut, TextCase } from '../lib/types.ts';
import {
  AVAILABLE_FONTS,
  TEXT_PRESETS,
  TEXT_TEMPLATES,
  createDefaultTextElement,
  type TextPreset,
  type TextTemplate,
  type TextTemplateCategory,
} from '../lib/text.ts';

interface TextPanelProps {
  textElements: CanvasTextElement[];
  selectedTextId: string | null;
  onSelectText: (id: string | null) => void;
  onAddText: (type: CanvasTextType) => void;
  onUpdateText: (id: string, update: Partial<CanvasTextElement>) => void;
  onDeleteText: (id: string) => void;
  onDuplicateText: (id: string) => void;
  onReorderText: (id: string, direction: 'forward' | 'backward' | 'front' | 'back') => void;
  copiedStyle: Partial<CanvasTextElement> | null;
  onCopyStyle: (element: CanvasTextElement) => void;
  onPasteStyle: (targetId: string) => void;
}

export const TextPanel: React.FC<TextPanelProps> = ({
  textElements,
  selectedTextId,
  onSelectText,
  onAddText,
  onUpdateText,
  onDeleteText,
  onDuplicateText,
  onReorderText,
  copiedStyle,
  onCopyStyle,
  onPasteStyle,
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'style'>('edit');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [activeLayerMenuId, setActiveLayerMenuId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TextTemplateCategory>('All');
  const [typographyExpanded, setTypographyExpanded] = useState(false);

  const addMenuRef = useRef<HTMLDivElement>(null);
  const layerMenuRef = useRef<HTMLDivElement>(null);
  const textColorInputRef = useRef<HTMLInputElement>(null);
  const bgColorInputRef = useRef<HTMLInputElement>(null);
  const strokeColorInputRef = useRef<HTMLInputElement>(null);
  const shadowColorInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedElement = useMemo(() => {
    return textElements.find(el => el.id === selectedTextId) || textElements[0] || null;
  }, [textElements, selectedTextId]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target as Node)) {
        setActiveLayerMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const filteredTemplates = useMemo(() => {
    return TEXT_TEMPLATES.filter(tpl => {
      const matchesCategory = selectedCategory === 'All' || tpl.category === selectedCategory;
      const matchesSearch =
        !templateSearch.trim() ||
        tpl.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tpl.previewText.toLowerCase().includes(templateSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, templateSearch]);

  const handleApplyPreset = (preset: TextPreset) => {
    if (!selectedElement) return;
    onUpdateText(selectedElement.id, preset.style);
  };

  const handleApplyTemplate = (tpl: TextTemplate) => {
    if (selectedElement) {
      onUpdateText(selectedElement.id, tpl.style);
    } else {
      // If nothing selected, add a heading and apply style
      onAddText('heading');
    }
  };

  const handleQuickPosition = (alignX: number, alignY: number) => {
    if (!selectedElement) return;
    onUpdateText(selectedElement.id, { x: alignX, y: alignY });
  };

  // 1. EMPTY STATE
  if (textElements.length === 0) {
    return (
      <section className="text-panel panel" aria-label="Text Panel">
        <div className="panel-header text-panel-header">
          <div className="text-panel-title-wrap">
            <Type size={18} className="text-panel-icon" />
            <h2 className="panel-title">Text</h2>
          </div>
          <div className="add-text-menu-container" ref={addMenuRef}>
            <button
              type="button"
              className="add-text-dropdown-btn primary"
              onClick={() => setIsAddMenuOpen(prev => !prev)}
              aria-expanded={isAddMenuOpen}
              aria-label="Add text menu"
            >
              <Plus size={14} />
              <span>Add Text</span>
              <ChevronDown size={14} />
            </button>
            {isAddMenuOpen && (
              <div className="add-text-dropdown-menu" role="menu">
                <button
                  type="button"
                  className="add-text-menu-item"
                  onClick={() => {
                    onAddText('heading');
                    setIsAddMenuOpen(false);
                  }}
                >
                  <Heading size={16} />
                  <div className="menu-item-text">
                    <span className="item-name">Heading</span>
                    <span className="item-sub">Large title</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="add-text-menu-item"
                  onClick={() => {
                    onAddText('subheading');
                    setIsAddMenuOpen(false);
                  }}
                >
                  <Heading2 size={16} />
                  <div className="menu-item-text">
                    <span className="item-name">Subheading</span>
                    <span className="item-sub">Medium secondary</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="add-text-menu-item"
                  onClick={() => {
                    onAddText('body');
                    setIsAddMenuOpen(false);
                  }}
                >
                  <AlignLeft size={16} />
                  <div className="menu-item-text">
                    <span className="item-name">Body Text</span>
                    <span className="item-sub">Informational paragraph</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="add-text-menu-item"
                  onClick={() => {
                    onAddText('quote');
                    setIsAddMenuOpen(false);
                  }}
                >
                  <Quote size={16} />
                  <div className="menu-item-text">
                    <span className="item-name">Quote</span>
                    <span className="item-sub">Testimonial or callout</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="add-text-menu-item"
                  onClick={() => {
                    onAddText('label');
                    setIsAddMenuOpen(false);
                  }}
                >
                  <Tag size={16} />
                  <div className="menu-item-text">
                    <span className="item-name">Label</span>
                    <span className="item-sub">Badge or tag</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-panel-empty-state">
          <div className="empty-state-icon-wrap">
            <Type size={36} />
          </div>
          <h3 className="empty-title">Add text to your video</h3>
          <p className="empty-subtitle">Create titles, subtitles, labels and more.</p>

          <button
            type="button"
            className="empty-state-primary-btn"
            onClick={() => onAddText('heading')}
          >
            <Plus size={16} />
            <span>Add Heading</span>
          </button>

          <div className="empty-state-starter-section">
            <span className="starter-section-label">Or choose a starter</span>
            <div className="starter-cards-grid">
              <button
                type="button"
                className="starter-card header-starter"
                onClick={() => onAddText('heading')}
              >
                <span className="starter-preview header">Header</span>
                <span className="starter-card-name">Large Title</span>
              </button>
              <button
                type="button"
                className="starter-card subtitle-starter"
                onClick={() => onAddText('subheading')}
              >
                <span className="starter-preview sub">Subtitle</span>
                <span className="starter-card-name">Secondary</span>
              </button>
              <button
                type="button"
                className="starter-card quote-starter"
                onClick={() => onAddText('quote')}
              >
                <span className="starter-preview quote">“Quote”</span>
                <span className="starter-card-name">Editorial</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // 2. MAIN ACTIVE TEXT PANEL (with EDIT and STYLE tabs + Layers)
  return (
    <section className="text-panel panel" aria-label="Text Panel">
      {/* Top Header */}
      <div className="panel-header text-panel-header">
        <div className="text-panel-title-wrap">
          <Type size={18} className="text-panel-icon" />
          <h2 className="panel-title">Text</h2>
        </div>
        <div className="add-text-menu-container" ref={addMenuRef}>
          <button
            type="button"
            className="add-text-dropdown-btn"
            onClick={() => setIsAddMenuOpen(prev => !prev)}
            aria-expanded={isAddMenuOpen}
            aria-label="Add text"
          >
            <Plus size={14} />
            <span>Add Text</span>
            <ChevronDown size={14} />
          </button>
          {isAddMenuOpen && (
            <div className="add-text-dropdown-menu" role="menu">
              <button
                type="button"
                className="add-text-menu-item"
                onClick={() => {
                  onAddText('heading');
                  setIsAddMenuOpen(false);
                }}
              >
                <Heading size={16} />
                <div className="menu-item-text">
                  <span className="item-name">Heading</span>
                  <span className="item-sub">Large title</span>
                </div>
              </button>
              <button
                type="button"
                className="add-text-menu-item"
                onClick={() => {
                  onAddText('subheading');
                  setIsAddMenuOpen(false);
                }}
              >
                <Heading2 size={16} />
                <div className="menu-item-text">
                  <span className="item-name">Subheading</span>
                  <span className="item-sub">Medium secondary</span>
                </div>
              </button>
              <button
                type="button"
                className="add-text-menu-item"
                onClick={() => {
                  onAddText('body');
                  setIsAddMenuOpen(false);
                }}
              >
                <AlignLeft size={16} />
                <div className="menu-item-text">
                  <span className="item-name">Body Text</span>
                  <span className="item-sub">Informational paragraph</span>
                </div>
              </button>
              <button
                type="button"
                className="add-text-menu-item"
                onClick={() => {
                  onAddText('quote');
                  setIsAddMenuOpen(false);
                }}
              >
                <Quote size={16} />
                <div className="menu-item-text">
                  <span className="item-name">Quote</span>
                  <span className="item-sub">Testimonial or callout</span>
                </div>
              </button>
              <button
                type="button"
                className="add-text-menu-item"
                onClick={() => {
                  onAddText('label');
                  setIsAddMenuOpen(false);
                }}
              >
                <Tag size={16} />
                <div className="menu-item-text">
                  <span className="item-name">Label</span>
                  <span className="item-sub">Badge or tag</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs: EDIT | STYLE */}
      <div className="panel-tabs text-panel-tabs">
        <button
          type="button"
          className={`panel-tab ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          EDIT
        </button>
        <button
          type="button"
          className={`panel-tab ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          STYLE
        </button>
      </div>

      <div className="text-panel-body custom-scroll">
        {selectedElement && activeTab === 'edit' && (
          <div className="text-edit-tab">
            {/* 1. Text Content */}
            <div className="panel-field">
              <div className="field-label-row">
                <label htmlFor="text-content-input" className="field-label">
                  Text Content
                </label>
                <span className="char-counter">
                  {selectedElement.text.length} / 200
                </span>
              </div>
              <textarea
                id="text-content-input"
                ref={textareaRef}
                className="text-content-textarea"
                rows={2}
                maxLength={300}
                value={selectedElement.text}
                onChange={e => onUpdateText(selectedElement.id, { text: e.target.value })}
                placeholder="Enter text..."
              />
            </div>

            {/* 2. Font & Size */}
            <div className="panel-row-two-col">
              <div className="panel-field flex-1">
                <label htmlFor="font-family-select" className="field-label">
                  Font
                </label>
                <select
                  id="font-family-select"
                  className="panel-select"
                  value={selectedElement.fontFamily || 'DM Sans'}
                  onChange={e => onUpdateText(selectedElement.id, { fontFamily: e.target.value })}
                >
                  {AVAILABLE_FONTS.map(font => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div className="panel-field size-field">
                <div className="field-label-row">
                  <label htmlFor="font-size-input" className="field-label">
                    Size
                  </label>
                  <span className="numeric-badge">{selectedElement.fontSize}px</span>
                </div>
                <div className="slider-with-number">
                  <input
                    id="font-size-input"
                    type="range"
                    min={12}
                    max={160}
                    value={selectedElement.fontSize}
                    onChange={e =>
                      onUpdateText(selectedElement.id, { fontSize: Number(e.target.value) })
                    }
                    className="panel-slider"
                  />
                </div>
              </div>
            </div>

            {/* 3. Basic Formatting (B / I / U) and Alignment */}
            <div className="panel-row-two-col">
              <div className="panel-field">
                <span className="field-label">Formatting</span>
                <div className="button-group format-buttons">
                  <button
                    type="button"
                    className={`format-btn ${selectedElement.fontWeight === 'bold' || selectedElement.fontWeight === '800' || selectedElement.fontWeight === '700' ? 'active' : ''}`}
                    onClick={() => {
                      const isBold =
                        selectedElement.fontWeight === 'bold' ||
                        selectedElement.fontWeight === '800' ||
                        selectedElement.fontWeight === '700';
                      onUpdateText(selectedElement.id, { fontWeight: isBold ? 'normal' : 'bold' });
                    }}
                    title="Bold"
                    aria-label="Bold"
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    type="button"
                    className={`format-btn ${selectedElement.fontStyle === 'italic' ? 'active' : ''}`}
                    onClick={() => {
                      onUpdateText(selectedElement.id, {
                        fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic',
                      });
                    }}
                    title="Italic"
                    aria-label="Italic"
                  >
                    <Italic size={14} />
                  </button>
                  <button
                    type="button"
                    className={`format-btn ${selectedElement.textDecoration === 'underline' ? 'active' : ''}`}
                    onClick={() => {
                      onUpdateText(selectedElement.id, {
                        textDecoration:
                          selectedElement.textDecoration === 'underline' ? 'none' : 'underline',
                      });
                    }}
                    title="Underline"
                    aria-label="Underline"
                  >
                    <Underline size={14} />
                  </button>
                </div>
              </div>

              <div className="panel-field">
                <span className="field-label">Alignment</span>
                <div className="button-group align-buttons">
                  <button
                    type="button"
                    className={`format-btn ${selectedElement.align === 'left' ? 'active' : ''}`}
                    onClick={() => onUpdateText(selectedElement.id, { align: 'left' })}
                    title="Align Left"
                    aria-label="Align Left"
                  >
                    <AlignLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className={`format-btn ${selectedElement.align === 'center' || !selectedElement.align ? 'active' : ''}`}
                    onClick={() => onUpdateText(selectedElement.id, { align: 'center' })}
                    title="Align Center"
                    aria-label="Align Center"
                  >
                    <AlignCenter size={14} />
                  </button>
                  <button
                    type="button"
                    className={`format-btn ${selectedElement.align === 'right' ? 'active' : ''}`}
                    onClick={() => onUpdateText(selectedElement.id, { align: 'right' })}
                    title="Align Right"
                    aria-label="Align Right"
                  >
                    <AlignRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Text Color */}
            <div className="panel-field">
              <span className="field-label">Text Color</span>
              <div className="color-picker-row">
                <div
                  className="color-swatch-box"
                  style={{ backgroundColor: selectedElement.color || '#FFFFFF' }}
                  onClick={() => textColorInputRef.current?.click()}
                  title="Choose text color"
                />
                <input
                  ref={textColorInputRef}
                  type="color"
                  className="native-color-input"
                  value={selectedElement.color || '#FFFFFF'}
                  onChange={e => onUpdateText(selectedElement.id, { color: e.target.value })}
                />
                <input
                  type="text"
                  className="hex-code-input"
                  value={selectedElement.color || '#FFFFFF'}
                  onChange={e => onUpdateText(selectedElement.id, { color: e.target.value })}
                />
              </div>
            </div>

            {/* 5. Background */}
            <div className="panel-field">
              <div className="field-label-row">
                <span className="field-label">Background</span>
                <div className="bg-toggle-pills">
                  <button
                    type="button"
                    className={`pill-btn ${!selectedElement.backgroundColor || selectedElement.backgroundOpacity === 0 ? 'active' : ''}`}
                    onClick={() =>
                      onUpdateText(selectedElement.id, {
                        backgroundColor: undefined,
                        backgroundOpacity: 0,
                      })
                    }
                  >
                    None
                  </button>
                  <button
                    type="button"
                    className={`pill-btn ${selectedElement.backgroundColor && (selectedElement.backgroundOpacity ?? 0) > 0 ? 'active' : ''}`}
                    onClick={() =>
                      onUpdateText(selectedElement.id, {
                        backgroundColor: selectedElement.backgroundColor || '#000000',
                        backgroundOpacity: selectedElement.backgroundOpacity || 80,
                      })
                    }
                  >
                    Color
                  </button>
                </div>
              </div>

              {selectedElement.backgroundColor && (selectedElement.backgroundOpacity ?? 0) > 0 && (
                <div className="bg-details-row">
                  <div className="color-picker-row flex-1">
                    <div
                      className="color-swatch-box"
                      style={{ backgroundColor: selectedElement.backgroundColor }}
                      onClick={() => bgColorInputRef.current?.click()}
                      title="Choose background color"
                    />
                    <input
                      ref={bgColorInputRef}
                      type="color"
                      className="native-color-input"
                      value={selectedElement.backgroundColor}
                      onChange={e =>
                        onUpdateText(selectedElement.id, { backgroundColor: e.target.value })
                      }
                    />
                    <input
                      type="text"
                      className="hex-code-input"
                      value={selectedElement.backgroundColor}
                      onChange={e =>
                        onUpdateText(selectedElement.id, { backgroundColor: e.target.value })
                      }
                    />
                  </div>

                  <div className="bg-opacity-wrap">
                    <span className="small-label">Opacity</span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={selectedElement.backgroundOpacity ?? 80}
                      onChange={e =>
                        onUpdateText(selectedElement.id, {
                          backgroundOpacity: Number(e.target.value),
                        })
                      }
                      className="panel-slider tiny"
                    />
                    <span className="numeric-badge-sm">
                      {selectedElement.backgroundOpacity ?? 80}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Quick Position & X/Y */}
            <div className="panel-field">
              <span className="field-label">Position</span>
              <div className="position-section-wrap">
                <div className="position-grid-3x3" aria-label="Quick position grid">
                  <button
                    type="button"
                    className="grid-pos-btn"
                    title="Top Left"
                    onClick={() => handleQuickPosition(20, 20)}
                  />
                  <button
                    type="button"
                    className="grid-pos-btn"
                    title="Top Center"
                    onClick={() => handleQuickPosition(50, 20)}
                  />
                  <button
                    type="button"
                    className="grid-pos-btn"
                    title="Top Right"
                    onClick={() => handleQuickPosition(80, 20)}
                  />
                  <button
                    type="button"
                    className="grid-pos-btn"
                    title="Center Left"
                    onClick={() => handleQuickPosition(20, 50)}
                  />
                  <button
                    type="button"
                    className="grid-pos-btn active"
                    title="Center"
                    onClick={() => handleQuickPosition(50, 50)}
                  />
                  <button
                    type="button"
                    className="grid-pos-btn"
                    title="Center Right"
                    onClick={() => handleQuickPosition(80, 50)}
                  />
                  <button
                    type="button"
                    className="grid-pos-btn"
                    title="Bottom Left"
                    onClick={() => handleQuickPosition(20, 80)}
                  />
                  <button
                    type="button"
                    className="grid-pos-btn"
                    title="Bottom Center"
                    onClick={() => handleQuickPosition(50, 80)}
                  />
                  <button
                    type="button"
                    className="grid-pos-btn"
                    title="Bottom Right"
                    onClick={() => handleQuickPosition(80, 80)}
                  />
                </div>

                <div className="numeric-coords-col">
                  <div className="coord-row">
                    <span className="coord-label">X</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(selectedElement.x)}
                      onChange={e =>
                        onUpdateText(selectedElement.id, { x: Number(e.target.value) })
                      }
                      className="coord-input"
                    />
                    <span className="coord-unit">%</span>
                  </div>
                  <div className="coord-row">
                    <span className="coord-label">Y</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(selectedElement.y)}
                      onChange={e =>
                        onUpdateText(selectedElement.id, { y: Number(e.target.value) })
                      }
                      className="coord-input"
                    />
                    <span className="coord-unit">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. Collapsible Typography Section */}
            <div className="collapsible-section">
              <button
                type="button"
                className="collapsible-header-btn"
                onClick={() => setTypographyExpanded(prev => !prev)}
                aria-expanded={typographyExpanded}
              >
                <Sliders size={14} />
                <span>Advanced Typography</span>
                <ChevronDown
                  size={14}
                  className={`chevron-icon ${typographyExpanded ? 'open' : ''}`}
                />
              </button>

              {typographyExpanded && (
                <div className="collapsible-content">
                  {/* Line Height */}
                  <div className="panel-field">
                    <div className="field-label-row">
                      <span className="field-label">Line Height</span>
                      <span className="numeric-badge">{selectedElement.lineHeight ?? 1.2}</span>
                    </div>
                    <input
                      type="range"
                      min={0.8}
                      max={2.4}
                      step={0.05}
                      value={selectedElement.lineHeight ?? 1.2}
                      onChange={e =>
                        onUpdateText(selectedElement.id, { lineHeight: Number(e.target.value) })
                      }
                      className="panel-slider"
                    />
                  </div>

                  {/* Letter Spacing */}
                  <div className="panel-field">
                    <div className="field-label-row">
                      <span className="field-label">Letter Spacing</span>
                      <span className="numeric-badge">{selectedElement.letterSpacing ?? 0}px</span>
                    </div>
                    <input
                      type="range"
                      min={-4}
                      max={20}
                      step={0.5}
                      value={selectedElement.letterSpacing ?? 0}
                      onChange={e =>
                        onUpdateText(selectedElement.id, { letterSpacing: Number(e.target.value) })
                      }
                      className="panel-slider"
                    />
                  </div>

                  {/* Text Case */}
                  <div className="panel-field">
                    <span className="field-label">Text Case</span>
                    <div className="case-pills-row">
                      {(['normal', 'uppercase', 'lowercase', 'title'] as TextCase[]).map(tc => (
                        <button
                          key={tc}
                          type="button"
                          className={`pill-btn ${selectedElement.textCase === tc || (!selectedElement.textCase && tc === 'normal') ? 'active' : ''}`}
                          onClick={() => onUpdateText(selectedElement.id, { textCase: tc })}
                        >
                          {tc === 'normal'
                            ? 'Aa'
                            : tc === 'uppercase'
                              ? 'AA'
                              : tc === 'lowercase'
                                ? 'aa'
                                : 'Title'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedElement && activeTab === 'style' && (
          <div className="text-style-tab">
            {/* 1. Quick Presets */}
            <div className="panel-field">
              <span className="field-label">Text Presets</span>
              <div className="preset-pills-grid">
                {TEXT_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    className="preset-pill-card"
                    onClick={() => handleApplyPreset(preset)}
                  >
                    <span className={`preset-sample ${preset.id}`}>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Text Templates with Search & Categories */}
            <div className="panel-field">
              <span className="field-label">Text Templates</span>
              <div className="template-search-bar">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search text templates..."
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  className="template-search-input"
                />
              </div>

              {/* Category Pills */}
              <div className="template-category-row">
                {(['All', 'Titles', 'Subtitles', 'Labels', 'Quotes'] as TextTemplateCategory[]).map(
                  cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ),
                )}
              </div>

              {/* Template Cards Grid */}
              {filteredTemplates.length > 0 ? (
                <div className="text-templates-grid">
                  {filteredTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="template-style-card"
                      onClick={() => handleApplyTemplate(tpl)}
                    >
                      <span className="tpl-preview-text">{tpl.previewText}</span>
                      <span className="tpl-name">{tpl.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-templates-box">
                  <p>No text styles found</p>
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setTemplateSearch('')}
                  >
                    Clear Search
                  </button>
                </div>
              )}
            </div>

            {/* 3. Stroke */}
            <div className="panel-field">
              <div className="field-label-row">
                <span className="field-label">Stroke</span>
                <span className="numeric-badge">{selectedElement.strokeWidth ?? 0}px</span>
              </div>
              <div className="stroke-control-row">
                <div className="color-picker-row">
                  <div
                    className="color-swatch-box"
                    style={{ backgroundColor: selectedElement.strokeColor || '#000000' }}
                    onClick={() => strokeColorInputRef.current?.click()}
                    title="Stroke color"
                  />
                  <input
                    ref={strokeColorInputRef}
                    type="color"
                    className="native-color-input"
                    value={selectedElement.strokeColor || '#000000'}
                    onChange={e =>
                      onUpdateText(selectedElement.id, { strokeColor: e.target.value })
                    }
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={14}
                  value={selectedElement.strokeWidth ?? 0}
                  onChange={e =>
                    onUpdateText(selectedElement.id, { strokeWidth: Number(e.target.value) })
                  }
                  className="panel-slider flex-1"
                />
              </div>
            </div>

            {/* 4. Shadow */}
            <div className="panel-field">
              <div className="field-label-row">
                <span className="field-label">Shadow</span>
                <label className="switch-toggle" aria-label="Toggle shadow">
                  <input
                    type="checkbox"
                    checked={!!selectedElement.shadowEnabled}
                    onChange={e =>
                      onUpdateText(selectedElement.id, { shadowEnabled: e.target.checked })
                    }
                  />
                  <span className="switch-slider round" />
                </label>
              </div>

              {selectedElement.shadowEnabled && (
                <div className="shadow-controls-box">
                  <div className="panel-row-two-col">
                    <div className="color-picker-row flex-1">
                      <div
                        className="color-swatch-box"
                        style={{ backgroundColor: selectedElement.shadowColor || 'rgba(0,0,0,0.6)' }}
                        onClick={() => shadowColorInputRef.current?.click()}
                        title="Shadow color"
                      />
                      <input
                        ref={shadowColorInputRef}
                        type="color"
                        className="native-color-input"
                        value="#000000"
                        onChange={e =>
                          onUpdateText(selectedElement.id, { shadowColor: e.target.value })
                        }
                      />
                      <span className="small-label">Color</span>
                    </div>
                    <div className="shadow-param-col">
                      <div className="field-label-row">
                        <span className="small-label">Blur</span>
                        <span className="numeric-badge-sm">
                          {selectedElement.shadowBlur ?? 6}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={selectedElement.shadowBlur ?? 6}
                        onChange={e =>
                          onUpdateText(selectedElement.id, { shadowBlur: Number(e.target.value) })
                        }
                        className="panel-slider tiny"
                      />
                    </div>
                  </div>

                  <div className="panel-row-two-col">
                    <div className="shadow-param-col flex-1">
                      <div className="field-label-row">
                        <span className="small-label">Offset X</span>
                        <span className="numeric-badge-sm">{selectedElement.shadowX ?? 0}</span>
                      </div>
                      <input
                        type="range"
                        min={-20}
                        max={20}
                        value={selectedElement.shadowX ?? 0}
                        onChange={e =>
                          onUpdateText(selectedElement.id, { shadowX: Number(e.target.value) })
                        }
                        className="panel-slider tiny"
                      />
                    </div>
                    <div className="shadow-param-col flex-1">
                      <div className="field-label-row">
                        <span className="small-label">Offset Y</span>
                        <span className="numeric-badge-sm">{selectedElement.shadowY ?? 2}</span>
                      </div>
                      <input
                        type="range"
                        min={-20}
                        max={20}
                        value={selectedElement.shadowY ?? 2}
                        onChange={e =>
                          onUpdateText(selectedElement.id, { shadowY: Number(e.target.value) })
                        }
                        className="panel-slider tiny"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Opacity & Rotation */}
            <div className="panel-row-two-col">
              <div className="panel-field flex-1">
                <div className="field-label-row">
                  <span className="field-label">Opacity</span>
                  <span className="numeric-badge">{selectedElement.opacity ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedElement.opacity ?? 100}
                  onChange={e =>
                    onUpdateText(selectedElement.id, { opacity: Number(e.target.value) })
                  }
                  className="panel-slider"
                />
              </div>

              <div className="panel-field flex-1">
                <div className="field-label-row">
                  <span className="field-label">Rotation</span>
                  <span className="numeric-badge">{selectedElement.rotation ?? 0}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedElement.rotation ?? 0}
                  onChange={e =>
                    onUpdateText(selectedElement.id, { rotation: Number(e.target.value) })
                  }
                  className="panel-slider"
                />
              </div>
            </div>

            {/* 6. Simple Animation */}
            <div className="panel-field">
              <div className="field-label-row">
                <span className="field-label">Simple Animation</span>
                <Sparkles size={14} className="sparkle-icon" />
              </div>
              <div className="animation-grid-row">
                <div className="anim-col">
                  <label htmlFor="anim-in-select" className="small-label">
                    In
                  </label>
                  <select
                    id="anim-in-select"
                    className="panel-select"
                    value={selectedElement.animationIn || 'none'}
                    onChange={e =>
                      onUpdateText(selectedElement.id, {
                        animationIn: e.target.value as TextAnimationIn,
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="fade">Fade</option>
                    <option value="pop">Pop</option>
                    <option value="slide">Slide</option>
                    <option value="scale">Scale</option>
                  </select>
                </div>

                <div className="anim-col">
                  <label htmlFor="anim-out-select" className="small-label">
                    Out
                  </label>
                  <select
                    id="anim-out-select"
                    className="panel-select"
                    value={selectedElement.animationOut || 'none'}
                    onChange={e =>
                      onUpdateText(selectedElement.id, {
                        animationOut: e.target.value as TextAnimationOut,
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="fade">Fade</option>
                    <option value="drop">Drop</option>
                    <option value="slide">Slide</option>
                    <option value="scale">Scale</option>
                  </select>
                </div>
              </div>

              {((selectedElement.animationIn && selectedElement.animationIn !== 'none') ||
                (selectedElement.animationOut && selectedElement.animationOut !== 'none')) && (
                <div className="anim-duration-row">
                  <div className="field-label-row">
                    <span className="small-label">Duration</span>
                    <span className="numeric-badge-sm">
                      {selectedElement.animationDuration ?? 0.4}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={selectedElement.animationDuration ?? 0.4}
                    onChange={e =>
                      onUpdateText(selectedElement.id, {
                        animationDuration: Number(e.target.value),
                      })
                    }
                    className="panel-slider tiny"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Text Layers List Section */}
        <div className="text-layers-section">
          <div className="layers-header-row">
            <div className="layers-title-wrap">
              <Layers size={14} />
              <span className="layers-heading">Text Layers</span>
            </div>
            <span className="layers-count-badge">{textElements.length}</span>
          </div>

          <div className="layers-list" role="list">
            {textElements.map(el => {
              const isSelected = el.id === selectedElement?.id;
              const isMenuOpen = activeLayerMenuId === el.id;

              return (
                <div
                  key={el.id}
                  className={`layer-row-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectText(el.id)}
                  role="listitem"
                >
                  <div className="layer-type-icon">
                    <Type size={14} />
                  </div>

                  <span className="layer-text-preview" title={el.text}>
                    {el.text || 'Empty Text'}
                  </span>

                  {el.locked && (
                    <span className="layer-lock-badge" title="Locked">
                      <Lock size={12} />
                    </span>
                  )}

                  {/* Visibility Toggle Eye */}
                  <button
                    type="button"
                    className={`layer-visibility-btn ${el.visible === false ? 'hidden-layer' : ''}`}
                    onClick={e => {
                      e.stopPropagation();
                      onUpdateText(el.id, { visible: el.visible === false ? true : false });
                    }}
                    title={el.visible === false ? 'Show layer' : 'Hide layer'}
                    aria-label={el.visible === false ? 'Show layer' : 'Hide layer'}
                  >
                    {el.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>

                  {/* Layer Menu ... */}
                  <div className="layer-menu-container" ref={isMenuOpen ? layerMenuRef : undefined}>
                    <button
                      type="button"
                      className="layer-menu-btn"
                      onClick={e => {
                        e.stopPropagation();
                        setActiveLayerMenuId(prev => (prev === el.id ? null : el.id));
                      }}
                      title="Layer options"
                      aria-label="Layer options"
                      aria-expanded={isMenuOpen}
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {isMenuOpen && (
                      <div className="layer-context-menu" role="menu">
                        <button
                          type="button"
                          className="layer-context-menu-item"
                          onClick={e => {
                            e.stopPropagation();
                            onSelectText(el.id);
                            setActiveTab('edit');
                            setActiveLayerMenuId(null);
                            textareaRef.current?.focus();
                          }}
                        >
                          <Type size={14} />
                          <span>Edit Text</span>
                        </button>

                        <button
                          type="button"
                          className="layer-context-menu-item"
                          onClick={e => {
                            e.stopPropagation();
                            onDuplicateText(el.id);
                            setActiveLayerMenuId(null);
                          }}
                        >
                          <Copy size={14} />
                          <span>Duplicate</span>
                        </button>

                        <button
                          type="button"
                          className="layer-context-menu-item"
                          onClick={e => {
                            e.stopPropagation();
                            onCopyStyle(el);
                            setActiveLayerMenuId(null);
                          }}
                        >
                          <Clipboard size={14} />
                          <span>Copy Style</span>
                        </button>

                        <button
                          type="button"
                          className={`layer-context-menu-item ${!copiedStyle ? 'disabled' : ''}`}
                          disabled={!copiedStyle}
                          onClick={e => {
                            e.stopPropagation();
                            if (copiedStyle) {
                              onPasteStyle(el.id);
                            }
                            setActiveLayerMenuId(null);
                          }}
                        >
                          <Clipboard size={14} />
                          <span>Paste Style</span>
                        </button>

                        <div className="menu-separator" />

                        <button
                          type="button"
                          className="layer-context-menu-item"
                          onClick={e => {
                            e.stopPropagation();
                            onReorderText(el.id, 'forward');
                            setActiveLayerMenuId(null);
                          }}
                        >
                          <ArrowUp size={14} />
                          <span>Bring Forward</span>
                        </button>

                        <button
                          type="button"
                          className="layer-context-menu-item"
                          onClick={e => {
                            e.stopPropagation();
                            onReorderText(el.id, 'backward');
                            setActiveLayerMenuId(null);
                          }}
                        >
                          <ArrowDown size={14} />
                          <span>Send Backward</span>
                        </button>

                        <button
                          type="button"
                          className="layer-context-menu-item"
                          onClick={e => {
                            e.stopPropagation();
                            onUpdateText(el.id, { locked: !el.locked });
                            setActiveLayerMenuId(null);
                          }}
                        >
                          {el.locked ? <Unlock size={14} /> : <Lock size={14} />}
                          <span>{el.locked ? 'Unlock' : 'Lock'}</span>
                        </button>

                        <div className="menu-separator" />

                        <button
                          type="button"
                          className="layer-context-menu-item danger"
                          onClick={e => {
                            e.stopPropagation();
                            onDeleteText(el.id);
                            setActiveLayerMenuId(null);
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
