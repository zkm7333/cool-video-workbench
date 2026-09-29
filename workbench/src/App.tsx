import React, { useCallback, useEffect, useRef, useState } from "react";
import { LibraryPanel } from "./panels/LibraryPanel";
import { Inspector } from "./panels/Inspector";
import { PreviewPanel } from "./preview/PreviewPanel";
import { Timeline } from "./timeline/Timeline";
import { useStore } from "./store";
import { seekTo, togglePlay } from "./playerRef";
import { api,notify } from "./desktop-api";
import {DirectorPanel} from "./panels/DirectorPanel";
import { ProductionPanel } from "./panels/ProductionPanel";
import { projectEndFrame } from "./types";
import {Icon} from "./ui/Icon";
import {ExportButton} from "./panels/ExportButton";
import {TrashPanel} from "./panels/TrashPanel";
import {CaptionsPanel} from "./panels/CaptionsPanel";
import {ScreenRecorderPanel} from "./panels/ScreenRecorderPanel";
import {removeLibraryItem} from "./assetCatalog";
import {Modal} from "./ui/Modal";
import type { ProjectData } from "./types";

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 面板尺寸：可拖拽调整，落 localStorage */
const usePanelSize = (key: string, def: number) => {
  const [v, setV] = useState<number>(() => {
    const s = localStorage.getItem(key);
    return s ? Number(s) : def;
  });
  useEffect(() => {
    localStorage.setItem(key, String(v));
  }, [key, v]);
  return [v, setV] as const;
};

/** 拖拽分隔条：pointerdown 后跟踪位移，交给回调换算尺寸 */
const startSplit = (
  e: React.PointerEvent,
  onMove: (dx: number, dy: number) => void,
) => {
  e.preventDefault();
  const sx = e.clientX;
  const sy = e.clientY;
  const mm = (ev: PointerEvent) => onMove(ev.clientX - sx, ev.clientY - sy);
  const up = () => window.removeEventListener("pointermove", mm);
  window.addEventListener("pointermove", mm);
  window.addEventListener("pointerup", up, { once: true });
};

export const App: React.FC = () => {
  const project = useStore((s) => s.project);
  const [mode,setMode]=useState('library');
  const previewItem=useStore(s=>s.previewItem);
  const [notice,setNotice]=useState('');
  const [saved,setSaved]=useState(false);
  const [projects,setProjects]=useState<any[]|null>(null);
  const [trashOpen,setTrashOpen]=useState(false);
  const [captionsOpen,setCaptionsOpen]=useState(false);
  useEffect(()=>{const refresh=()=>{if(projects!==null)api('projects').then(setProjects).catch(e=>notify(String(e)))};window.addEventListener('projects-changed',refresh);return()=>window.removeEventListener('projects-changed',refresh)},[projects!==null]);
  useEffect(()=>{const on=(e:Event)=>setNotice((e as CustomEvent).detail);window.addEventListener('studio-notice',on);return()=>window.removeEventListener('studio-notice',on)},[]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),5500);return()=>clearTimeout(t)},[notice]);
  const save=async()=>{try{await api('projects',{project:useStore.getState().project});setSaved(true);notify('工程已保存到本机');}catch(e){notify(String(e))}};
  useEffect(()=>{setSaved(false)},[project]);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();save()}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[]);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const updateName = (name: string) => useStore.setState((s) => ({ project: { ...s.project, name } }));
  const fileRef = useRef<HTMLInputElement>(null);
  const [libW, setLibW] = usePanelSize("studio-lib-w", 320);
  const [inspW, setInspW] = usePanelSize("studio-insp-w", 300);
  const [tlH, setTlH] = usePanelSize("studio-tl-h", 250);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target) || document.querySelector("dialog[open]") || mode!=="edit") return;
      const s = useStore.getState();
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (s.selectedClipId) s.removeClip(s.selectedClipId);
      } else if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
        if (s.selectedClipId) s.splitClip(s.selectedClipId, s.playhead);
      } else if (e.key.toLowerCase() === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (s.selectedClipId) s.duplicateClip(s.selectedClipId);
      } else if (e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" ? -1 : 1);
        const f = Math.max(0, s.playhead + step);
        seekTo(f);
        s.setPlayhead(f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const exportJson = async () => {try{await api('backup',{project});notify('工程备份已保存，并在 Finder 中显示')}catch(e){notify(String(e))}};

  const importJson = (file: File) => {
    file.text().then((text) => {
      try {
        const p = JSON.parse(text) as ProjectData;
        if (!p || !Array.isArray(p.tracks) || ![p.width,p.height,p.fps].every(Number.isFinite) || p.width<16 || p.height<16 || p.fps<1 || p.tracks.some(t=>!Array.isArray(t.clips)||t.clips.some(c=>![c.start,c.duration,c.speed,c.inOffset,c.opacity,c.scale,c.x,c.y].every(Number.isFinite)||c.start<0||c.duration<1||c.speed<=0))) throw new Error("bad format");
        useStore.getState().setProject(p);
      } catch {
        window.alert("导入失败：不是合法的工程 JSON");
      }
    });
  };

  const navigate=useCallback((id:string)=>{useStore.getState().setPreview(null);setMode(id)},[]);
  const openProjects=async()=>{try{setProjects(await api('projects'))}catch(e){notify(String(e))}};
  const newProject=()=>{const s=useStore.getState();s.setProject({name:'未命名作品',fps:30,width:1080,height:1920,background:'#151918',tracks:[{id:'captions',name:'字幕与标注',clips:[]},{id:'visual',name:'画面',clips:[]},{id:'voice',name:'配音',clips:[]}]});navigate('edit')};
  const gallery=['library','assets','audio','themes','record'].includes(mode);
  const clipCount=project.tracks.reduce((n,t)=>n+t.clips.length,0);
  const nav=[['library','grid','发现镜头'],['edit','film','视频剪辑'],['director','film','逐句导演'],['voice','mic','豆包配音'],['capture','globe','网页采集'],['record','film','录屏工作台'],['assets','image','我的素材'],['audio','music','音乐音效'],['themes','palette','画面主题']];
  return <div className="app studio-light">
    <header className="topbar">
      <button className="studio-brand" onClick={()=>navigate('library')} aria-label="ShotCraft 首页"><span className="brand-symbol"><i/><i/><i/></span><strong>ShotCraft<span>视频创作工作台</span></strong></button>
      <div className="project-identity"><Icon name="folder" size={17}/><input aria-label="工程名称" className="project-name" value={project.name} onChange={e=>updateName(e.target.value)} spellCheck={false}/><span className="save-state"><i/>{saved?'已保存':'本地草稿'}</span></div>
      <div className="topbar-actions">
        <button className="btn quiet" onClick={openProjects}><Icon name="folder" size={16}/>打开工程</button>
        <button className="btn quiet" onClick={save}><Icon name="save" size={16}/>保存</button>
        <details className="project-more"><summary aria-label="更多工程操作"><Icon name="more"/></summary><div><button onClick={newProject}><Icon name="plus" size={16}/>新建工程</button><button onClick={exportJson}>备份工程</button><button onClick={()=>fileRef.current?.click()}>导入工程 JSON</button></div></details>
        <ExportButton/>
      </div>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)importJson(f);e.target.value=''}}/>
    </header>
    <div className="studio-body">
      <aside className="studio-rail"><button className="create-button" onClick={newProject}><Icon name="plus" size={19}/>新建视频</button><nav aria-label="工作台导航">{nav.map(([id,icon,label],i)=><React.Fragment key={id}>{i===4&&<div className="rail-divider"/>}<button aria-current={mode===id?'page':undefined} className={mode===id?'active':''} onClick={()=>navigate(id)}><Icon name={icon} size={19}/><span>{label}</span>{id==='edit'&&clipCount>0&&<small>{clipCount}</small>}</button></React.Fragment>)}</nav><div className="rail-bottom"><button onClick={openProjects}><Icon name="folder" size={18}/>已保存工程</button><button onClick={()=>setTrashOpen(true)}><Icon name="trash" size={18}/>回收站</button><div className="local-status"><span className="local-avatar">S</span><span>本地创作空间<small>内容保存在这台 Mac</small></span></div><span className="version-label">ShotCraft Studio 0.6.0</span></div></aside>
      <div className={'studio-content '+(gallery?'browse-content':'edit-content')}>
        {mode==='director'?<DirectorPanel onEdit={()=>navigate('edit')} onVoice={()=>navigate('voice')}/>:mode==='record'?<ScreenRecorderPanel onEdit={()=>navigate('edit')}/>:gallery?<LibraryPanel key={mode} gallery initialTab={mode==='assets'?'media':mode==='audio'?'sfx':mode==='themes'?'themes':'cards'} onNavigate={navigate}/>:<>
          <div className="workspace-bar"><div className="workspace-title"><Icon name={mode==='edit'?'film':mode==='voice'?'mic':'globe'} size={18}/><b>{mode==='edit'?'视频剪辑':mode==='voice'?'豆包配音':'网页素材采集'}</b></div><span className="workspace-note">{clipCount} 个片段 · {(projectEndFrame(project)/project.fps).toFixed(1)} 秒</span>{mode==='edit'&&<button className="btn" onClick={()=>setCaptionsOpen(true)}>自动字幕</button>}<button className="icon-button" aria-label="撤销" disabled={!canUndo} onClick={undo}><Icon name="undo" size={16}/></button><button className="icon-button" aria-label="重做" disabled={!canRedo} onClick={redo}><Icon name="redo" size={16}/></button><label>画幅<select aria-label="画幅" value={`${project.width}x${project.height}`} onChange={e=>{const [width,height]=e.target.value.split('x').map(Number);useStore.getState().setProject({...project,width,height})}}><option value="1080x1920">9:16 竖屏</option><option value="1920x1080">16:9 横屏</option><option value="1080x1080">1:1 方形</option></select></label></div>
          <main className="main"><div className="panel-wrap editor-library" style={{width:libW}}>{mode==='edit'?<LibraryPanel/>:<ProductionPanel key={mode} mode={mode} onEdit={()=>navigate('edit')}/>}</div><div className="splitter v" title="拖拽调整素材库宽度" onPointerDown={e=>{const start=libW;startSplit(e,dx=>setLibW(clamp(start+dx,220,440)))}}/><PreviewPanel/><div className="splitter v" title="拖拽调整属性面板宽度" onPointerDown={e=>{const start=inspW;startSplit(e,dx=>setInspW(clamp(start-dx,260,440)))}}/><div className="panel-wrap editor-inspector" style={{width:inspW}}><Inspector/></div></main>
          <div className="splitter h" title="拖拽调整时间轨高度" onPointerDown={e=>{const start=tlH;startSplit(e,(_dx,dy)=>setTlH(clamp(start-dy,150,480)))}}/><div className="panel-wrap timeline-wrap" style={{height:tlH}}><Timeline/></div>
          <footer className="statusbar"><span><i/>已在本机自动存稿</span><span>空格 播放　S 分割　⌘Z 撤销　⌘D 复制</span></footer>
        </>}
      </div>
    </div>
    {gallery&&previewItem&&<Modal label="镜头预览与编辑" className="template-dialog" onClose={()=>useStore.getState().setPreview(null)}><div className="dialog-heading"><div><b>镜头预览与编辑</b><span>替换素材后，把当前版本加入视频</span></div><button className="btn" onClick={()=>navigate('edit')}>进入视频剪辑<Icon name="arrow" size={16}/></button><button className="icon-button" aria-label="关闭镜头预览" onClick={()=>useStore.getState().setPreview(null)}><Icon name="close"/></button></div><div className="template-dialog-body"><PreviewPanel/><Inspector/></div></Modal>}
    {captionsOpen&&<CaptionsPanel onClose={()=>setCaptionsOpen(false)}/>}
    {trashOpen&&<TrashPanel onClose={()=>setTrashOpen(false)}/>}
    {notice&&<div className="toast" role="status"><Icon name="check" size={17}/>{notice}</div>}
    {projects&&<Modal label="打开工程" className="project-dialog" onClose={()=>setProjects(null)}><div className="dialog-heading"><b>已保存工程</b><button className="icon-button" aria-label="关闭工程列表" onClick={()=>setProjects(null)}><Icon name="close"/></button></div>{projects.length===0?<div className="empty-state"><Icon name="folder" size={32}/><h3>还没有保存的工程</h3><p>编辑完成后点击顶部“保存”，随时回来继续创作。</p></div>:projects.map(p=><div key={p.id} className="saved-project-item"><button className="project-row" onClick={async()=>{try{const d=await api('projects/'+p.id);useStore.getState().setProject(d);navigate('edit');setProjects(null)}catch(e){notify(String(e))}}}><Icon name="film"/><span><b>{p.name}</b><small>{new Date(p.updated).toLocaleString()}</small></span><Icon name="arrow" size={16}/></button><button className="icon-button delete-project" aria-label={'删除作品 '+p.name} title="移入回收站，当前编辑草稿仍保留" onClick={async()=>{try{await removeLibraryItem('projects',p.id,p.name);notify('作品已移入回收站')}catch(e){notify(String(e))}}}><Icon name="trash" size={18}/></button></div>)}</Modal>}
  </div>;
};
