import {useEffect,useRef,useState} from 'react';
import {api,notify} from '../desktop-api';
import {useStore} from '../store';
import {Modal} from '../ui/Modal';
import {Icon} from '../ui/Icon';
import {captionClips,type Caption} from '../captions/timing';

export function CaptionsPanel({onClose}:{onClose:()=>void}){
 const project=useStore(s=>s.project),selected=useStore(s=>s.selectedClipId);
 const sources=project.tracks.flatMap(t=>t.clips).filter(c=>['audio-clip','video-clip'].includes(c.cardId)&&String(c.props.file||'').startsWith('uploads/'));
 const [sourceId,setSourceId]=useState(()=>sources.find(c=>c.id===selected)?.id||sources[0]?.id||'');
 const [language,setLanguage]=useState('zh'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [ready,setReady]=useState(false),[cues,setCues]=useState<Caption[]>([]),[fontSize,setFontSize]=useState(48),[bottom,setBottom]=useState(110);
 const job=useRef(''),alive=useRef(true),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),sourceFile=useRef('');
 useEffect(()=>{alive.current=true;void api('captions/status').then(s=>{if(alive.current)setReady(s.ready)}).catch(e=>{if(alive.current)setError(String(e))});return()=>{alive.current=false;clearTimeout(timer.current);if(job.current)void api('captions/cancel',{id:job.current}).catch(()=>{})}},[]);
 const poll=async(id:string)=>{
  try{const result=await api('captions/job/'+id);if(!alive.current)return;setMessage(result.message);
   if(result.status==='running'){timer.current=setTimeout(()=>void poll(id),1200);return}
   job.current='';setBusy(false);if(result.status==='done'){setCues(result.captions);setReady(true)}else setError(result.message);
  }catch(e){if(alive.current){setError(String(e));setBusy(false)}job.current=''}
 };
 const generate=async()=>{
  const source=sources.find(c=>c.id===sourceId);if(!source)return;
  setBusy(true);setError('');setCues([]);setMessage('正在准备…');sourceFile.current=String(source.props.file);
  try{const r=await api('captions/start',{file:source.props.file,language});job.current=r.id;if(!alive.current){void api('captions/cancel',{id:r.id});return}void poll(r.id)}catch(e){if(alive.current){setBusy(false);setError(String(e))}}
 };
 const add=()=>{
  const s=useStore.getState(),source=s.project.tracks.flatMap(t=>t.clips).find(c=>c.id===sourceId);
  if(!source||source.props.file!==sourceFile.current){setError('源素材已更换，请重新识别');return}
  const clips=captionClips(cues,source,s.project.fps,fontSize,bottom);if(!clips.length){setError('当前片段裁剪范围内没有字幕');return}
  const id='auto-captions-'+source.id;
  if(s.project.tracks.some(t=>t.id===id)&&!window.confirm('替换这段素材之前生成的字幕？已有修改将被替换，可撤销。'))return;
  s.setProject({...s.project,tracks:[{id,name:'自动字幕 · '+(source.label||'语音'),clips},...s.project.tracks.filter(t=>t.id!==id)]});
  notify(`已加入 ${clips.length} 句字幕，可在时间线上选中修改，⌘Z 撤销`);onClose();
 };
 return <Modal label="自动字幕" className="caption-dialog" onClose={()=>{if(!busy)onClose()}}><div className="dialog-heading"><div><b>自动字幕</b><span>本机识别 · 校对后加入可编辑字幕轨</span></div><button className="icon-button" aria-label="关闭自动字幕" disabled={busy} onClick={onClose}><Icon name="close"/></button></div><div className="caption-content">
 {sources.length?<><label>识别来源<select aria-label="字幕识别来源" disabled={busy} value={sourceId} onChange={e=>{setSourceId(e.target.value);setCues([]);setError('');setMessage('')}}>{sources.map(c=><option key={c.id} value={c.id}>{c.label||String(c.props.file).split('/').pop()} · {(c.start/project.fps).toFixed(1)} 秒处</option>)}</select></label><label>语言<select aria-label="字幕识别语言" disabled={busy} value={language} onChange={e=>setLanguage(e.target.value)}><option value="zh">中文</option><option value="en">英语</option><option value="auto">自动检测</option></select></label><p className="panel-help">{ready?'识别模型已就绪。':'首次会下载约 466 MB 识别模型，需要联网。'}语音在本机处理，不上传音视频。字幕会匹配片段的裁剪、位置和速度；识别结果需要校对。</p><button className="btn primary" disabled={busy} onClick={()=>void generate()}>{busy?'正在处理…':ready?'识别语音生成字幕':'下载模型并生成字幕'}</button>{busy&&<button className="btn" onClick={()=>void api('captions/cancel',{id:job.current}).catch(e=>setError(String(e)))} disabled={!job.current}>取消</button>}</>:<div className="empty-state"><h3>先加入视频或音频</h3><p>将导入素材加入时间线后，即可识别人声生成字幕。</p></div>}
 <p role="status">{message}</p>{error&&<p role="alert" className="recordly-error">{error}</p>}
 {cues.length>0&&<><div className="caption-style"><label>字号<input aria-label="字幕字号" type="number" min="16" max="100" value={fontSize} onChange={e=>setFontSize(Math.max(16,Math.min(100,Number(e.target.value)||48)))}/></label><label>底距<input aria-label="字幕底距" type="number" min="0" max="600" value={bottom} onChange={e=>setBottom(Math.max(0,Math.min(600,Number(e.target.value)||0)))}/></label></div><div className="caption-cues">{cues.map((c,i)=><label key={i}><span>{(c.startMs/1000).toFixed(1)}–{(c.endMs/1000).toFixed(1)} 秒</span><textarea aria-label={'第 '+(i+1)+' 句字幕'} rows={2} value={c.text} onChange={e=>setCues(v=>v.map((x,j)=>j===i?{...x,text:e.target.value}:x))}/></label>)}</div><button className="btn primary" onClick={add}>加入字幕轨道</button><p className="panel-help">时间为源素材中的句子时间。加入后仍可逐句修改文字、拖动时间、调整字号与底距。</p></>}
 </div></Modal>;
}
