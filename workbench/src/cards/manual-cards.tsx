import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import type {CardDef, PropField} from './types';
const ease=Easing.bezier(.22,1,.36,1);
const Manual:React.FC<Record<string,unknown>>=(p)=>{
 const f=useCurrentFrame(),{width,height,fps}=useVideoConfig();
 const type=String(p.mode||'title'),portrait=height>width, scale=width/1080;
 const start=Number(p.trigger??.4)*fps, dur=Math.max(1,Number(p.moveDuration??.8)*fps);
 const t=interpolate(f,[start,start+dur],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});
 const accent=String(p.accent||'#d6ee83'), ink=String(p.ink||'#f1f3ee'), bg=String(p.background||'#151918');
 const title=String(p.title||''), sub=String(p.subtitle||'');
 const file=String(p.file||''), file2=String(p.file2||'');
 const heading={fontSize:(portrait?66:68)*scale,fontWeight:700,lineHeight:1.16,letterSpacing:-2*scale};
 const pageStyle:React.CSSProperties={width:'100%',height:'100%',objectFit:'contain'};
 return <AbsoluteFill style={{background:bg,color:ink,fontFamily:'-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',overflow:'hidden'}}>
  {type==='web'&&<>
   <AbsoluteFill style={{opacity:.2,backgroundImage:`linear-gradient(${ink}30 1px, transparent 1px),linear-gradient(90deg,${ink}30 1px, transparent 1px)`,backgroundSize:`${55*scale}px ${55*scale}px`,transform:'perspective(600px) rotateX(40deg) scale(1.5)'}}/>
   <div style={{position:'absolute',left:'7%',top:portrait?'24%':'13%',width:'86%',height:portrait?'48%':'68%',transform:`perspective(1400px) rotateY(${Number(p.tilt??-8)*(1-t)}deg) scale(${1+(Number(p.zoom??1.4)-1)*t})`,transformOrigin:`${p.focusX??50}% ${p.focusY??50}%`,borderRadius:14*scale,boxShadow:'0 24px 80px #0008',background:'#242b29',overflow:'hidden'}}>
   {file?<Img src={staticFile(file)} style={pageStyle}/>:<AbsoluteFill style={{alignItems:'center',justifyContent:'center',color:'#b7c1b6',fontSize:30*scale}}>在右侧选择网页截图</AbsoluteFill>}
   {p.mark!==false&&<div style={{position:'absolute',left:`${Number(p.focusX??50)-Number(p.markWidth??24)/2}%`,top:`${Number(p.focusY??50)-Number(p.markHeight??18)/2}%`,width:`${p.markWidth??24}%`,height:`${p.markHeight??18}%`,border:`${5*scale}px solid ${p.markColor??'#f76968'}`,borderRadius:p.markShape==='box'?8:'50%',opacity:t,transform:`rotate(-5deg) scale(${.9+t*.1})`}}/>}
   </div><div style={{position:'absolute',bottom:'13%',width:'86%',left:'7%',textAlign:'center',fontSize:36*scale,fontWeight:600}}>{title}</div>
  </>}
  {type==='title'&&<AbsoluteFill style={{padding:'10%',justifyContent:'center'}}><div style={{width:50*scale,height:5*scale,background:accent,marginBottom:28*scale}}/><div style={{...heading,opacity:t,transform:`translateY(${(1-t)*50}px)`}}>{title}</div><div style={{fontSize:25*scale,color:ink,opacity:.6,marginTop:28*scale,lineHeight:1.6}}>{sub}</div></AbsoluteFill>}
  {type==='number'&&<AbsoluteFill style={{justifyContent:'center',alignItems:'center',padding:'8%'}}><div style={{fontSize:30*scale,opacity:.7}}>{title}</div><div style={{fontSize:(portrait?145:180)*scale,fontWeight:750,letterSpacing:-8*scale,color:accent,fontVariantNumeric:'tabular-nums',margin:'24px 0'}}>{Math.round(Number(p.value??161150)*t).toLocaleString('en-US')}<span style={{fontSize:38*scale,letterSpacing:0}}>{String(p.unit||'')}</span></div><div style={{fontSize:24*scale,opacity:.7}}>{sub}</div></AbsoluteFill>}
  {type==='compare'&&<><div style={{position:'absolute',left:'8%',top:'8%',...heading,fontSize:48*scale}}>{title}</div><div style={{position:'absolute',inset:'24% 8% 18%',borderRadius:16,overflow:'hidden',background:'#29322d'}}>{file&&<Img src={staticFile(file)} style={pageStyle}/>}<div style={{position:'absolute',inset:0,clipPath:`inset(0 ${100-(15+t*70)}% 0 0)`}}>{file2&&<Img src={staticFile(file2)} style={pageStyle}/>}</div><div style={{position:'absolute',left:`${15+t*70}%`,top:0,bottom:0,width:4,background:accent}}/></div><div style={{position:'absolute',bottom:'9%',left:'8%',right:'8%',display:'flex',justifyContent:'space-between',fontSize:24*scale}}><span>{String(p.beforeLabel||'之前')}</span><span>{String(p.afterLabel||'之后')}</span></div></>}
 </AbsoluteFill>
};
const text=(key:string,label:string,def=''):PropField=>({type:'text',key,label,default:def});
const num=(key:string,label:string,def:number,min:number,max:number,step=1):PropField=>({type:'number',key,label,default:def,min,max,step});
const common:PropField[]=[text('title','标题','每个镜头，由你决定'),{type:'textarea',key:'subtitle',label:'补充说明',default:'选择素材，调整节奏，完成你的作品。'},num('trigger','动作开始（秒）',.4,0,120,.05),num('moveDuration','动作时长（秒）',.8,.05,30,.05),{type:'color',key:'background',label:'背景色',default:'#151918'},{type:'color',key:'ink',label:'文字色',default:'#f1f3ee'},{type:'color',key:'accent',label:'强调色',default:'#d6ee83'}];
const make=(id:string,name:string,mode:string,fields:PropField[]):CardDef=>({id,name,category:'可编辑镜头',durationInFrames:150,width:1080,height:1920,component:(props)=><Manual {...props} mode={mode}/>,schema:[...common,...fields],accent:'#cce588',summary:'内容和动作参数可直接编辑；支持横版与竖版。'});
export const MANUAL_CARDS=[make('manual-web','网页聚焦与圈画','web',[text('file','网页截图'),num('focusX','焦点 X（%）',50,0,100),num('focusY','焦点 Y（%）',50,0,100),num('zoom','放大倍率',1.4,1,4,.05),num('tilt','入场倾斜（°）',-8,-35,35),{type:'boolean',key:'mark',label:'显示重点标注',default:true},{type:'select',key:'markShape',label:'标注形状',default:'circle',options:[{value:'circle',label:'圈画'},{value:'box',label:'矩形'}]},num('markWidth','标注宽度（%）',24,1,100),num('markHeight','标注高度（%）',18,1,100),{type:'color',key:'markColor',label:'标注颜色',default:'#f76968'}]),make('manual-title','简洁标题入场','title',[]),make('manual-number','数字聚焦','number',[num('value','数值',161150,0,1e12),text('unit','单位')]),make('manual-compare','前后对比滑动','compare',[text('file','之前图片'),text('file2','之后图片'),text('beforeLabel','左侧标签','之前'),text('afterLabel','右侧标签','之后')])];
