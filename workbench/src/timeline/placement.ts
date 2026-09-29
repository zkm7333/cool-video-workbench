import type {ClipData} from '../types';

/** Keep other clips fixed; choose the first gap at or after the requested frame. */
export function freeStart(clips: ClipData[], start: number, duration: number, exclude?: string): number {
  let at = Math.max(0, Math.round(start));
  for (const clip of clips.filter(c => c.id !== exclude).sort((a,b) => a.start-b.start)) {
    if (at + duration <= clip.start) break;
    if (at < clip.start + clip.duration) at = clip.start + clip.duration;
  }
  return at;
}

/** Keep the requested timeline position when free; on collision use the nearest available gap edge. */
export function nearestFreeStart(clips: ClipData[], start: number, duration: number, exclude?: string): number {
  const others=clips.filter(c=>c.id!==exclude).sort((a,b)=>a.start-b.start);
  const requested=Math.max(0,Math.round(start));
  const overlaps=(at:number)=>others.some(c=>at<c.start+c.duration&&at+duration>c.start);
  if(!overlaps(requested))return requested;
  const candidates=new Set<number>([0]);
  for(const c of others){candidates.add(Math.max(0,c.start-duration));candidates.add(c.start+c.duration)}
  return [...candidates].filter(at=>!overlaps(at)).sort((a,b)=>Math.abs(a-requested)-Math.abs(b-requested)||a-b)[0]??requested;
}

/** Trimming stops at neighbours rather than moving or overwriting them. */
export function boundedTrim(clips: ClipData[], clip: ClipData, patch: Partial<ClipData>): Partial<ClipData> {
  const others = clips.filter(c => c.id !== clip.id);
  const previousEnd = Math.max(0, ...others.filter(c => c.start < clip.start).map(c => c.start+c.duration));
  const nextStart = Math.min(Infinity, ...others.filter(c => c.start >= clip.start).map(c => c.start));
  const requestedStart = Math.max(0, Math.round(patch.start ?? clip.start));
  const start = Math.max(previousEnd, requestedStart);
  const end = Math.min(nextStart, requestedStart + Math.max(1, Math.round(patch.duration ?? clip.duration)));
  if (end <= start) return {}; // Legacy overlapping clips must be arranged first.
  return {...patch, start, duration:end-start,
    ...(patch.inOffset !== undefined ? {inOffset:Math.max(0, patch.inOffset+(start-requestedStart)*clip.speed)} : {})};
}

export function arrangeClips(clips: ClipData[]): boolean {
  let end = 0, changed = false;
  for (const clip of [...clips].sort((a,b)=>a.start-b.start)) {
    if (clip.start < end) { clip.start = end; changed = true; }
    end = clip.start + clip.duration;
  }
  return changed;
}

/** Choose a stable insertion boundary using the pointer, not a clip mutated during dragging. */
export function insertionPoint(clips: ClipData[], exclude: string, frame: number) {
  const sorted = clips.filter(c=>c.id!==exclude).sort((a,b)=>a.start-b.start);
  const before = sorted.find(c=>frame < c.start+c.duration/2);
  return {beforeId:before?.id ?? null, frame:before?.start ?? (sorted.length ? sorted[sorted.length-1].start+sorted[sorted.length-1].duration : Math.max(0,Math.round(frame)))};
}

/** Same-track reorder preserves surrounding timing and existing gaps; cross-track inserts ripple only collisions. */
export function insertClip(source: ClipData[], target: ClipData[], id: string, beforeId: string|null, emptyStart=0): boolean {
  const clip = source.find(c=>c.id===id);
  if (!clip) return false;
  if (source === target) {
    const sorted=[...source].sort((a,b)=>a.start-b.start);
    const from=sorted.findIndex(c=>c.id===id);
    const reordered=sorted.filter(c=>c.id!==id);
    const to=beforeId===null ? reordered.length : reordered.findIndex(c=>c.id===beforeId);
    if (to<0) return false;
    if (to===from) {
      if(to!==0 || emptyStart>=clip.start)return false;
      clip.start=Math.max(0,Math.round(emptyStart));
      return true;
    }
    reordered.splice(to,0,clip);
    const lo=Math.min(from,to), hi=Math.max(from,to);
    let at=to===0?Math.min(sorted[lo].start,Math.max(0,Math.round(emptyStart))):sorted[lo].start;
    const gaps=sorted.slice(lo,hi).map((c,i)=>Math.max(0,sorted[lo+i+1].start-c.start-c.duration));
    for(let i=lo;i<=hi;i++){reordered[i].start=at;at+=reordered[i].duration+(gaps[i-lo]??0)}
    return true;
  }
  const sorted=[...target].sort((a,b)=>a.start-b.start);
  const before=beforeId===null ? null : sorted.find(c=>c.id===beforeId);
  if(beforeId!==null && !before) return false;
  clip.start=before?.start ?? (sorted.length ? sorted[sorted.length-1].start+sorted[sorted.length-1].duration : Math.max(0,Math.round(emptyStart)));
  source.splice(source.indexOf(clip),1);
  let end=clip.start+clip.duration;
  for(const other of sorted){if(other.start<clip.start)continue;other.start=Math.max(other.start,end);end=other.start+other.duration}
  target.push(clip);
  return true;
}
