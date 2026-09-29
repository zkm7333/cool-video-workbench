import React,{useEffect,useState} from 'react';
import {api,notify} from '../desktop-api';
import {libraryChanged} from '../assetCatalog';
import {Modal} from '../ui/Modal';
import {useStore} from '../store';
import {Icon} from '../ui/Icon';
type Entry={type:'assets'|'projects';id:string;name:string;deletedAt:string};
export const TrashPanel:React.FC<{onClose:()=>void}>=({onClose})=>{
 const [items,setItems]=useState<Entry[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 useEffect(()=>{api('trash').then(setItems).catch(e=>setError(String(e))).finally(()=>setLoading(false))},[]);
 const emptyTrash=async()=>{
  if(busy||!items.length)return;
  if(!window.confirm(`清空回收站中的 ${items.length} 项？此操作无法恢复。工程文件和导入素材副本将彻底删除，内置素材将永久隐藏。即使素材仍被当前草稿或作品引用，也会一并删除；相关作品可能出现素材缺失。`))return;
  setBusy('empty');setError('');
  let deleted=0;const failures:string[]=[];
  // Remove trashed projects first so their unused media can be removed in the same pass.
  const pending=[...items].sort((a,b)=>Number(b.type==='projects')-Number(a.type==='projects'));
  try{
   for(const item of pending){
    try{
     await api('trash/purge',{type:item.type,id:item.id,currentProject:useStore.getState().project,forceReferenced:true});
     deleted++;setItems(v=>v.filter(x=>x.type!==item.type||x.id!==item.id));
    }catch(e){failures.push(`${item.name}：${String(e)}`)}
   }
   if(failures.length)setError(`保留 ${failures.length} 项。\n${failures.join('\n')}`);
   notify(failures.length?`已删除 ${deleted} 项，保留 ${failures.length} 项`:`已清空回收站，共删除 ${deleted} 项`);
  }finally{libraryChanged();setBusy('')}
 };
 return <Modal label="回收站" className="trash-dialog" onClose={onClose}><div className="dialog-heading"><div><b>回收站</b><span>恢复或彻底删除；正在被工程使用的素材会受到保护。</span></div><button className="btn" disabled={loading||!!busy||!items.length} onClick={()=>void emptyTrash()}><Icon name="trash" size={16}/>{busy==='empty'?'正在清空…':'一键清空'}</button><button className="icon-button" aria-label="关闭回收站" onClick={onClose}><Icon name="close"/></button></div><div className="trash-list">{error&&<p role="alert" style={{whiteSpace:'pre-wrap'}}>{error}</p>}{loading?<p>正在读取…</p>:items.length?items.map(x=><div className="trash-row" key={x.type+x.id}><Icon name={x.type==='projects'?'film':'image'}/><div><b>{x.name}</b><small>{x.type==='projects'?'作品':'素材'} · {new Date(x.deletedAt).toLocaleString()}</small></div><button className="btn" disabled={!!busy} onClick={async()=>{setBusy(x.id);try{await api('trash/restore',{type:x.type,id:x.id});setItems(v=>v.filter(a=>a.type!==x.type||a.id!==x.id));libraryChanged();notify('已恢复：'+x.name)}catch(e){setError(String(e))}finally{setBusy('')}}}>{busy===x.id?'恢复中…':'恢复'}</button><button className="btn" disabled={!!busy} onClick={async()=>{if(!window.confirm(`彻底删除“${x.name}”？此操作无法恢复。${x.type==='assets'?'内置素材将永久从列表移除，导入素材将删除本机文件。':'已保存的工程文件将被删除。'}`))return;setBusy(x.id);setError('');try{await api('trash/purge',{type:x.type,id:x.id,currentProject:useStore.getState().project});setItems(v=>v.filter(a=>a.type!==x.type||a.id!==x.id));libraryChanged();notify('已彻底删除：'+x.name)}catch(e){setError(String(e))}finally{setBusy('')}}}>彻底删除</button></div>):<div className="empty-state"><Icon name="trash" size={30}/><h3>回收站是空的</h3><p>删除的素材和已保存作品会出现在这里。</p></div>}</div></Modal>;
};
