import {uid,type ClipData} from '../types';
// Compatible with Remotion's Caption JSON shape. Recognition is sentence-level, not verified word alignment.
export type Caption={text:string;startMs:number;endMs:number;timestampMs:number|null;confidence:number|null};
export function captionClips(captions:Caption[],source:ClipData,fps:number,fontSize:number,bottom:number):ClipData[]{
 return captions.flatMap(c=>{
  const start=Math.max(source.start,Math.round(source.start+(c.startMs/1000*fps-source.inOffset)/source.speed));
  const end=Math.min(source.start+source.duration,Math.round(source.start+(c.endMs/1000*fps-source.inOffset)/source.speed));
  if(!c.text.trim()||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
  return [{id:uid('caption'),cardId:'auto-caption',start,duration:end-start,inOffset:0,speed:1,opacity:1,scale:1,x:0,y:0,label:c.text.trim(),props:{text:c.text.trim(),fontSize,bottom,color:'#ffffff',box:true}}];
 });
}
