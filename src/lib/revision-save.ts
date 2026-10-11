import { assetMediaPath } from './media-credentials';
import type { Project } from './types';

export function editableSnapshot(project: Project) {
  return { words: project.words, settings: project.settings, name: project.name,
    videoEnabled: project.videoEnabled ?? project.mediaType === 'video', activeMediaAssetId: project.activeMediaAssetId ?? 'primary', canvasElements: (project.canvasElements ?? []).map(element => ({ ...element, url: assetMediaPath(project.id, element.assetId) })) };
}

/** Retry metadata-only revision changes; concurrent edits require explicit recovery. */
export async function saveWithRevision(
  local: Project, baseline: Project | null,
  patch: (body: ReturnType<typeof editableSnapshot> & { revision: number }) => Promise<Project>,
  read: () => Promise<Project>, isConflict: (error: unknown) => boolean,
): Promise<Project> {
  const payload = editableSnapshot(local);
  try { return await patch({ ...payload, revision: local.revision }); }
  catch (error) {
    if (!isConflict(error) || !baseline || baseline.id !== local.id) throw error;
    const remote = await read();
    if (['queued', 'processing'].includes(remote.status)
      || JSON.stringify(editableSnapshot(remote)) !== JSON.stringify(editableSnapshot(baseline))) throw error;
    return patch({ ...payload, revision: remote.revision });
  }
}
