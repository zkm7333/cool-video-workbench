import React,{useEffect,useRef,useState} from 'react';
import {api,upload} from '../desktop-api';
import {Modal} from '../ui/Modal';
import {Icon} from '../ui/Icon';
import type {MediaItem} from '../mediaManifest';
type Rect={x:number;y:number;width:number;height:number};
export const WebsiteCapture:React.FC<{onClose:()=>void;onSaved:(asset:MediaItem)=>void;replace?:boolean}>=({onClose,onSaved,replace})=>{
 const [url,setUrl]=useState(''),[selector,setSelector]=useState(''),[translate,setTranslate]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [asset,setAsset]=useState<MediaItem|null>(null),[size,setSize]=useState({width:0,height:0}),[selection,setSelection]=useState<Rect|null>(null),[zoom,setZoom]=useState<'fit'|number>('fit');
 const img=useRef<HTMLImageElement>(null),preview=useRef<HTMLDivElement>(null),anchor=useRef<{x:number;y:number}|null>(null),pointer=useRef<{x:number;y:number}|null>(null),scrollFrame=useRef<number|null>(null);
 const stopScroll=()=>{if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);scrollFrame.current=null;pointer.current=null};
 useEffect(()=>()=>{if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current)},[]);
 const capture=async()=>{setError('');setBusy(true);setAsset(null);setSelection(null);setSize({width:0,height:0});try{
   const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw Error('请输入完整的 http 或 https 网页地址');
   const result=await api('capture',{url:parsed.href,selector,translate});setAsset(result);window.dispatchEvent(new Event('assets-changed'));
 }catch(e){setError(String(e))}finally{setBusy(false)}};
 const point=(clientX:number,clientY:number)=>{const r=img.current!.getBoundingClientRect();return {x:Math.round(Math.max(0,Math.min(size.width,(clientX-r.left)*size.width/r.width))),y:Math.round(Math.max(0,Math.min(size.height,(clientY-r.top)*size.height/r.height)))}};
 const updateSelection=(clientX:number,clientY:number)=>{if(!anchor.current)return;const p=point(clientX,clientY),a=anchor.current;setSelection({x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.abs(p.x-a.x),height:Math.abs(p.y-a.y)})};
 const autoScroll=()=>{const box=preview.current,p=pointer.current;if(!box||!p||!anchor.current){scrollFrame.current=null;return}const r=box.getBoundingClientRect(),edge=48,speed=18;const axis=(v:number,start:number,end:number)=>v<start+edge?-speed:v>end-edge?speed:0;const dx=axis(p.x,r.left,r.right),dy=axis(p.y,r.top,r.bottom);if(dx||dy){box.scrollBy(dx,dy);updateSelection(p.x,p.y)}scrollFrame.current=requestAnimationFrame(autoScroll)};
 const save=async(full=false)=>{if(!asset||!img.current||!size.width)return;setBusy(true);setError('');try{
   let result=asset;
   if(!full){if(!selection||selection.width<2||selection.height<2)throw Error('请先拖动鼠标框选要截取的区域');
    const {x,y,width,height}=selection;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)throw Error('无法创建裁剪画布');
    context.drawImage(img.current,x,y,width,height,0,0,width,height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('裁剪失败，请缩小选区重试')),'image/png'));
    result=await upload(new File([blob],`网页选区-${width}x${height}.png`,{type:'image/png'}));
   }
   window.dispatchEvent(new Event('assets-changed'));onSaved(result);
 }catch(e){setError(String(e))}finally{setBusy(false)}};
 const change=(key:keyof Rect,value:number)=>{if(!Number.isFinite(value))return;setSelection(current=>{
   const r={...(current??{x:0,y:0,width:size.width,height:size.height}),[key]:Math.round(value)};
   r.x=Math.max(0,Math.min(size.width-2,r.x));r.y=Math.max(0,Math.min(size.height-2,r.y));
   r.width=Math.max(2,Math.min(size.width-r.x,r.width));r.height=Math.max(2,Math.min(size.height-r.y,r.height));return r;
 })};
 return <Modal label="截取网页自定义区域" className="web-capture-dialog" onClose={()=>{if(!busy)onClose()}}>
 <div className="dialog-heading"><div><b>从网站获取素材</b><span>加载网页 → 滚动预览 → 拖动框选 → 保存{replace?'并替换':''}</span></div><button className="icon-button" aria-label="关闭网页截取" disabled={busy} onClick={onClose}><Icon name="close"/></button></div>
 <div className="web-capture-body"><div className="web-capture-url"><input aria-label="素材网页地址" type="url" placeholder="https://网站地址" value={url} disabled={busy} onChange={e=>setUrl(e.target.value)}/><button className="btn primary" disabled={busy||!url.trim()} onClick={capture}>{busy?'处理中…':asset?'重新加载网页':'加载网页预览'}</button></div>
 <label className="web-capture-translate"><input type="checkbox" checked={translate} disabled={busy} onChange={e=>{setTranslate(e.target.checked);setAsset(null);setSelection(null);setSize({width:0,height:0})}}/><span>先用谷歌翻译成中文，再预览和截取</span></label>
 <details><summary>高级：按网页元素截取（可选）</summary><input aria-label="网页区域选择器" placeholder="例如 main、#features" disabled={busy} value={selector} onChange={e=>setSelector(e.target.value)}/></details>
 <p className="panel-help">在下方截图上按住鼠标框选任意位置，可滚动查看网页下方内容。勾选后会等待网页文字翻译完成再截取；代码、专有名称和图片里的英文通常会保留。使用独立浏览器，不读取已登录状态。整页截图也会保留在素材库。</p>
 {error&&<p role="alert" className="asset-picker-error">{error}</p>}
 <div className="web-capture-preview-toolbar"><span>预览比例</span><div className="web-capture-zoom">{([{label:'适应宽度',value:'fit'},{label:'100%',value:1},{label:'150%',value:1.5},{label:'200%',value:2}] as const).map(item=><button key={item.label} type="button" className={zoom===item.value?'active':''} disabled={!asset||busy} onClick={()=>setZoom(item.value)}>{item.label}</button>)}</div><span className="web-capture-zoom-hint">放大后可横向滚动，拖到边缘可继续框选</span></div>
 <div className="web-capture-preview" ref={preview}>{asset?<div className="web-crop-surface" style={{width:zoom==='fit'?'100%':`${Math.round(size.width*zoom)}px`}} onPointerDown={e=>{if(e.button!==0||!size.width||busy)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);anchor.current=point(e.clientX,e.clientY);pointer.current={x:e.clientX,y:e.clientY};setSelection(null);if(scrollFrame.current===null)scrollFrame.current=requestAnimationFrame(autoScroll)}} onPointerMove={e=>{if(!anchor.current)return;pointer.current={x:e.clientX,y:e.clientY};updateSelection(e.clientX,e.clientY)}} onPointerUp={e=>{updateSelection(e.clientX,e.clientY);anchor.current=null;stopScroll();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{anchor.current=null;stopScroll()}} onLostPointerCapture={()=>{anchor.current=null;stopScroll()}}>
 <img ref={img} draggable={false} src={'/'+asset.file} alt="网页截图框选预览" onLoad={e=>setSize({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} onError={()=>setError('网页截图加载失败，请重新加载')}/>
 {selection&&size.width>0&&<div className="web-crop-selection" style={{left:selection.x/size.width*100+'%',top:selection.y/size.height*100+'%',width:selection.width/size.width*100+'%',height:selection.height/size.height*100+'%'}}/>}
 </div>:<div className="empty-state"><Icon name="globe" size={32}/><h3>{busy?'正在获取网页截图…':'先输入网页地址'}</h3><p>加载后即可直接框选位置</p></div>}</div>
 <div className="web-crop-controls">{(['x','y','width','height'] as const).map((key,i)=><label key={key}>{['左侧 X','顶部 Y','宽度','高度'][i]}<input type="number" aria-label={'截取'+['左侧 X','顶部 Y','宽度','高度'][i]} disabled={!size.width||busy} min={i<2?0:2} value={selection?.[key]??''} onChange={e=>change(key,Number(e.target.value))}/></label>)}<span>原图像素{size.width>0?` · ${size.width} × ${size.height}`:''}</span></div>
 <div className="web-capture-actions"><button className="btn" disabled={!asset||busy||!size.width} onClick={()=>void save(true)}>使用整张截图</button><button className="btn" disabled={!selection||busy} onClick={()=>setSelection(null)}>重新框选</button><button className="btn primary" disabled={!selection||selection.width<2||selection.height<2||busy} onClick={()=>void save()}>{replace?'截取选区并替换':'截取选区并存入素材库'}</button></div>
 </div></Modal>;
};
