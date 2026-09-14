import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileAudio,
  Film,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  MoreHorizontal,
  Pause,
  Pencil,
  Pipette,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react';
import { API, deleteMediaAsset, duplicateMediaAsset, fetchMediaAssets, updateMediaAsset, uploadMediaAsset } from '../lib/api';
import { applyChromaKey, drawKeyedMedia, hexToRgb, samplePixelColor } from '../lib/chromakey';
import { defaultGreenScreen, type CanvasVisualElement, type GreenScreenSettings, type MediaAsset, type Project } from '../lib/types';

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB
const SUPPORTED_EXTENSIONS = new Set([
  'mp4', 'mov', 'webm', 'avi', 'mkv',
  'mp3', 'wav', 'm4a',
  'png', 'jpg', 'jpeg', 'webp',
]);

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0))} ${sizes[i]}`;
}

function formatDuration(s?: number): string {
  if (s === undefined || s === null || s <= 0) return '00:00';
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getAssetUsageCount(asset: MediaAsset, project: Project | null): number {
  if (!project) return 0;
  let count = 0;
  const isPrimaryOrActive =
    project.activeMediaAssetId === asset.id ||
    (asset.id === 'primary' && !project.activeMediaAssetId);
  if (isPrimaryOrActive) count++;
  if (project.canvasElements && Array.isArray(project.canvasElements)) {
    count += project.canvasElements.filter(el => el.assetId === asset.id).length;
  }
  return count;
}

interface UploadingItem {
  id: string;
  file: File;
  filename: string;
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  status: 'uploading' | 'processing' | 'error';
  errorMessage?: string;
  abort?: () => void;
}

interface MediaPanelProps {
  project: Project | null;
  onSelectMediaForCanvas: (asset: MediaAsset) => void;
  onAddImageToCanvas: (asset: MediaAsset) => void;
  onAddMediaToCanvas?: (asset: MediaAsset) => void;
  onRemoveMediaAsset?: (assetId: string) => void;
  onUpdateProjectAssets: (assets: MediaAsset[]) => void;
  notify: (msg: string) => void;
  onStartProjectFromUpload?: (file: File) => void;
}

export function MediaPanel({
  project,
  onSelectMediaForCanvas,
  onAddImageToCanvas,
  onAddMediaToCanvas,
  onRemoveMediaAsset,
  onUpdateProjectAssets,
  notify,
  onStartProjectFromUpload,
}: MediaPanelProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [uploadingList, setUploadingList] = useState<UploadingItem[]>([]);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'duration'>('newest');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [menuAssetId, setMenuAssetId] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'preview' | 'rename' | 'remove' | 'greenscreen' | null>(null);
  const [targetAsset, setTargetAsset] = useState<MediaAsset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load project media assets
  const loadAssets = useCallback(async () => {
    if (!project) {
      setAssets([]);
      return;
    }
    try {
      const list = await fetchMediaAssets(project.id);
      setAssets(list);
      onUpdateProjectAssets(list);
    } catch {
      // Fallback: primary asset from project
      if (project.filename) {
        const primary: MediaAsset = {
          id: 'primary',
          name: project.name,
          filename: project.filename,
          mediaType: project.mediaType as any,
          size: 0,
          duration: project.duration,
          width: project.width,
          height: project.height,
          createdAt: project.created,
          url: `${API}/api/projects/${project.id}/media`,
          thumbnailUrl: `${API}/api/projects/${project.id}/media-thumbnail`,
          greenScreen: (project as any).greenScreen,
        };
        setAssets([primary]);
        onUpdateProjectAssets([primary]);
      }
    }
  }, [project, onUpdateProjectAssets]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const showSuccess = (text: string) => {
    setSuccessBanner(text);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setSuccessBanner(null), 4000);
  };

  // Upload handler
  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    for (const file of files) {
      const ext = getExtension(file.name);
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        notify('Unsupported file type.');
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        notify('This file is larger than the maximum allowed size.');
        continue;
      }

      // If no project exists yet, use the parent's project creation handler
      if (!project) {
        if (onStartProjectFromUpload) {
          onStartProjectFromUpload(file);
        } else {
          notify('Please open or create a project first.');
        }
        return;
      }

      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newItem: UploadingItem = {
        id: uploadId,
        file,
        filename: file.name,
        progress: 0,
        loadedBytes: 0,
        totalBytes: file.size,
        status: 'uploading',
      };

      setUploadingList(prev => [...prev, newItem]);

      const { promise, abort } = uploadMediaAsset(project.id, file, (pct, loaded, total) => {
        setUploadingList(prev =>
          prev.map(item =>
            item.id === uploadId
              ? { ...item, progress: pct, loadedBytes: loaded, totalBytes: total, status: pct >= 100 ? 'processing' : 'uploading' }
              : item
          )
        );
      });

      setUploadingList(prev =>
        prev.map(item => (item.id === uploadId ? { ...item, abort } : item))
      );

      try {
        const createdAsset = await promise;
        setUploadingList(prev => prev.filter(item => item.id !== uploadId));
        setAssets(prev => [createdAsset, ...prev]);
        showSuccess(files.length > 1 ? `✓ ${files.length} files uploaded successfully` : '✓ Media uploaded successfully');
      } catch (err: any) {
        if (err?.message === 'Upload canceled.') {
          setUploadingList(prev => prev.filter(item => item.id !== uploadId));
        } else {
          setUploadingList(prev =>
            prev.map(item =>
              item.id === uploadId
                ? { ...item, status: 'error', errorMessage: 'Media processing failed.' }
                : item
            )
          );
        }
      }
    }
  };

  const cancelUpload = (id: string) => {
    setUploadingList(prev => {
      const target = prev.find(item => item.id === id);
      target?.abort?.();
      return prev.filter(item => item.id !== id);
    });
  };

  const retryUpload = (item: UploadingItem) => {
    cancelUpload(item.id);
    void handleFiles([item.file]);
  };

  // Drag and drop into Media panel
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  // Filter & sort assets
  const filteredAssets = useMemo(() => {
    let result = [...assets];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.filename.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortOption === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortOption === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortOption === 'duration') {
        return (b.duration || 0) - (a.duration || 0);
      }
      return 0;
    });
    return result;
  }, [assets, searchQuery, sortOption]);

  const handleAddMediaToCanvas = (asset: MediaAsset) => {
    if (onAddMediaToCanvas) {
      onAddMediaToCanvas(asset);
      notify(`Added "${asset.name}" to canvas`);
    } else if (asset.mediaType === 'image') {
      onAddImageToCanvas(asset);
      notify(`Added "${asset.name}" to canvas`);
    } else {
      onSelectMediaForCanvas(asset);
      notify(`Set "${asset.name}" as canvas media`);
    }
  };

  const handleDuplicate = async (asset: MediaAsset) => {
    if (!project) return;
    try {
      const dup = await duplicateMediaAsset(project.id, asset.id);
      setAssets(prev => [dup, ...prev]);
      notify(`Duplicated as "${dup.name}"`);
    } catch {
      notify('Failed to duplicate media.');
    }
  };

  const handleDownload = (asset: MediaAsset) => {
    if (!project) return;
    const downloadUrl = `${API}/api/projects/${project.id}/assets/${asset.id}/download`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = asset.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Close menus on click outside
  useEffect(() => {
    const onClick = () => setMenuAssetId(null);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  return (
    <section className="media-panel panel" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp4,.mov,.webm,.avi,.mkv,.mp3,.wav,.m4a,.png,.jpg,.jpeg,.webp,video/*,audio/*,image/*"
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files) {
            void handleFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Temporary Success Banner */}
      {successBanner && (
        <div className="media-success-banner" role="status">
          <span>{successBanner}</span>
          <button type="button" className="icon-button tiny" onClick={() => setSuccessBanner(null)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Upload Progress Cards */}
      {uploadingList.length > 0 && (
        <div className="upload-progress-stack">
          {uploadingList.map(item => (
            <div key={item.id} className={`upload-progress-card ${item.status === 'error' ? 'has-error' : ''}`}>
              <div className="upload-progress-head">
                <div className="upload-file-info">
                  <span className="upload-progress-title" title={item.filename}>{item.filename}</span>
                  <span className="upload-progress-meta">
                    {item.status === 'processing'
                      ? 'Processing…'
                      : item.status === 'error'
                      ? item.errorMessage || 'Failed'
                      : `${formatBytes(item.loadedBytes)} / ${formatBytes(item.totalBytes)}`}
                  </span>
                </div>
                <div className="upload-progress-actions">
                  {item.status === 'uploading' && (
                    <span className="upload-progress-percent">{item.progress}%</span>
                  )}
                  {item.status === 'processing' && (
                    <LoaderCircle size={14} className="spin text-muted" />
                  )}
                  {item.status === 'uploading' && (
                    <button
                      type="button"
                      className="upload-cancel-btn"
                      title="Cancel upload"
                      aria-label="Cancel upload"
                      onClick={() => cancelUpload(item.id)}
                    >
                      Cancel
                    </button>
                  )}
                  {item.status === 'error' && (
                    <>
                      <button
                        type="button"
                        className="upload-retry-btn"
                        onClick={() => retryUpload(item)}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        className="upload-cancel-btn"
                        onClick={() => cancelUpload(item.id)}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>

              {item.status !== 'error' && (
                <div className="upload-bar-track">
                  <div
                    className="upload-bar-fill"
                    style={{ width: `${item.status === 'processing' ? 100 : item.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State vs Project Media Library */}
      {assets.length === 0 && uploadingList.length === 0 ? (
        <div className="media-empty-state">
          <div className="media-panel-title-row">
            <h2>Media</h2>
          </div>

          <div
            className={`media-upload-box ${isDraggingOver ? 'drag-active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Drag & drop your media here or Choose Files"
          >
            <div className="media-upload-box-inner">
              <div className="media-upload-icon-circle">
                <UploadCloud size={28} />
              </div>
              <h3 className="media-upload-box-title">
                {isDraggingOver ? 'Drop to upload' : 'Drag & drop your media here'}
              </h3>
              <p className="media-upload-box-sub">
                {isDraggingOver ? 'Release to upload your media' : 'or'}
              </p>
              {!isDraggingOver && (
                <button
                  type="button"
                  className="media-choose-btn"
                  onClick={e => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload size={14} />
                  <span>Choose Files</span>
                </button>
              )}
            </div>
          </div>

          <div className="media-support-info">
            <p className="support-formats-label">Supports:</p>
            <p className="support-formats-text">
              MP4, MOV, WebM, AVI, MKV, MP3, WAV, M4A, PNG, JPG, JPEG, WEBP
            </p>
            <p className="support-limit-text">Up to 1 GB per file</p>
            <div className="media-privacy-pill">
              <span>Your media stays in your project.</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="media-library-view">
          {/* Header row with Title and Upload button */}
          <div className="media-library-header">
            <div>
              <h2>Project Media</h2>
              <span className="media-count-badge">{assets.length} items</span>
            </div>
            <button
              type="button"
              className="media-add-btn"
              title="Upload media from computer"
              aria-label="Upload media from computer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={14} />
              <span>Upload</span>
            </button>
          </div>

          {/* Search and Sort Toolbar */}
          <div className="media-search-sort-row">
            <div className="media-search-wrap">
              <Search size={13} className="media-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search media..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="media-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="media-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              aria-label="Sort media items"
              value={sortOption}
              onChange={e => setSortOption(e.target.value as any)}
              className="media-sort-select"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="duration">Duration</option>
            </select>
          </div>

          {/* Quick Dropzone bar when assets exist */}
          {isDraggingOver && (
            <div className="media-inline-drop-hint">
              <UploadCloud size={20} />
              <span>Drop to upload to Project Media</span>
            </div>
          )}

          {/* Media Cards Grid or Search Empty */}
          {filteredAssets.length === 0 ? (
            <div className="media-search-empty">
              <Search size={24} className="text-muted" />
              <h4>No media found</h4>
              <p>Try another search.</p>
              <button
                type="button"
                className="media-clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="media-cards-grid">
              {filteredAssets.map(asset => {
                const isSelected = selectedAssetId === asset.id;
                const isVideo = asset.mediaType === 'video';
                const isAudio = asset.mediaType === 'audio';
                const isImage = asset.mediaType === 'image';
                const hasGreenScreen = !!asset.greenScreen?.enabled;
                const usedCount = project ? getAssetUsageCount(asset, project) : 0;

                return (
                  <div
                    key={asset.id}
                    className={`media-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedAssetId(asset.id)}
                    onDoubleClick={() => handleAddMediaToCanvas(asset)}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/json', JSON.stringify(asset));
                      e.dataTransfer.setData('text/plain', asset.id);
                    }}
                    title={`${asset.name} (Double-click or drag to add to canvas)`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddMediaToCanvas(asset);
                    }}
                  >
                    {/* Selected checkmark indicator */}
                    {isSelected && (
                      <div className="media-selected-check" aria-hidden="true">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}

                    {/* Thumbnail view */}
                    <div className="media-card-thumb-wrap">
                      {asset.thumbnailUrl ? (
                        <img
                          src={`${API}${asset.thumbnailUrl}`}
                          alt={asset.name}
                          className="media-card-img"
                          loading="lazy"
                          onError={e => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : isImage && asset.url ? (
                        <img
                          src={`${API}${asset.url}`}
                          alt={asset.name}
                          className="media-card-img"
                          loading="lazy"
                        />
                      ) : (
                        <div className="media-card-fallback-art">
                          {isVideo && <Film size={26} strokeWidth={1.5} />}
                          {isAudio && <FileAudio size={26} strokeWidth={1.5} />}
                          {isImage && <ImageIcon size={26} strokeWidth={1.5} />}
                        </div>
                      )}

                      {/* Top badges: Used tag */}
                      {usedCount > 0 && (
                        <span
                          className="media-badge media-used-badge"
                          title={`Used ${usedCount} time${usedCount > 1 ? 's' : ''} in composition`}
                        >
                          {usedCount > 1 ? `Used ×${usedCount}` : 'Used'}
                        </span>
                      )}

                      {/* Top badges: Green Screen tag */}
                      {hasGreenScreen && (
                        <span className="media-badge green-screen-badge" title="Chroma key enabled">
                          <Sparkles size={10} /> GS
                        </span>
                      )}

                      {/* Bottom duration / dimension badge */}
                      <span className="media-card-badge">
                        {isVideo || isAudio
                          ? formatDuration(asset.duration)
                          : asset.width && asset.height
                          ? `${asset.width}×${asset.height}`
                          : 'IMG'}
                      </span>

                      {/* Hover action menu trigger */}
                      <button
                        type="button"
                        className="media-card-dots-btn"
                        title="Media actions"
                        aria-label="Media actions"
                        onClick={e => {
                          e.stopPropagation();
                          setMenuAssetId(menuAssetId === asset.id ? null : asset.id);
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </button>

                      {/* Context Menu Dropdown */}
                      {menuAssetId === asset.id && (
                        <div className="media-card-menu" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="media-menu-item"
                            onClick={() => {
                              setMenuAssetId(null);
                              handleAddMediaToCanvas(asset);
                            }}
                          >
                            <Plus size={14} />
                            <span>Add to Canvas</span>
                          </button>
                          <button
                            type="button"
                            className="media-menu-item"
                            onClick={() => {
                              setMenuAssetId(null);
                              setTargetAsset(asset);
                              setModalType('preview');
                            }}
                          >
                            <Eye size={14} />
                            <span>Preview</span>
                          </button>
                          {(isVideo || isImage) && (
                            <button
                              type="button"
                              className="media-menu-item"
                              onClick={() => {
                                setMenuAssetId(null);
                                setTargetAsset(asset);
                                setModalType('greenscreen');
                              }}
                            >
                              <Wand2 size={14} />
                              <span>Green Screen</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="media-menu-item"
                            onClick={() => {
                              setMenuAssetId(null);
                              setTargetAsset(asset);
                              setModalType('rename');
                            }}
                          >
                            <Pencil size={14} />
                            <span>Rename</span>
                          </button>
                          <button
                            type="button"
                            className="media-menu-item"
                            onClick={() => {
                              setMenuAssetId(null);
                              void handleDuplicate(asset);
                            }}
                          >
                            <Copy size={14} />
                            <span>Duplicate</span>
                          </button>
                          <button
                            type="button"
                            className="media-menu-item"
                            onClick={() => {
                              setMenuAssetId(null);
                              handleDownload(asset);
                            }}
                          >
                            <Download size={14} />
                            <span>Download</span>
                          </button>
                          <div className="media-menu-divider" />
                          <button
                            type="button"
                            className="media-menu-item danger"
                            onClick={() => {
                              setMenuAssetId(null);
                              setTargetAsset(asset);
                              setModalType('remove');
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Remove</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Info */}
                    <div className="media-card-info">
                      <div className="media-card-name" title={asset.filename}>
                        {asset.name}
                      </div>
                      <div className="media-card-sub">
                        {isVideo || isAudio
                          ? `${formatDuration(asset.duration)} · ${formatBytes(asset.size)}`
                          : asset.width && asset.height
                          ? `${asset.width} × ${asset.height} · ${formatBytes(asset.size)}`
                          : formatBytes(asset.size)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modalType === 'preview' && targetAsset && (
        <MediaPreviewModal
          asset={targetAsset}
          onClose={() => {
            setModalType(null);
            setTargetAsset(null);
          }}
          onAddToCanvas={() => {
            handleAddMediaToCanvas(targetAsset);
            setModalType(null);
            setTargetAsset(null);
          }}
        />
      )}

      {modalType === 'rename' && targetAsset && (
        <MediaRenameModal
          asset={targetAsset}
          onClose={() => {
            setModalType(null);
            setTargetAsset(null);
          }}
          onSave={async (newName) => {
            if (!project) return;
            try {
              await updateMediaAsset(project.id, targetAsset.id, { name: newName });
              const updatedExt = getExtension(targetAsset.filename);
              setAssets(prev =>
                prev.map(a =>
                  a.id === targetAsset.id
                    ? { ...a, name: newName, filename: `${newName}.${updatedExt}` }
                    : a
                )
              );
              notify(`Renamed to "${newName}"`);
            } catch {
              notify('Failed to rename media.');
            }
            setModalType(null);
            setTargetAsset(null);
          }}
        />
      )}

      {modalType === 'remove' && targetAsset && (
        <MediaRemoveModal
          asset={targetAsset}
          usedCount={project ? getAssetUsageCount(targetAsset, project) : 0}
          onClose={() => {
            setModalType(null);
            setTargetAsset(null);
          }}
          onConfirm={async () => {
            if (!project) return;
            try {
              await deleteMediaAsset(project.id, targetAsset.id);
              setAssets(prev => prev.filter(a => a.id !== targetAsset.id));
              onRemoveMediaAsset?.(targetAsset.id);
              notify(`Removed "${targetAsset.name}"`);
            } catch {
              notify('Failed to remove media.');
            }
            setModalType(null);
            setTargetAsset(null);
          }}
        />
      )}

      {modalType === 'greenscreen' && targetAsset && (
        <GreenScreenModal
          asset={targetAsset}
          onClose={() => {
            setModalType(null);
            setTargetAsset(null);
          }}
          onApply={async (config) => {
            if (!project) return;
            try {
              await updateMediaAsset(project.id, targetAsset.id, { greenScreen: config });
              setAssets(prev =>
                prev.map(a => (a.id === targetAsset.id ? { ...a, greenScreen: config } : a))
              );
              notify('Green Screen settings applied.');
            } catch {
              notify('Failed to apply Green Screen settings.');
            }
            setModalType(null);
            setTargetAsset(null);
          }}
        />
      )}
    </section>
  );
}

/* ==========================================================================
   1. Media Preview Modal
   ========================================================================== */

function MediaPreviewModal({
  asset,
  onClose,
  onAddToCanvas,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onAddToCanvas: () => void;
}) {
  const isVideo = asset.mediaType === 'video';
  const isAudio = asset.mediaType === 'audio';
  const isImage = asset.mediaType === 'image';

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(asset.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.code === 'Space' && (isVideo || isAudio)) {
        e.preventDefault();
        const media = videoRef.current || audioRef.current;
        if (media) {
          if (media.paused) media.play();
          else media.pause();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isVideo, isAudio]);

  const togglePlay = () => {
    const media = videoRef.current || audioRef.current;
    if (!media) return;
    if (isPlaying) media.pause();
    else void media.play();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    const media = videoRef.current || audioRef.current;
    if (media) media.currentTime = val;
  };

  const mediaSourceUrl = asset.url?.startsWith('http') ? asset.url : `${API}${asset.url || ''}`;

  return (
    <div className="media-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="media-modal-card preview-modal" onClick={e => e.stopPropagation()}>
        <div className="media-modal-head">
          <h3 className="media-modal-title" title={asset.filename}>{asset.filename}</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close preview">
            <X size={18} />
          </button>
        </div>

        <div className="media-modal-body preview-body">
          {isVideo && (
            <div className="preview-video-container">
              <video
                ref={videoRef}
                src={mediaSourceUrl}
                playsInline
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || asset.duration || 0)}
                className="preview-video-element"
              />
              <div className="preview-transport-bar">
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <span className="preview-timecode">{formatDuration(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="preview-scrubber"
                  aria-label="Seek timeline"
                />
                <span className="preview-timecode">{formatDuration(duration)}</span>
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => {
                    const next = !isMuted;
                    setIsMuted(next);
                    if (videoRef.current) videoRef.current.muted = next;
                  }}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => videoRef.current?.requestFullscreen?.()}
                  aria-label="Fullscreen"
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>
          )}

          {isAudio && (
            <div className="preview-audio-container">
              <audio
                ref={audioRef}
                src={mediaSourceUrl}
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || asset.duration || 0)}
              />
              <div className="preview-audio-art">
                <FileAudio size={48} strokeWidth={1.5} />
              </div>
              <div className="preview-transport-bar">
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <span className="preview-timecode">{formatDuration(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="preview-scrubber"
                  aria-label="Seek timeline"
                />
                <span className="preview-timecode">{formatDuration(duration)}</span>
              </div>
            </div>
          )}

          {isImage && (
            <div className="preview-image-container">
              <img src={mediaSourceUrl} alt={asset.name} className="preview-image-element" />
            </div>
          )}

          {/* Metadata info */}
          <div className="preview-meta-chips">
            <span className="meta-chip">{asset.filename}</span>
            {(isVideo || isAudio) && (
              <span className="meta-chip">{formatDuration(duration || asset.duration)}</span>
            )}
            <span className="meta-chip">{formatBytes(asset.size)}</span>
            {(asset.width && asset.height) && (
              <span className="meta-chip">{asset.width} × {asset.height}</span>
            )}
          </div>
        </div>

        <div className="media-modal-foot">
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="button primary" onClick={onAddToCanvas}>
            <Plus size={15} />
            <span>Add to Canvas</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. Media Rename Modal
   ========================================================================== */

function MediaRenameModal({
  asset,
  onClose,
  onSave,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onSave: (newName: string) => void;
}) {
  const [name, setName] = useState(getBaseName(asset.filename));
  const ext = getExtension(asset.filename);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="media-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="media-modal-card dialog-modal" onClick={e => e.stopPropagation()}>
        <div className="media-modal-head">
          <h3 className="media-modal-title">Rename Media</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="media-modal-body">
          <label className="input-label" htmlFor="rename-input">
            File name
          </label>
          <div className="rename-input-wrap">
            <input
              id="rename-input"
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="text-input"
              placeholder="Enter new name…"
            />
            {ext && <span className="rename-ext-badge">.{ext}</span>}
          </div>
          <p className="rename-hint">Extension is preserved automatically.</p>

          <div className="media-modal-foot">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={!name.trim()}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   3. Media Remove Modal
   ========================================================================== */

function MediaRemoveModal({
  asset,
  usedCount,
  onClose,
  onConfirm,
}: {
  asset: MediaAsset;
  usedCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="media-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="media-modal-card dialog-modal" onClick={e => e.stopPropagation()}>
        <div className="media-modal-head">
          <h3 className="media-modal-title">Remove this media?</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="media-modal-body">
          {usedCount > 0 ? (
            <p className="remove-warning-text">
              This media is currently used in your project canvas/timeline ({usedCount} instance(s)). Removing it will also remove it from your video composition. Are you sure you want to proceed?
            </p>
          ) : (
            <p className="remove-desc-text">
              Are you sure you want to remove &ldquo;{asset.name || asset.filename}&rdquo;? This cannot be undone.
            </p>
          )}
        </div>

        <div className="media-modal-foot">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button danger" onClick={onConfirm}>
            Remove Media
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   4. Green Screen (Chroma Key) Modal
   ========================================================================== */

export function GreenScreenModal({
  asset,
  onClose,
  onApply,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onApply: (config: GreenScreenSettings) => void;
}) {
  const isVideo = asset.mediaType === 'video';
  const initialSettings = asset.greenScreen || defaultGreenScreen;

  const [enabled, setEnabled] = useState(initialSettings.enabled ?? true);
  const [color, setColor] = useState(initialSettings.color || '#00FF00');
  const [tolerance, setTolerance] = useState(initialSettings.tolerance ?? 50);
  const [spillReduction, setSpillReduction] = useState(initialSettings.spillReduction ?? true);
  const [smoothEdges, setSmoothEdges] = useState(initialSettings.smoothEdges ?? true);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);

  const handleReset = () => {
    setColor('#00FF00');
    setTolerance(50);
    setSpillReduction(true);
    setSmoothEdges(true);
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(asset.duration || 0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaSourceUrl = asset.url?.startsWith('http') ? asset.url : `${API}${asset.url || ''}`;

  // Live Canvas render loop
  const renderFrame = useCallback(() => {
    const originalCanvas = originalCanvasRef.current;
    const processedCanvas = processedCanvasRef.current;
    if (!processedCanvas || !originalCanvas) return;

    const origCtx = originalCanvas.getContext('2d');
    const procCtx = processedCanvas.getContext('2d');
    if (!origCtx || !procCtx) return;

    const source = isVideo ? videoRef.current : imageRef.current;
    if (!source) return;

    const width = processedCanvas.width;
    const height = processedCanvas.height;

    // Draw Original
    origCtx.clearRect(0, 0, width, height);
    origCtx.drawImage(source, 0, 0, width, height);

    // Draw Processed with Chroma Key
    procCtx.clearRect(0, 0, width, height);
    drawKeyedMedia(procCtx, source, 0, 0, width, height, {
      enabled,
      color,
      tolerance,
      spillReduction,
      smoothEdges,
    });
  }, [enabled, color, tolerance, spillReduction, smoothEdges, isVideo]);

  // Request Animation Frame when video is playing or sliders change
  useEffect(() => {
    let animId: number;
    const loop = () => {
      renderFrame();
      if (isPlaying) {
        animId = requestAnimationFrame(loop);
      }
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [renderFrame, isPlaying]);

  // Eyedropper click handler on Original canvas
  const handleOriginalCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEyedropperActive) return;
    const canvas = originalCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    const source = isVideo ? videoRef.current : imageRef.current;
    if (!source) return;

    const sampledHex = samplePixelColor(source, canvas.width, canvas.height, xRatio, yRatio);
    setColor(sampledHex);
    setIsEyedropperActive(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEyedropperActive) setIsEyedropperActive(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isEyedropperActive]);

  return (
    <div className="media-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="media-modal-card greenscreen-modal" onClick={e => e.stopPropagation()}>
        <div className="media-modal-head">
          <div className="modal-title-wrap">
            <Wand2 size={20} className="text-accent" />
            <h3 className="media-modal-title">Green Screen</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="greenscreen-modal-body">
          {/* Hidden Media elements for feeding frames */}
          {isVideo ? (
            <video
              ref={videoRef}
              src={mediaSourceUrl}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => setVideoTime(videoRef.current?.currentTime || 0)}
              onLoadedMetadata={() => {
                setVideoDuration(videoRef.current?.duration || asset.duration || 0);
                renderFrame();
              }}
              onSeeked={renderFrame}
              style={{ display: 'none' }}
            />
          ) : (
            <img
              ref={imageRef}
              src={mediaSourceUrl}
              crossOrigin="anonymous"
              onLoad={renderFrame}
              style={{ display: 'none' }}
              alt=""
            />
          )}

          {/* Real-time Before / After Split Preview */}
          <div className="greenscreen-preview-split">
            {/* Left: Original */}
            <div className="split-view-panel">
              <div className="split-view-label">Original</div>
              <div className="split-canvas-wrap">
                <canvas
                  ref={originalCanvasRef}
                  width={640}
                  height={360}
                  className={`split-canvas ${isEyedropperActive ? 'eyedropper-mode' : ''}`}
                  onClick={handleOriginalCanvasClick}
                />
              </div>
            </div>

            {/* Right: Processed (Checkerboard background) */}
            <div className="split-view-panel">
              <div className="split-view-label">Processed</div>
              <div className="split-canvas-wrap checkerboard-bg">
                <canvas
                  ref={processedCanvasRef}
                  width={640}
                  height={360}
                  className="split-canvas"
                />
              </div>
            </div>
          </div>

          {/* Video Scrubber (if video) */}
          {isVideo && (
            <div className="greenscreen-transport">
              <button
                type="button"
                className="icon-button tiny"
                onClick={() => {
                  if (videoRef.current) {
                    if (isPlaying) videoRef.current.pause();
                    else void videoRef.current.play();
                  }
                }}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <span className="preview-timecode">{formatDuration(videoTime)}</span>
              <input
                type="range"
                min={0}
                max={videoDuration || 1}
                step={0.05}
                value={videoTime}
                onChange={e => {
                  const val = Number(e.target.value);
                  setVideoTime(val);
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="preview-scrubber"
                aria-label="Seek video frame"
              />
              <span className="preview-timecode">{formatDuration(videoDuration)}</span>
            </div>
          )}

          {/* Controls Panel */}
          <div className="greenscreen-controls-grid">
            {/* Color to remove */}
            <div className="greenscreen-control-item">
              <label className="gs-label">Color to remove</label>
              <div className="color-picker-row">
                <label className="color-swatch-box" style={{ background: color }} title="Choose color">
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="color-hidden-input"
                    aria-label="Chroma key color picker"
                  />
                </label>
                <span className="color-hex-text">{color.toUpperCase()}</span>
                <button
                  type="button"
                  className={`eyedropper-btn ${isEyedropperActive ? 'active' : ''}`}
                  onClick={() => setIsEyedropperActive(!isEyedropperActive)}
                  title="Sample color from Original preview"
                  aria-pressed={isEyedropperActive}
                >
                  <Pipette size={14} />
                  <span>{isEyedropperActive ? 'Click preview to pick' : 'Eyedropper'}</span>
                </button>
              </div>
            </div>

            {/* Tolerance */}
            <div className="greenscreen-control-item">
              <div className="gs-label-row">
                <label htmlFor="gs-tolerance" className="gs-label">Tolerance</label>
                <span className="gs-val-badge">{tolerance}</span>
              </div>
              <input
                id="gs-tolerance"
                type="range"
                min={0}
                max={100}
                value={tolerance}
                onChange={e => setTolerance(Number(e.target.value))}
                className="gs-range-slider"
              />
            </div>

            {/* Spill Reduction */}
            <div className="greenscreen-control-item">
              <label className="gs-toggle-row">
                <span className="gs-label">Spill reduction</span>
                <input
                  type="checkbox"
                  checked={spillReduction}
                  onChange={e => setSpillReduction(e.target.checked)}
                />
                <span className="toggle-track" />
              </label>
              <p className="gs-hint">Reduces green light reflected on edges and hair.</p>
            </div>

            {/* Smooth Edges */}
            <div className="greenscreen-control-item">
              <label className="gs-toggle-row">
                <span className="gs-label">Smooth edges</span>
                <input
                  type="checkbox"
                  checked={smoothEdges}
                  onChange={e => setSmoothEdges(e.target.checked)}
                />
                <span className="toggle-track" />
              </label>
              <p className="gs-hint">Softens harsh chroma-key edges.</p>
            </div>
          </div>
        </div>

        <div className="media-modal-foot">
          <button
            type="button"
            className="button secondary gs-reset-btn"
            onClick={handleReset}
            title="Reset to default green screen values"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button primary gs-apply-btn"
            onClick={() => {
              onApply({
                enabled: true,
                color,
                tolerance,
                spillReduction,
                smoothEdges,
              });
            }}
          >
            <Check size={16} />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
