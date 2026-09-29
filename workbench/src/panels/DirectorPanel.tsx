import React,{useEffect,useRef,useState} from 'react';
import {Player} from '@remotion/player';
import {useStore} from '../store';
import {api,notify} from '../desktop-api';
import {CARDS,CARD_LIST} from '../cards/registry';
import {rankShots,type ShotInfo} from '../director/shot-recommender';
import {ShotPicker} from './ShotPicker';
import {AssetPicker} from './AssetPicker';
import {PropControl} from './Inspector';
import {Modal} from '../ui/Modal';
import {MainComposition} from '../preview/Composition';
import {analyzeAudio} from '../director/audio';
import {applyDirection,beatClip} from '../director/apply';
import {emptyDirection,generateBeats,type Beat,type Direction} from '../director/model';

const studioShotCards=CARD_LIST.filter(c=>c.kind!=='audio'&&!['成片单元','音频','素材','背景'].includes(c.category));
const shotCatalog:ShotInfo[]=studioShotCards.map(c=>({id:c.id,name:c.name,category:c.category,summary:c.summary??'',mediaSlots:c.schema.filter(f=>f.key==='file'||f.key==='file2'||f.key.startsWith('media_')).length,duration:c.durationInFrames/(c.sourceFps??30),editableFields:c.schema.length}));
function propsForShot(beat:Beat,cardId:string){
 const base={title:beat.text,subtitle:'',trigger:beat.cue?Math.max(0,beat.cue.at-beat.start):Math.min(.25,(beat.end-beat.start)*.1),moveDuration:Math.min(.8,(beat.end-beat.start)*.35)};
 return cardId==='manual-number'?{...base,...Object.fromEntries(Object.entries(beat.props).filter(([k])=>k==='value'||k==='unit'))}:base;
}
export const DirectorPanel:React.FC<{onEdit:()=>void;onVoice:()=>void}>=({onEdit,onVoice})=>{
 const project=useStore(s=>s.project),d=project.visual_direction??emptyDirection();
 const [shotFor,setShotFor]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<string|null>(null),[alignment,setAlignment]=useState('');
 const audio=useRef<HTMLAudioElement>(null),stopAt=useRef<number|null>(null);
 useEffect(()=>()=>{audio.current?.pause()},[]);
 const patch=(value:Partial<Direction>)=>{const s=useStore.getState();s.setProject({...s.project,visual_direction:{...(s.project.visual_direction??emptyDirection()),...value}})};
 const edit=(id:string,value:Partial<Beat>)=>{const current=useStore.getState().project.visual_direction??emptyDirection();patch({beats:current.beats.map(b=>b.id===id?{...b,...value}:b)})};
 const generate=async()=>{setBusy(true);setError('');const script=d.script,file=d.audioFile;try{
  const analysis=await analyzeAudio(file);const current=useStore.getState().project;
  if(current.visual_direction?.script!==script||current.visual_direction?.audioFile!==file)throw Error('输入已变化，请重新生成');
  const result=current.voiceResult;
  const beats=generateBeats(script,analysis.duration,analysis.pauses,result?.verified&&result.file===file?result.words:[]);
  const used:string[]=[];
  for(let i=0;i<beats.length;i++){
   if(d.beats[i]?.locked){if(beats[i].text!==d.beats[i].text)throw Error('文案变化影响已锁定句子，请先解锁这些句子');beats[i]=d.beats[i]}
   else {const choice=rankShots(beats[i].text,i,beats.length,beats[i].end-beats[i].start,shotCatalog,used)[0];if(choice){beats[i].cardId=choice.cardId;beats[i].reason=choice.reason;beats[i].props=propsForShot(beats[i],choice.cardId)}}
   used.push(beats[i].cardId);
  }
  patch({...analysis,beats,generatedScript:script,generatedAudio:file});notify('逐句建议已生成，可试听校时后应用');
 }catch(e){setError(String(e))}finally{setBusy(false)}};
 const listen=(b:Beat)=>{if(!audio.current)return;audio.current.currentTime=b.start;stopAt.current=b.end;void audio.current.play().catch(e=>setError(String(e)))};
 const previewBeat=d.beats.find(b=>b.id===preview);
 const playablePreview=previewBeat&&Number.isFinite(previewBeat.start)&&Number.isFinite(previewBeat.end)&&(previewBeat.end-previewBeat.start)*project.fps>=1;
 const visualCards=studioShotCards;
 const selectedForShot=d.beats.find(b=>b.id===shotFor);
 return <section className="director-panel"><header className="director-heading"><div><h1>逐句导演</h1><p>让文案、声音和画面一起决定节奏</p></div><button className="btn" onClick={onEdit}>进入视频剪辑</button></header>
 <div className="director-inputs"><div><label className="director-label">口播文案<textarea aria-label="导演文案" rows={7} disabled={busy} value={d.script} onChange={e=>patch({script:e.target.value})} placeholder="粘贴最终口播文案。按句号、问号、感叹号或换行拆句。"/></label><button className="btn" disabled={busy||!project.voiceDraft?.text} onClick={()=>patch({script:project.voiceDraft!.text})}>使用配音页文案</button></div><div><b>配音音频</b><button className="btn primary" disabled={busy} onClick={()=>{const s=useStore.getState();if(d.script.trim())s.setProject({...s.project,voiceDraft:{...(s.project.voiceDraft??{speaker:'zh_male_liufei_uranus_bigtts',rate:0,text:''}),text:d.script}});onVoice()}}>用豆包生成配音</button><AssetPicker label="导演音频" value={d.audioFile} kind="audio" onBegin={()=>{}} onChange={file=>{audio.current?.pause();patch({audioFile:String(file),duration:0,beats:[],peaks:[],pauses:[]})}}/>{d.audioFile&&<audio ref={audio} src={'/'+d.audioFile} controls onTimeUpdate={()=>{if(stopAt.current!==null&&audio.current&&audio.current.currentTime>=stopAt.current){audio.current.pause();stopAt.current=null}}}/>}<button className="btn" disabled={!project.voiceResult?.file||busy} onClick={()=>patch({audioFile:project.voiceResult.file,script:d.script||project.voiceResult.text,beats:[],duration:0,pauses:[],peaks:[]})}>使用最近生成的配音</button></div></div>
 <div className="director-method"><b>hyperframes-creative 导演方法 · 本地规则建议</b><p>按句意、真实素材位置、镜头时长与重复使用情况从完整镜头库推荐；每句保留单一焦点，并结合音频时长与停顿推荐切点。这不是语音识别或自动事实核验，不会凭音量判断语义重音。没有匹配的已校验词时间时，时间均为估算，请逐句试听调整。</p></div>
 <details className="director-alignment"><summary>导入音频对应的词时间 JSON</summary><p>需包含 provider、audioSha256 和 words（text/start/end）。通过音频哈希及时间范围校验后，还需文案与词序列匹配才用于逐句对齐。</p><textarea aria-label="导演词时间 JSON" rows={4} value={alignment} onChange={e=>setAlignment(e.target.value)}/><button className="btn" disabled={!d.audioFile||busy} onClick={async()=>{try{setBusy(true);setError('');const r=await api('alignment',{file:d.audioFile,alignment:JSON.parse(alignment)});const s=useStore.getState();s.setProject({...s.project,voiceResult:r});notify('词时间校验通过，请生成或更新建议')}catch(e){setError(String(e))}finally{setBusy(false)}}}>校验词时间</button></details>
 <div className="director-toolbar"><button className="btn primary" disabled={busy||!d.script.trim()||!d.audioFile} onClick={generate}>{busy?'正在分析音频…':d.beats.length?'更新未锁定的建议':'生成逐句导演建议'}</button>{d.beats.length>0&&<><button className="btn" onClick={()=>patch({beats:d.beats.map((b,i)=>i<3?{...b,locked:true}:b)})}>锁定前三镜建议</button><span>{d.beats.length} 句 · {d.duration.toFixed(2)} 秒 · {d.pauses.length} 处停顿</span></>}</div>
 {error&&<p role="alert" className="asset-picker-error">{error}</p>}
 {d.peaks.length>0&&<div className="director-wave" aria-label="音频能量概览">{d.peaks.map((p,i)=><i key={i} style={{height:Math.max(3,p*42)}}/>)}<span>音量概览 · 不是逐词对齐</span></div>}
 <div className="director-beats">{d.beats.map((b,i)=><article key={b.id} className={'director-beat'+(b.locked?' locked':'')}><div className="director-beat-heading"><label><input aria-label={`采用第${i+1}句`} type="checkbox" checked={b.enabled} onChange={e=>edit(b.id,{enabled:e.target.checked})}/>镜头 {i+1}</label><span className={'timing-badge '+b.timing}>{b.timing==='aligned'?'来自已校验词时间':b.timing==='manual'?'手动校时':'停顿辅助估算'}</span><button className="btn" onClick={()=>listen(b)}>试听本句</button><button className="btn" onClick={()=>setPreview(b.id)}>预览镜头</button><button className="btn" onClick={()=>edit(b.id,{locked:!b.locked})}>{b.locked?'解锁':'锁定'}</button></div>
 <p className="director-sentence">{b.text}</p><fieldset disabled={b.locked||busy}><div className="director-times"><label>开始（秒）<input aria-label={`第${i+1}句开始`} type="number" step="0.01" min="0" value={b.start} onChange={e=>edit(b.id,{start:Number(e.target.value),timing:'manual'})}/></label><label>结束（秒）<input aria-label={`第${i+1}句结束`} type="number" step="0.01" min="0" value={b.end} onChange={e=>edit(b.id,{end:Number(e.target.value),timing:'manual'})}/></label><span>{(b.end-b.start).toFixed(2)} 秒{b.end-b.start<1?' · 偏短，建议合句或简化动作':b.end-b.start>8?' · 偏长，建议增加证据或拆句':''}</span><label>镜头模板<select aria-label={`第${i+1}句镜头`} value={b.cardId} onChange={e=>edit(b.id,{cardId:e.target.value,props:propsForShot(b,e.target.value),reason:`手动选择 ${CARDS[e.target.value]?.name}；请核对动作、素材和时长。`})}>{visualCards.map(c=><option key={c.id} value={c.id}>{c.name} · {c.category}</option>)}</select></label><button className="btn" onClick={()=>setShotFor(b.id)}>浏览全部镜头</button></div>
 {shotCatalog.find(c=>c.id===b.cardId)?.mediaSlots&&<p className="director-evidence-hint">此模板有可替换的画面位置。展开下方参数，填入真实图片或网页截图，并预览确认。</p>}
 <div className="director-notes">{(['evidence','focus','action','rhythm'] as const).map((key,k)=><label key={key}>{['画面证据 / 来源','观众焦点','动作安排','节奏与切换建议'][k]}<textarea aria-label={`第${i+1}句${key}`} rows={2} value={b[key]} onChange={e=>edit(b.id,{[key]:e.target.value})}/></label>)}</div><p className="director-reason">推荐理由：{b.reason}{b.cue&&<> · 对齐词参考「{b.cue.text}」在音频 {b.cue.at.toFixed(2)} 秒，生成时已用于动作开始参数。</>}</p>
 <details><summary>替换镜头素材与动作参数</summary><div className="director-props">{CARDS[b.cardId]?.schema.map(field=><label key={field.key} className="director-prop"><span>{field.label}</span><PropControl field={field} mediaKind={CARDS[b.cardId]?.kind==='video'?'video':'image'} value={b.props[field.key]??field.default} onBegin={()=>{}} onChange={v=>edit(b.id,{props:{...b.props,[field.key]:v}})}/></label>)}</div></details></fieldset></article>)}</div>
 {d.beats.length>0&&<footer className="director-apply"><label>放入时间线的起点（秒）<input aria-label="导演时间线起点" type="number" min="0" step="0.1" value={d.offset} onChange={e=>patch({offset:Number(e.target.value)})}/></label><p>应用勾选句的模板、素材、动作参数和时间，加入独立「逐句导演」画面及配音轨。重复应用会更新这两条轨道，其他轨道保留；同时间的画面会叠加，声音会混音。文字导演建议留作参考，不会自动生成缺失素材或执行转场。可在剪辑页一步撤销。</p><button className="btn primary" disabled={busy} onClick={()=>{try{const s=useStore.getState();s.setProject(applyDirection(s.project,d));notify('导演方案已应用到时间线');onEdit()}catch(e){setError(String(e))}}}>应用勾选镜头与配音到时间线</button></footer>}
 {selectedForShot&&<ShotPicker beat={selectedForShot} index={d.beats.indexOf(selectedForShot)} total={d.beats.length} catalog={shotCatalog} used={d.beats.filter(b=>b.id!==selectedForShot.id).map(b=>b.cardId)} onClose={()=>setShotFor(null)} onChoose={id=>{edit(selectedForShot.id,{cardId:id,props:propsForShot(selectedForShot,id),reason:`手动选择 ${CARDS[id]?.name}；请核对动作、素材和时长。`});setShotFor(null)}}/>}
 {previewBeat&&<Modal label="导演镜头预览" className="director-preview-dialog" onClose={()=>setPreview(null)}><div className="dialog-heading"><b>镜头预览 · {previewBeat.text}</b><button className="btn" onClick={()=>setPreview(null)}>关闭预览</button></div>{playablePreview&&<Player component={MainComposition} inputProps={{project:{...project,tracks:[{id:'preview',name:'预览',clips:[beatClip({...previewBeat,start:0,end:previewBeat.end-previewBeat.start},project.fps)]}]}}} durationInFrames={Math.max(1,Math.round((previewBeat.end-previewBeat.start)*project.fps))} compositionWidth={project.width} compositionHeight={project.height} fps={project.fps} controls loop style={{height:'60vh',maxWidth:'100%',margin:'auto'}}/>}<p className="panel-help">这里只预览画面；用「试听本句」检查音频时间，应用后在时间线合成预览。</p></Modal>}
 </section>;
};
