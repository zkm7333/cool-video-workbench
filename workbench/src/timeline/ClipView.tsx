import React, {useState} from "react";
import {createPortal} from "react-dom";
import {nearestFreeStart} from "./placement";
import { inOffsetFps } from "../cards/types";
import type { ClipData } from "../types";
import { CARDS } from "../cards/registry";
import { useStore } from "../store";

export const ClipView: React.FC<{
  clip: ClipData;
  trackId: string;
  trackIdAt: (clientY: number) => string | null;
}> = ({ clip, trackIdAt }) => {
  const ppf = useStore((s) => s.pxPerFrame);
  const selected = useStore((s) => s.selectedClipId === clip.id);
  const select = useStore((s) => s.select);
  const commit = useStore((s) => s.commit);
  const updateClip = useStore((s) => s.updateClip);
  const [drag, setDrag] = useState<{lane:HTMLElement;left:number;marker:number}|null>(null);

  const card = CARDS[clip.cardId];

  const onBodyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if(e.button!==0) return;
    e.preventDefault();e.stopPropagation();select(clip.id);
    const element=e.currentTarget;
    const scroller=element.closest('.tl-scroller') as HTMLElement;
    const startX=e.clientX, startY=e.clientY;
    const grab=e.clientX-element.getBoundingClientRect().left;
    let x=startX,y=startY,moved=false,raf=0;
    let destination:{trackId:string;at:number}|null=null;
    element.setPointerCapture(e.pointerId);
    const update=()=>{
      const tid=trackIdAt(y);
      const lane=Array.from(scroller.querySelectorAll<HTMLElement>('.tl-lane')).find(l=>l.dataset.trackId===tid);
      const track=useStore.getState().project.tracks.find(t=>t.id===tid);
      if(!lane || !track){destination=null;setDrag(null);return}
      const left=lane.getBoundingClientRect().left;
      const proposedStart=Math.max(0,Math.round((x-left-grab)/ppf));
      const placedStart=nearestFreeStart(track.clips,proposedStart,clip.duration,clip.id);
      destination={trackId:track.id,at:placedStart};
      setDrag({lane,left:placedStart*ppf,marker:placedStart*ppf});
    };
    const tick=()=>{
      const r=scroller.getBoundingClientRect();
      if(x>r.right-24)scroller.scrollLeft+=12;
      else if(x<r.left+164)scroller.scrollLeft-=12;
      update();raf=requestAnimationFrame(tick);
    };
    const move=(ev:PointerEvent)=>{
      if(ev.pointerId!==e.pointerId)return;
      x=ev.clientX;y=ev.clientY;
      if(!moved && Math.hypot(x-startX,y-startY)<5)return;
      if(!moved){moved=true;raf=requestAnimationFrame(tick)}
      update();
    };
    const cleanup=()=>{
      cancelAnimationFrame(raf);setDrag(null);
      element.removeEventListener('pointermove',move);
      element.removeEventListener('pointerup',up);
      element.removeEventListener('pointercancel',cancel);
      element.removeEventListener('lostpointercapture',cancel);
      window.removeEventListener('keydown',key);
      if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
    };
    const up=(ev:PointerEvent)=>{
      if(ev.pointerId!==e.pointerId)return;
      cleanup();
      if(moved && destination)useStore.getState().moveClipToTrack(clip.id,destination.trackId,destination.at);
    };
    const cancel=()=>cleanup();
    const key=(ev:KeyboardEvent)=>{if(ev.key==='Escape'){ev.preventDefault();cleanup()}};
    element.addEventListener('pointermove',move);
    element.addEventListener('pointerup',up);
    element.addEventListener('pointercancel',cancel);
    element.addEventListener('lostpointercapture',cancel);
    window.addEventListener('keydown',key);
  };

  const onTrimDown = (side: "left" | "right") => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(clip.id);
    commit();
    const startX = e.clientX;
    const orig = {
      start: clip.start,
      duration: clip.duration,
      inOffset: clip.inOffset,
      speed: clip.speed,
    };
    const onMove = (ev: PointerEvent) => {
      const df = Math.round((ev.clientX - startX) / ppf);
      if (side === "left") {
        let d = df;
        d = Math.max(d, -orig.start); // 不越过时间轴 0 点
        d = Math.max(d, Math.ceil(-orig.inOffset / orig.speed)); // 裁入点不为负
        d = Math.min(d, orig.duration - 2);
        updateClip(clip.id, {
          start: orig.start + d,
          duration: orig.duration - d,
          inOffset: Math.max(0, orig.inOffset + d * orig.speed),
        });
      } else {
        const d = Math.max(df, 2 - orig.duration);
        updateClip(clip.id, { duration: orig.duration + d });
      }
    };
    const onUp = () => window.removeEventListener("pointermove", onMove);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const fps = useStore((s) => s.project.fps);
  const accent = card?.accent ?? "#666";
  const durSec = (clip.duration / fps).toFixed(1);

  return (
    <>
    <div
      className={`clip${selected ? " selected" : ""}${drag ? " clip-dragging" : ""}`}
      data-clip-id={clip.id}
      style={{
        left: clip.start * ppf,
        width: Math.max(8, clip.duration * ppf),
        borderLeftColor: accent,
      }}
      onPointerDown={onBodyDown}
    >
      <div className="clip-label">
        <span className="clip-name">{clip.label ?? card?.name ?? clip.cardId}</span>
        <span className="clip-meta">
          {durSec}s
          {clip.speed !== 1 && <em className="badge">{clip.speed}×</em>}
          {clip.inOffset > 0 && <em className="badge">✂{(clip.inOffset / inOffsetFps(card, fps)).toFixed(1)}s</em>}
          {clip.opacity < 1 && <em className="badge">{Math.round(clip.opacity * 100)}%</em>}
        </span>
      </div>
      <div className="trim trim-l" onPointerDown={onTrimDown("left")} />
      <div className="trim trim-r" onPointerDown={onTrimDown("right")} />
    </div>
    {drag && createPortal(<><div className="clip-drag-ghost" style={{left:drag.left,width:Math.max(8,clip.duration*ppf)}}>{clip.label??card?.name}</div><div className="clip-insert-marker" style={{left:drag.marker}}><span>插入这里</span></div></>,drag.lane)}
    </>
  );
};
