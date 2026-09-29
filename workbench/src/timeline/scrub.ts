import type React from 'react';
import {playerRef, seekTo} from '../playerRef';
import {projectDuration, useStore} from '../store';

/** Shared ruler/playhead seeking, relative to the scrolled ruler, never to a clip. */
export function startScrub(event: React.PointerEvent<HTMLElement>) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const target = event.currentTarget;
  const scroller = target.closest('.tl-scroller') as HTMLElement | null;
  const ruler = scroller?.querySelector('.ruler');
  if (!scroller || !ruler) return;
  target.setPointerCapture(event.pointerId);
  playerRef.current?.pause();
  useStore.getState().setPlaying(false);
  let clientX = event.clientX;
  let raf = 0;
  const seek = () => {
    const state = useStore.getState();
    const frame = Math.max(0, Math.min(projectDuration(state.project) - 1,
      Math.round((clientX - ruler.getBoundingClientRect().left) / state.pxPerFrame)));
    seekTo(frame);
    state.setPlayhead(frame);
  };
  const tick = () => {
    const rect = scroller.getBoundingClientRect();
    if (clientX > rect.right - 24) scroller.scrollLeft += 12;
    else if (clientX < rect.left + 164) scroller.scrollLeft -= 12;
    seek();
    raf = requestAnimationFrame(tick);
  };
  const move = (e: PointerEvent) => { if (e.pointerId === event.pointerId) { clientX = e.clientX; seek(); } };
  const finish = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return;
    cancelAnimationFrame(raf);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', finish);
    target.removeEventListener('pointercancel', finish);
    target.removeEventListener('lostpointercapture', finish);
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', finish);
  target.addEventListener('pointercancel', finish);
  target.addEventListener('lostpointercapture', finish);
  seek();
  raf = requestAnimationFrame(tick);
}
