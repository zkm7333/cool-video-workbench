import type {ClipData,ProjectData} from '../types';
import {uid} from '../types';
import {CARDS} from '../cards/registry';
import type {Beat,Direction} from './model';
import {validateBeats} from './model';
export function beatClip(beat:Beat,fps:number,offset=0):ClipData{
 const card=CARDS[beat.cardId];if(!card||card.kind==='audio')throw Error('请选择有效画面镜头');
 const start=Math.round((offset+beat.start)*fps),end=Math.round((offset+beat.end)*fps);
 if(end<=start)throw Error('镜头不足一帧，请调整时间');
 return {id:uid('directed'),cardId:card.id,start,duration:end-start,inOffset:0,speed:card.timing==='realtime'?1:(card.sourceFps??30)/fps,opacity:1,scale:1,x:0,y:0,props:{...beat.props},label:beat.text};
}
export function applyDirection(project:ProjectData,d:Direction):ProjectData{
 validateBeats(d.beats,d.duration);
 if(!Number.isFinite(d.offset)||d.offset<0)throw Error('时间线起点不能小于 0');
 if(d.generatedScript!==d.script||d.generatedAudio!==d.audioFile)throw Error('文案或音频已更改，请重新生成建议');
 const visual=d.appliedVisual??uid('director-track'),audio=d.appliedAudio??uid('director-audio');
 const frames=Math.max(1,Math.round(d.duration*project.fps));
 const tracks=project.tracks.filter(t=>t.id!==visual&&t.id!==audio);
 return {...project,visual_direction:{...d,appliedVisual:visual,appliedAudio:audio},tracks:[
 {id:visual,name:'逐句导演 · 画面',clips:d.beats.filter(b=>b.enabled).map(b=>beatClip(b,project.fps,d.offset))},
 {id:audio,name:'逐句导演 · 配音',clips:[{id:uid('directed-audio'),cardId:'audio-clip',start:Math.round(d.offset*project.fps),duration:frames,inOffset:0,speed:1,opacity:1,scale:1,x:0,y:0,props:{file:d.audioFile,volume:1},label:'导演配音'}]},...tracks]};
}
