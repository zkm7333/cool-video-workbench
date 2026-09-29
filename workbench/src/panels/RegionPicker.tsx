import {useEffect,useRef,useState} from 'react';
import {api} from '../desktop-api';
import {Modal} from '../ui/Modal';

type Rect={x:number;y:number;width:number;height:number};
type Preview={image:string;pixels:{width:number;height:number};display:Rect};
export function RegionPicker({onClose,onStart}:{onClose:()=>void;onStart:(rect:Rect)=>Promise<void>}){
 const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[rect,setRect]=useState<Rect|null>(null);
 const image=useRef<HTMLImageElement>(null),anchor=useRef<{x:number;y:number}|null>(null);
 const closed=()=>{void api('recordly/region/preview/clear',{}).catch(()=>{});onClose()};
 const refresh=async()=>{setBusy(true);setError('');setRect(null);try{setPreview(await api('recordly/region/preview',{}))}catch(e){setError(String(e))}finally{setBusy(false)}};
 useEffect(()=>{void refresh();return()=>{void api('recordly/region/preview/clear',{}).catch(()=>{})}},[]);
 const point=(e:React.PointerEvent)=>{const b=image.current!.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))}};
 const update=(e:React.PointerEvent)=>{if(!anchor.current||!preview)return;const p=point(e),a=anchor.current,d=preview.display;setRect({x:Math.round(d.x+Math.min(a.x,p.x)*d.width),y:Math.round(d.y+Math.min(a.y,p.y)*d.height),width:Math.round(Math.abs(p.x-a.x)*d.width),height:Math.round(Math.abs(p.y-a.y)*d.height)})};
 const start=async()=>{if(!rect)return;setBusy(true);setError('');try{await onStart(rect);onClose()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const box=rect&&preview?{left:(rect.x-preview.display.x)/preview.display.width*100+'%',top:(rect.y-preview.display.y)/preview.display.height*100+'%',width:rect.width/preview.display.width*100+'%',height:rect.height/preview.display.height*100+'%'}:null;
 return <Modal label="框选录制区域" className="region-picker-dialog" onClose={closed}><div className="dialog-heading"><div><b>框选录制区域</b><span>截取主屏幕预览后，拖动框选要录的画面</span></div><button className="icon-button" onClick={closed} aria-label="关闭区域选择">×</button></div><div className="region-picker-content"><p>点击“重新取景”后有约 3 秒切换到目标窗口，再回到工作台框选。</p>{preview?<div className="region-picker-image" onPointerDown={e=>{anchor.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);update(e)}} onPointerMove={e=>{if(anchor.current)update(e)}} onPointerUp={e=>{update(e);anchor.current=null;e.currentTarget.releasePointerCapture(e.pointerId)}}><img ref={image} src={preview.image} alt="主屏幕预览，拖动框选录制范围" draggable={false}/>{box&&<div className="region-picker-selection" style={box}/>}</div>:<div className="region-picker-placeholder">{busy?'正在取景，请切换到要录制的画面…':'尚未取得屏幕预览'}</div>}{rect&&<p>已选区域：{rect.width} × {rect.height} · 起点 {rect.x}, {rect.y}</p>}{error&&<p role="alert" className="recordly-error">{error}</p>}<div className="region-picker-actions"><button className="btn" disabled={busy} onClick={()=>void refresh()}>重新取景</button><button className="btn primary" disabled={busy||!rect||rect.width<64||rect.height<64} onClick={()=>void start()}>{busy?'准备中…':'开始录制这个区域'}</button></div></div></Modal>;
}
