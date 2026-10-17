async function putChunk(url: string, chunk: Blob, offset: number, total: number): Promise<Response> {
  return fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes ${offset}-${offset + chunk.size - 1}/${total}` }, body: chunk });
}
export async function uploadResumable(url: string, file: File, progress: (n: number) => void, delay: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const initial = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes */${file.size}` }, body: new Blob([]) });
  if (initial.ok) { progress(100); return; }
  if (initial.status !== 308) throw new Error('Drive upload session expired. Please upload this video again.');
  const received = initial.headers.get('Range');
  let offset = received ? Number(received.split('-')[1]) + 1 : 0; let failures = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + 8 * 1024 * 1024, file.size));
    try {
      const r = await putChunk(url, chunk, offset, file.size);
      if (r.ok) { progress(100); return; }
      if (r.status !== 308) throw new Error('Drive upload was refused. Check free space and retry.');
      const range = r.headers.get('Range');
      if (!range || !/^bytes=0-\d+$/.test(range)) throw new Error('Drive upload progress could not be read. Please retry.');
      const next = Number(range.split('-')[1]) + 1;
      if (next <= offset || next > file.size) throw new Error('Drive upload did not advance. Please retry.');
      offset = next;
      failures = 0;
      progress(Math.min(99, Math.floor(offset / file.size * 100)));
    } catch (e) {
      if (++failures > 3) throw e;
      await delay(1000 * failures);
      const status = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes */${file.size}` }, body: new Blob([]) });
      if (status.ok) { progress(100); return; }
      if (status.status !== 308) throw new Error('Drive upload interrupted. Please retry your upload.');
      const range = status.headers.get('Range');
      offset = range ? Number(range.split('-')[1]) + 1 : 0;
    }
  }
  const final = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes */${file.size}` }, body: new Blob([]) });
  if (!final.ok) throw new Error('Drive has not confirmed the completed upload. Please retry.');
  progress(100);
}
