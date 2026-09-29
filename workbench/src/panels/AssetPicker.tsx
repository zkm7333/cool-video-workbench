import React, {useEffect,useRef,useState} from 'react';
import {upload} from '../desktop-api';
import {loadAssetCatalog,thumbnailSrc} from '../assetCatalog';
import {MEDIA_ITEMS,type MediaItem} from '../mediaManifest';
import {DRAG_MIME,readDragPayload} from '../dnd';
import {Modal} from '../ui/Modal';
import {WebsiteCapture} from './WebsiteCapture';
import {Icon} from '../ui/Icon';

type Kind=MediaItem['kind'];
const kindOf=(file:string):Kind=>/\.(mp4|mov|webm)$/i.test(file)?'video':/\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(file)?'audio':'image';
const acceptFor={image:'image/png,image/jpeg,image/webp,image/gif',video:'video/mp4,video/quicktime,video/webm',audio:'audio/*'};
export const AssetPicker:React.FC<{label:string;value:unknown;kind:Kind;onBegin:()=>void;onChange:(v:unknown)=>void}> = ({label,value,kind,onBegin,onChange})=>{
 const [assets,setAssets]=useState<MediaItem[]>(MEDIA_ITEMS),[website,setWebsite]=useState(false),[library,setLibrary]=useState(false),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dragOver,setDragOver]=useState(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;const refresh=()=>loadAssetCatalog().then(a=>{if(mounted.current)setAssets(a.assets)}).catch(e=>{if(mounted.current)setError('读取导入素材失败：'+String(e))});refresh();window.addEventListener('assets-changed',refresh);return()=>{mounted.current=false;window.removeEventListener('assets-changed',refresh)}},[]);
 const apply=(file:string)=>{if(!mounted.current)return;if(file&&kindOf(file)!==kind){setError(`这个素材位需要${kind==='image'?'图片':kind==='video'?'视频':'音频'}，请选择对应素材。`);return}onBegin();onChange(file);setError('');setLibrary(false)};
 const importFile=async(f:File)=>{if(kindOf(f.name)!==kind){setError('文件类型与当前素材位不匹配');return}setBusy(true);setError('');try{const a=await upload(f);window.dispatchEvent(new Event('assets-changed'));apply(a.file)}catch(err){if(mounted.current)setError(String(err))}finally{if(mounted.current)setBusy(false)}};

 const available=assets.filter(a=>a.kind===kind),filtered=available.filter(a=>`${a.name} ${a.dir}`.toLowerCase().includes(query.toLowerCase()));
 const current=available.find(a=>a.file===value);
 return <div className={'asset-picker'+(dragOver?' asset-drag-over':'')} onDragOver={e=>{if(e.dataTransfer.types.includes(DRAG_MIME)||e.dataTransfer.types.includes('Files')){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';setDragOver(true)}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragOver(false)}} onDrop={e=>{e.preventDefault();e.stopPropagation();setDragOver(false);const payload=readDragPayload(e);if(payload?.props?.file){apply(String(payload.props.file));return}if(e.dataTransfer.files[0]){void importFile(e.dataTransfer.files[0]);return}setError('请拖入图片、视频或音频文件，镜头模板不能作为素材填入。')}}>
  <button type="button" className="btn asset-library-open" onClick={()=>{setQuery('');setLibrary(true)}}><Icon name="image" size={16}/>从素材库选择</button>
  {kind==='image'&&Boolean(value)&&<button className="asset-current" type="button" aria-label={'更换'+label} onClick={()=>{setQuery('');setLibrary(true)}}><img src={thumbnailSrc(String(value))} alt="当前素材"/><span>{current?.name||String(value).split('/').pop()}</span></button>}
  <select aria-label={label} value={String(value||'')} onChange={e=>apply(e.target.value)}><option value="">保留默认 / 清空替换</option>{Boolean(value)&&!available.some(a=>a.file===value)&&<option value={String(value)}>{String(value)}</option>}{available.map(a=><option key={a.file} value={a.file}>{a.name}</option>)}</select>
  <div className="asset-picker-actions"><label className="btn">导入本地文件<input hidden type="file" accept={acceptFor[kind]} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void importFile(f)}}/></label>{kind==='image'&&<button type="button" className="btn" onClick={()=>setWebsite(!website)}>从网站获取</button>}</div>
  <span className="asset-drop-hint">也可将左侧素材拖到这里替换</span>
  {website&&kind==='image'&&<WebsiteCapture replace onClose={()=>setWebsite(false)} onSaved={a=>{apply(a.file);setWebsite(false)}}/>}
  {busy&&!website&&<span className="dim">正在导入…</span>}{error&&<p role="alert" className="asset-picker-error">{error}</p>}
  {library&&<Modal label={'从素材库选择：'+label} className="asset-library-dialog" onClose={()=>setLibrary(false)}><div className="dialog-heading"><div><b>从素材库选择</b><span>应用到「{label}」，保留镜头的运镜和时长</span></div><button className="icon-button" aria-label="关闭素材选择" onClick={()=>setLibrary(false)}><Icon name="close"/></button></div><div className="asset-library-search"><Icon name="search" size={18}/><input aria-label="搜索可用素材" placeholder="搜索素材名称…" value={query} onChange={e=>setQuery(e.target.value)}/><span>{filtered.length} 个素材</span></div><div className="asset-library-grid">{filtered.map(a=><button type="button" key={a.file} className={value===a.file?'selected':''} aria-label={'使用素材 '+a.name} onClick={()=>apply(a.file)}>{a.kind==='image'?<img loading="lazy" src={thumbnailSrc(a.file)} alt={a.name}/>:<span className="asset-kind-icon"><Icon name={a.kind==='audio'?'music':'film'} size={36}/></span>}<b>{a.name}</b><small>{a.dir==='导入素材'?'我的素材':a.dir||'工程素材'}</small></button>)}{!filtered.length&&<div className="empty-state"><Icon name="image" size={28}/><h3>{query?'没有匹配的素材':'还没有可用素材'}</h3><p>{query?'换个名称搜索，或清空搜索框。':'关闭此窗口，点击“导入本地文件”添加素材。'}</p></div>}</div></Modal>}
 </div>;
};
