import {Modal} from "../ui/Modal";
import {Icon} from "../ui/Icon";
import {notify} from "../desktop-api";
import React, { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { MainComposition } from "./Composition";
import { playerRef, seekTo, togglePlay } from "../playerRef";
import { projectDuration, useStore, findClip } from "../store";
import type { PreviewItem } from "../store";
import { fmtFrames } from "../time";
import { CARDS } from "../cards/registry";
import { cardFps, cardSize } from "../cards/types";
import { MANIFEST } from '../cards/projectCards';
import { themedProps } from '../theme';
import {previewImageFile} from '../assetCatalog';

const lighterImages=(props:Record<string,unknown>):Record<string,unknown>=>Object.fromEntries(Object.entries(props).map(([key,value])=>[key,typeof value==='string'?previewImageFile(value):value]));

/** 素材库点击预览：占据画面区，循环播放；主工程 Player 保持挂载（display:none） */
const ItemPreview: React.FC<{ item: NonNullable<PreviewItem>; onClose: () => void }> = ({
  item,
  onClose,
}) => {
  const themeId = useStore(s => s.project.themeId);
  const themeColors = useStore(s => s.project.themeColors);
  const project=useStore(s=>s.project),selectedId=useStore(s=>s.selectedClipId);
  const [chooseSlot,setChooseSlot]=useState(false);
  const target=selectedId?findClip(project,selectedId):null;
  const targetCard=target?CARDS[target.clip.cardId]:undefined;
  const mediaKind=item.kind==='card'?item.cardId==='image-clip'?'image':item.cardId==='video-clip'?'video':item.cardId==='audio-clip'?'audio':null:item.kind;
  const mediaFile=item.kind==='card'?item.props?.file:item.file;
  const targetKind=targetCard?.kind==='audio'?'audio':targetCard?.kind==='video'?'video':'image';
  const slots=mediaKind===targetKind?targetCard?.schema.filter(f=>f.key==='file'||f.key==='file2'||f.key.startsWith('media_'))||[]:[];
  const applyMedia=(key:string)=>{if(!target||!mediaFile)return;const s=useStore.getState();s.commit();s.updateClipProps(target.clip.id,{[key]:mediaFile});s.setPreview(null);notify('素材已应用到「'+(target.clip.label||targetCard?.name||'选中镜头')+'」，运镜与时长保留')};
  let body: React.ReactNode = null;
  let title = "";
  if (item.kind === "card") {
    const card = CARDS[item.cardId];
    title = card?.name ?? item.cardId;
    if (card && card.kind !== "audio") {
      const { width, height } = cardSize(card);
      body = (
        <Player
          component={card.component}
          inputProps={lighterImages(themedProps(MANIFEST, card, themeId, item.props || {}, themeColors))}
          durationInFrames={Math.max(2, item.duration??card.durationInFrames)}
          compositionWidth={width}
          compositionHeight={height}
          fps={cardFps(card)}
          autoPlay
          loop
          controls
          clickToPlay
          numberOfSharedAudioTags={32}
          style={{ width: "100%", height: "100%" }}
          acknowledgeRemotionLicense
        />
      );
    } else {
      body = <div className="preview-audio">音频预览<audio src={`/${item.props?.file || ""}`} controls /></div>;
    }
  } else {
    title = item.label;
    if (item.kind === "video")
      body = <video className="preview-media" src={`/${item.file}`} controls autoPlay loop />;
    else if (item.kind === "image")
      body = <img className="preview-media" src={`/${item.file}`} />;
    else
      body = (
        <div className="preview-audio">
          🔊 {item.label}
          <audio src={`/${item.file}`} controls autoPlay />
        </div>
      );
  }
  return (
    <>
      {chooseSlot&&<Modal label="选择镜头素材位" className="slot-choice-dialog" onClose={()=>setChooseSlot(false)}><div className="dialog-heading"><div><b>应用到哪个位置？</b><span>{targetCard?.name}</span></div><button className="icon-button" aria-label="关闭素材位选择" onClick={()=>setChooseSlot(false)}><Icon name="close"/></button></div><div className="slot-choice-list">{slots.map(f=><button className="btn" key={f.key} onClick={()=>applyMedia(f.key)}>{f.label}<Icon name="arrow" size={16}/></button>)}</div></Modal>}
      <div className="preview-stage">{body}</div>
      <div className="transport">
        <span className="preview-tag">素材预览</span>
        <b>{title}</b>
        {item.kind==='card'&&<button className="btn primary" onClick={()=>{useStore.getState().addClip(item.cardId,undefined,undefined,{props:item.props||{},duration:item.duration});useStore.getState().setPreview(null);notify("已加入时间线，可进入视频剪辑继续编辑")}}>＋ 添加到时间线</button>}
        {mediaKind&&target&&<button className="btn" disabled={!slots.length} title={slots.length?'填入镜头素材位，保留运镜和时长':'当前镜头没有匹配的素材位'} onClick={()=>slots.length===1?applyMedia(slots[0].key):setChooseSlot(true)}>应用到选中镜头</button>}
        {item.kind==='card'&&!mediaKind&&selectedId&&<button className="btn" onClick={()=>{const s=useStore.getState();s.commit();s.updateClip(s.selectedClipId!,{cardId:item.cardId,props:item.props||{},inOffset:0,speed:1});s.setPreview(null)}}>替换选中镜头</button>}
        <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>
          ✕ 返回工程
        </button>
      </div>
    </>
  );
};

/** 走带控制：唯一订阅 playhead 的预览端组件——播放中每帧只重渲染它，
 *  不能让 frameupdate 波及包含 <Player> 的父组件。 */
const Transport: React.FC<{
  duration: number;
  fps: number;
  loop: boolean;
  setLoop: (b: boolean) => void;
  sizeLabel: string;
}> = ({ duration, fps, loop, setLoop, sizeLabel }) => {
  const playhead = useStore((s) => s.playhead);
  const playing = useStore((s) => s.playing);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const setPlaying = useStore((s) => s.setPlaying);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setPlayhead(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [setPlayhead, setPlaying]);

  return (
    <div className="transport">
      <button className="btn" title="回到开头" onClick={() => seekTo(0)}>
        ⏮
      </button>
      <button className="btn btn-play" title="播放/暂停（空格）" onClick={togglePlay}>
        {playing ? "⏸" : "▶"}
      </button>
      <span className="timecode">
        {fmtFrames(playhead, fps)} <span className="dim">/ {fmtFrames(duration, fps)}</span>
      </span>
      <label className="loop-toggle">
        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
        循环
      </label>
      <span className="dim" style={{ marginLeft: "auto" }}>
        {sizeLabel}
      </span>
    </div>
  );
};

export const PreviewPanel: React.FC = () => {
  const project = useStore((s) => s.project);
  const previewItem = useStore((s) => s.previewItem);
  const setPreview = useStore((s) => s.setPreview);
  const [loop, setLoop] = useState(true);

  const duration = projectDuration(project);
  const inputProps = useMemo(() => ({ project:{...project,tracks:project.tracks.map(track=>({...track,clips:track.clips.map(clip=>({...clip,props:lighterImages(clip.props)}))}))} }), [project]);

  return (
    <div className="preview-panel">
      {previewItem && <ItemPreview item={previewItem} onClose={() => setPreview(null)} />}
      <div className="preview-stage" style={previewItem ? { display: "none" } : undefined}>
        <Player
          ref={playerRef}
          component={MainComposition}
          inputProps={inputProps}
          durationInFrames={duration}
          compositionWidth={project.width}
          compositionHeight={project.height}
          fps={project.fps}
          loop={loop}
          controls={false}
          clickToPlay
          numberOfSharedAudioTags={32}
          style={{ width: "100%", height: "100%" }}
          acknowledgeRemotionLicense
        />
      </div>
      {!previewItem && (
        <Transport
          duration={duration}
          fps={project.fps}
          loop={loop}
          setLoop={setLoop}
          sizeLabel={`${project.width}×${project.height} · ${project.fps}fps`}
        />
      )}
    </div>
  );
};
