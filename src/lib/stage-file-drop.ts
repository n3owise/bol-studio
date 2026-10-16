import type React from 'react';
import type { MediaAsset } from './types';

export interface StageFileDropDeps {
  dragCounterRef: React.MutableRefObject<number>;
  setIsDraggingOver: (dragging: boolean) => void;
  handleAddMediaToCanvas: (asset: MediaAsset) => void;
  notify: (message: string) => void;
  importFile: (file?: File) => Promise<void>;
}

/**
 * Drag-and-drop handlers for the preview stage. A file from the desktop is
 * imported; a media card dragged from the project's library arrives as JSON
 * and is placed on the canvas instead. The enter/leave counter keeps the
 * highlight from flickering as the pointer crosses child elements.
 *
 * Plain functions rebuilt on every render, exactly as they were inline in Studio.
 */
export function stageFileDropHandlers({ dragCounterRef, setIsDraggingOver, handleAddMediaToCanvas, notify, importFile }: StageFileDropDeps) {
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);

    // Check if internal media asset was dragged from Project Media library
    const mediaAssetJson = e.dataTransfer.getData('application/json');
    if (mediaAssetJson) {
      try {
        const asset = JSON.parse(mediaAssetJson) as MediaAsset;
        if (asset && asset.id) {
          handleAddMediaToCanvas(asset);
          notify(`Added "${asset.name}" to canvas`);
          return;
        }
      } catch {}
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      void importFile(files[0]);
    }
  };

  return { handleDragEnter, handleDragLeave, handleDragOver, handleDrop };
}
