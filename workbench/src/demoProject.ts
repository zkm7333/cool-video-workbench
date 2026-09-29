import type {ProjectData} from './types';
import {uid} from './types';
export const demoProject=():ProjectData=>{
 const clip=(cardId:string,start:number,duration:number,props:Record<string,unknown>,label:string)=>({id:uid('clip'),cardId,start,duration,inOffset:0,speed:1,opacity:1,scale:1,x:0,y:0,props,label});
 return {name:'我的第一支短片',fps:30,width:1080,height:1920,background:'#151918',tracks:[
 {id:uid('track'),name:'字幕与标注',clips:[]},
 {id:uid('track'),name:'画面',clips:[clip('manual-title',0,120,{title:'把想法，剪成作品。',subtitle:'自由选镜头 · 自由改内容',accent:'#d6ee83'},'开场标题'),clip('manual-web',120,150,{title:'让观众看到重点',file:''},'网页聚焦'),clip('manual-number',270,120,{title:'你的关键数字',value:100,unit:'%',subtitle:'示例数字，请替换为真实数据'},'数字展示')]},
 {id:uid('track'),name:'配音',clips:[]}]};
};
