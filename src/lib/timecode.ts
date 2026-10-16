/** Seconds as `mm:ss.s`, the editor's on-screen clock format. Negative input reads as zero. */
export const timecode = (s: number) => `${Math.floor(Math.max(0,s)/60).toString().padStart(2,'0')}:${(Math.max(0,s)%60).toFixed(1).padStart(4,'0')}`;
