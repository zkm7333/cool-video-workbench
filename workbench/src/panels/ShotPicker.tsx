import React,{useState} from 'react';
import {Modal} from '../ui/Modal';
import {CARDS} from '../cards/registry';
import {LazyCardLoop,LazyLoopVideo} from './LibraryPanel';
import {rankShots,type ShotInfo} from '../director/shot-recommender';
import type {Beat} from '../director/model';
export const ShotPicker:React.FC<{beat:Beat;index:number;total:number;catalog:ShotInfo[];used:string[];onChoose:(id:string)=>void;onClose:()=>void}>=({beat,index,total,catalog,used,onChoose,onClose})=>{
 const [query,setQuery]=useState(''),[category,setCategory]=useState('全部');
 const ranked=rankShots(beat.text,index,total,beat.end-beat.start,catalog,used);
 const recommended=ranked.slice(0,4),categories=['全部',...new Set(catalog.map(c=>c.category))];
 const shown=catalog.filter(c=>(category==='全部'||c.category===category)&&`${c.name} ${c.summary} ${c.category}`.toLowerCase().includes(query.toLowerCase()));
 const cell=(item:ShotInfo,reason?:string)=><button key={item.id} type="button" className={'director-shot-cell lib-cell'+(beat.cardId===item.id?' selected':'')} aria-label={'选择镜头 '+item.name} onClick={()=>onChoose(item.id)}><div className="lib-visual">{CARDS[item.id]?.preview?<LazyLoopVideo src={'/'+CARDS[item.id].preview}/>:<LazyCardLoop card={CARDS[item.id]}/>}</div><b>{item.name}</b><small>{item.category} · {item.duration.toFixed(1)} 秒 · {item.mediaSlots?'可换画面':'文字/图形'}</small><p>{reason??item.summary}</p></button>;
 return <Modal label="从镜头库选择" className="director-shot-dialog" onClose={onClose}><div className="dialog-heading"><div><b>从镜头库选择</b><span>第 {index+1} 句 · 推荐与完整镜头库，选择后仍可替换素材和调整动作</span></div><button className="icon-button" aria-label="关闭镜头库" onClick={onClose}>✕</button></div><div className="director-shot-body"><h3>为这句推荐</h3><div className="director-shot-grid">{recommended.map((c)=>{const info=catalog.find(x=>x.id===c.cardId)!;return cell(info,c.reason)})}</div><div className="director-shot-search"><input aria-label="搜索镜头库" placeholder="搜索名称、用途或效果…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="镜头分类" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select><span>全部镜头 {shown.length}</span></div><div className="director-shot-grid director-shot-all">{shown.map(c=>cell(c))}{!shown.length&&<p className="empty-state">没有匹配镜头，换个词或分类。</p>}</div></div></Modal>;
};
