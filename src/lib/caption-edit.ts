import type { Word } from './types';

/** Match exact words first; substitutions retain their original recognition record. */
export function editCaptionGroup(old: Word[], text: string, start: number, end: number): Word[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!old.length || !tokens.length) throw new Error('Caption text cannot be blank.');
  if (tokens.some(t => t.length > 500)) throw new Error('A caption word cannot exceed 500 characters.');
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error('Choose a valid caption interval.');
  const oldStart = old[0].start, oldEnd = old.at(-1)!.end;
  const retimed = start !== oldStart || end !== oldEnd;
  const base = old.map(w => retimed ? { ...w,
    start: start + (w.start - oldStart) / (oldEnd - oldStart) * (end - start),
    end: start + (w.end - oldStart) / (oldEnd - oldStart) * (end - start), timingApproximate: true } : w);
  // Longest common subsequence anchors unchanged words, including insertions/deletions.
  const dp = Array.from({length: old.length + 1}, () => Array(tokens.length + 1).fill(0));
  for (let i=old.length-1;i>=0;i--) for (let j=tokens.length-1;j>=0;j--)
    dp[i][j] = old[i].text === tokens[j] ? 1 + dp[i+1][j+1] : Math.max(dp[i+1][j],dp[i][j+1]);
  const anchors: [number,number][] = [];
  let i=0,j=0;
  while(i<old.length && j<tokens.length) {
    if(old[i].text===tokens[j]) { anchors.push([i++,j++]); }
    else if(dp[i+1][j] >= dp[i][j+1]) i++; else j++;
  }
  anchors.push([old.length,tokens.length]);
  const result: Word[] = [];
  let oi=0,ti=0;
  for(const [a,b] of anchors) {
    const prior = base.slice(oi,a), changed = tokens.slice(ti,b);
    if(prior.length === changed.length) result.push(...prior.map((w,k) => ({...w,text:changed[k]})));
    else if(changed.length) {
      const left = prior[0]?.start ?? (oi ? base[oi-1].end : start);
      const right = prior.at(-1)?.end ?? (a<base.length ? base[a].start : end);
      if(right-left < changed.length*.01) throw new Error('There is not enough time for added words. Adjust the line timestamps or edit words individually.');
      result.push(...changed.map((token,k) => ({
        ...(prior[k] ?? {}), id: prior[k]?.id ?? crypto.randomUUID(), text:token,
        original:prior[k]?.original ?? token, start:left+(right-left)*k/changed.length,
        end:left+(right-left)*(k+1)/changed.length, confidence:prior[k]?.confidence ?? 0,
        confidenceApproximate:prior[k]?.confidenceApproximate ?? true,
        emphasis:prior[k]?.emphasis ?? false, emphasisScore:prior[k]?.emphasisScore ?? 0,
        timingApproximate:true,
      })));
    }
    if(a<base.length) result.push(base[a]);
    oi=a+1;ti=b+1;
  }
  // Preserve the explicit page boundary when the final word changes or is removed.
  if(result.length && old.at(-1)?.lineBreak !== undefined) result[result.length-1] = {...result.at(-1)!,lineBreak:old.at(-1)!.lineBreak};
  return result;
}
