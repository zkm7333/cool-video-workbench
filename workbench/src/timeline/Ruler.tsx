import React, { useRef } from "react";
import { startScrub } from "./scrub";
import { useStore } from "../store";

/** 时间标尺：刻度 + 点击/拖拽 scrub */
export const Ruler: React.FC<{ durationFrames: number; contentW: number }> = ({
  durationFrames,
  contentW,
}) => {
  const ppf = useStore((s) => s.pxPerFrame);
  const fps = useStore((s) => s.project.fps);
  const ref = useRef<HTMLDivElement>(null);

  // 主刻度间隔（秒）：保证标签间距 ≥ 64px
  const pxPerSec = ppf * fps;
  const steps = [0.5, 1, 2, 5, 10, 30, 60];
  const stepSec = steps.find((s) => s * pxPerSec >= 64) ?? 60;

  const totalSec = durationFrames / fps;
  const ticks: { sec: number; major: boolean }[] = [];
  for (let s = 0; s <= totalSec + stepSec; s += stepSec / 2) {
    ticks.push({ sec: s, major: Math.round((s / stepSec) * 2) % 2 === 0 });
  }

  const fmt = (sec: number) =>
    stepSec >= 1 ? `${Math.round(sec)}s` : `${sec.toFixed(1)}s`;

  return (
    <div className="ruler" ref={ref} style={{ width: contentW }} onPointerDown={startScrub}>
      {ticks.map(({ sec, major }, i) => (
        <div
          key={i}
          className={major ? "tick major" : "tick"}
          style={{ left: sec * pxPerSec }}
        >
          {major && <span className="tick-label">{fmt(sec)}</span>}
        </div>
      ))}
    </div>
  );
};
