import {useCallback,useEffect,useRef,useState} from 'react';
import {api,upload,notify} from '../desktop-api';
import {useStore} from '../store';
import {Icon} from '../ui/Icon';
import {RegionPicker} from './RegionPicker';

type Recording={file:string;name:string;kind:'video'|'image';duration:number;width:number;height:number;importedAt:number};
type InboxFile={name:string;size:number;modified:number};
type RegionJob={id:string;name:string;status:string;message:string;item?:Recording};
type ModuleStatus={installed:boolean;version:string;inbox:string;imports:Recording[];region?:RegionJob|null};
const FEATURES=[
 {icon:'film',title:'录制真实操作',body:'屏幕与应用窗口、系统声音、麦克风、倒计时录制。'},
 {icon:'search',title:'自动聚焦与运镜',body:'根据鼠标活动建议放大区域，手动调整位置、时长与节奏。'},
 {icon:'arrow',title:'光标动画',body:'平滑移动、大小、运动模糊、点击弹跳与光标循环。'},
 {icon:'image',title:'摄像头与画面包装',body:'摄像头气泡、位置和镜像，背景、渐变、圆角、阴影与留白。'},
 {icon:'grid',title:'时间线与标注',body:'裁剪、变速、额外音轨、文字、图片和图形标注，逐段编辑。'},
 {icon:'save',title:'可编辑工程与导出',body:'保存和继续编辑 .recordly 工程，调整画幅与质量，导出 MP4 或 GIF。'},
];

export function ScreenRecorderPanel({onEdit}:{onEdit:()=>void}){
 const [status,setStatus]=useState<ModuleStatus|null>(null),[inbox,setInbox]=useState<InboxFile[]>([]);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[tab,setTab]=useState<'workspace'|'exports'>('workspace');
 const input=useRef<HTMLInputElement>(null),mounted=useRef(true);
 const [region,setRegion]=useState<RegionJob|null>(null),[pickerOpen,setPickerOpen]=useState(false);
 const regionTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const refresh=useCallback(async()=>{
  const [next,files]=await Promise.all([api('recordly'),api('recordly/inbox')]);
  if(mounted.current){setStatus(next);setInbox(files);if(next.region&&!regionTimer.current){setRegion(next.region);void pollRegion(next.region.id)}}
 },[]);
 useEffect(()=>{
  mounted.current=true;const reload=()=>void refresh().catch(e=>{if(mounted.current)setError(String(e))});reload();
  window.addEventListener('focus',reload);window.addEventListener('assets-changed',reload);
  return()=>{mounted.current=false;clearTimeout(regionTimer.current);window.removeEventListener('focus',reload);window.removeEventListener('assets-changed',reload)};
 },[refresh]);
 const run=async(label:string,fn:()=>Promise<void>)=>{setBusy(label);setError('');try{await fn()}catch(e){if(mounted.current)setError(String(e))}finally{if(mounted.current)setBusy('')}};
 const pollRegion=async(id:string)=>{
  try{const next:RegionJob=await api('recordly/region/'+id);if(!mounted.current)return;setRegion(next);
   if(['recording','stopping','importing'].includes(next.status)){regionTimer.current=setTimeout(()=>{regionTimer.current=undefined;void pollRegion(id)},1300);return}
   if(next.status==='done'){window.dispatchEvent(new Event('assets-changed'));await refresh();setTab('exports');notify('区域录制已进入素材库，可加入时间线')}
   else if(next.status==='error')setError(next.message);
  }catch(e){if(mounted.current)setError(String(e))}
 };
 const recordRegion=(rect:{x:number;y:number;width:number;height:number})=>run('region',async()=>{
  const result=await api('recordly/region',{rect});
  setRegion({id:result.id,name:'',status:'recording',message:'正在录制选中区域。完成后点击“停止并保存”'});
  setPickerOpen(false);void pollRegion(result.id);
 });
 const stopRegion=()=>run('stop-region',async()=>{if(!region)return;await api('recordly/region/stop',{id:region.id});setRegion(v=>v?{...v,status:'stopping',message:'正在保存录制视频…'}:v)});
 const launch=()=>run('launch',async()=>{await api('recordly/launch',{});notify('已打开 Recordly 录屏编辑器，成片导出后可回到这里接收')});
 const importFiles=(files:FileList|null)=>{if(!files?.length)return;void run('import',async()=>{
  let count=0;try{for(const file of Array.from(files)){
   if(!/\.(mp4|mov|webm|gif)$/i.test(file.name))throw Error('请选择导出的 MP4、MOV、WebM 或 GIF 文件');
   const asset=await upload(file);await api('recordly/register',{file:asset.file,name:file.name});count++;
  }}finally{if(count){window.dispatchEvent(new Event('assets-changed'));await refresh();setTab('exports');notify(`已接收 ${count} 个成片，可加入时间线`)}}
 })};
 const receive=(name:string)=>run(name,async()=>{await api('recordly/import',{name});window.dispatchEvent(new Event('assets-changed'));await refresh();notify('成片已加入素材库')});
 const add=(item:Recording)=>{
  useStore.getState().addClip(item.kind==='video'?'video-clip':'image-clip',undefined,undefined,{props:{file:item.file,fit:'contain'},label:item.name,duration:Math.max(2,Math.round(item.duration*30))});
  notify('已按完整成片时长加入画面轨道');onEdit();
 };
 const copyFolder=()=>run('copy',async()=>{if(!status)return;await navigator.clipboard.writeText(status.inbox);notify('接收文件夹路径已复制，在保存窗口按 ⌘⇧G 后粘贴')});
 return <div className="recordly-workspace">
  <div className="recordly-heading"><div><div className="recordly-eyebrow">RECORDING STUDIO</div><h1>录屏工作台</h1><p>录下真实操作，让光标、镜头和讲解一起工作。</p></div><span className={'recordly-module-status '+(status?.installed?'ready':'') }><i/>{status?status.installed?`Recordly ${status.version} · 已就绪`:'模块未安装':'正在检查模块…'}</span></div>
  <div className="recordly-tabs"><button className={tab==='workspace'?'active':''} onClick={()=>setTab('workspace')}>录制与编辑</button><button className={tab==='exports'?'active':''} onClick={()=>setTab('exports')}>成片接收 <small>{status?.imports.length||0}</small></button></div>
  {error&&<div className="recordly-error" role="alert">{error}<button aria-label="关闭错误提示" onClick={()=>setError('')}><Icon name="close" size={15}/></button></div>}
  {tab==='workspace'?<>
   <div className="recordly-hero"><div className="recordly-hero-copy"><span className="recordly-pill">完整录屏编辑器</span><h2>从一次操作，<br/>到一段清楚的演示。</h2><p>在独立窗口中使用 Recordly 的完整录制与编辑功能。保存工程，随时回来调整每一处运镜。</p><button className="btn primary" disabled={!status?.installed||!!busy} onClick={()=>void launch()}><Icon name="play" size={17}/>{busy==='launch'?'正在打开…':'打开录屏编辑器'}<Icon name="arrow" size={17}/></button><small>打开后点击“录制”，或通过“更多”打开视频文件与工程。</small></div><div className="recordly-hero-art" aria-hidden="true"><div className="recordly-art-window"><div className="recordly-art-chrome"><i/><i/><i/><span>Product walkthrough</span></div><div className="recordly-art-content"><div className="recordly-art-side"/><div className="recordly-art-main"><span/><div/><div/><div/></div><div className="recordly-art-focus"><Icon name="arrow" size={24}/><b>Focus</b></div></div><div className="recordly-art-timeline"><i/><i/><i/><i/><i/></div></div><span className="recordly-art-tag"><i/>Capture. Focus. Create.</span></div></div>
   <div className="recordly-region-card"><div><span className="recordly-pill">指定区域</span><h2>只录你框选的画面</h2><p>截取主屏幕预览，拖动框选矩形区域。录制结束后会自动接收到素材库。</p><small>区域录制使用 macOS 录屏；成片可以在时间线加配音、字幕，或导入 Recordly 编辑运镜。</small>{region&&<p role="status" className="recordly-region-status">{region.message}</p>}</div><div className="recordly-region-actions"><button className="btn primary" disabled={!!busy||!!region&&['recording','stopping','importing'].includes(region.status)} onClick={()=>setPickerOpen(true)}><Icon name="film" size={16}/>框选区域录制</button>{region?.status==='recording'&&<button className="btn" disabled={!!busy} onClick={()=>void stopRegion()}>停止并保存</button>}</div></div>
   <div className="recordly-feature-heading"><h2>一套完整的录屏创作工具</h2><span>所有工具在录屏编辑器内使用</span></div>
   <div className="recordly-feature-grid">{FEATURES.map(f=><div className="recordly-feature" key={f.title}><div className="recordly-feature-icon"><Icon name={f.icon} size={21}/></div><h3>{f.title}</h3><p>{f.body}</p></div>)}</div>
   <div className="recordly-return-banner"><Icon name="download" size={22}/><div><b>做好后，接回当前视频</b><p>导出到接收文件夹，或直接导入成片，再加入时间线继续配音、字幕与模板编排。</p></div><button className="btn" onClick={()=>setTab('exports')}>接收成片<Icon name="arrow" size={16}/></button></div>
  </>:<>
   <div className="recordly-receive"><div><h2>把录屏成片接回工作台</h2><p>在 Recordly 中导出 MP4 / GIF 后，导入这里。原始 .recordly 工程继续保留在录屏编辑器中。</p></div><button className="btn primary" disabled={!!busy} onClick={()=>input.current?.click()}><Icon name="plus" size={17}/>{busy==='import'?'正在接收…':'导入成片'}</button></div>
   <input ref={input} type="file" accept=".mp4,.mov,.webm,.gif" multiple hidden onChange={e=>{importFiles(e.target.files);e.target.value=''}}/>
   <div className="recordly-inbox"><div className="recordly-inbox-title"><Icon name="folder" size={20}/><div><b>接收文件夹</b><p>在导出保存窗口按 ⌘⇧G，粘贴下面的路径。返回这里即可看到文件。</p></div><button className="btn quiet" disabled={!!busy} onClick={()=>void run('refresh',refresh)}>刷新</button></div><div className="recordly-folder-path"><code>{status?.inbox||'正在读取…'}</code><button className="btn" disabled={!status||!!busy} onClick={()=>void copyFolder()}>复制路径</button><button className="btn" disabled={!!busy} onClick={()=>void run('reveal',async()=>{await api('recordly/reveal',{})})}>打开文件夹</button></div>{inbox.length>0&&<div className="recordly-pending">{inbox.map(file=><div key={file.name}><Icon name="film" size={17}/><span>{file.name}<small>{(file.size/1024/1024).toFixed(1)} MB</small></span><button className="btn" disabled={!!busy} onClick={()=>void receive(file.name)}>{busy===file.name?'正在接收…':'接收到素材库'}</button></div>)}</div>}</div>
   <div className="recordly-feature-heading"><h2>已接收成片</h2><span>{status?.imports.length||0} 个素材</span></div>
   {status?.imports.length?<div className="recordly-media-grid">{status.imports.map(item=><article key={item.file}><div className="recordly-media-thumb">{item.kind==='video'?<video src={'/'+item.file} preload="metadata" muted controls playsInline/>:<img src={'/'+item.file} alt={item.name}/>}</div><div className="recordly-media-info"><b title={item.name}>{item.name}</b><span>{item.width} × {item.height} · {item.duration.toFixed(1)} 秒</span><button className="btn" onClick={()=>add(item)}><Icon name="plus" size={15}/>加入时间线</button></div></article>)}</div>:<div className="recordly-empty"><Icon name="film" size={36}/><h3>接收你的第一段录屏成片</h3><p>成片会同时出现在“我的素材”，可以与配音、字幕和镜头模板组合。</p><button className="btn" disabled={!!busy} onClick={()=>input.current?.click()}>选择导出文件</button></div>}
  </>}
  {pickerOpen&&<RegionPicker onClose={()=>setPickerOpen(false)} onStart={recordRegion}/>}
  <footer className="recordly-footer"><span>录屏与编辑由 Recordly 提供 · AGPL-3.0</span><a href="https://github.com/webadderallorg/Recordly/tree/v1.4.0" target="_blank" rel="noreferrer">项目与源码<Icon name="arrow" size={13}/></a></footer>
 </div>
}
