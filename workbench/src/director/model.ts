export type Word={text:string;start:number;end:number};
export type Beat={cue?:{text:string;at:number};id:string;text:string;start:number;end:number;timing:'estimated'|'aligned'|'manual';cardId:string;evidence:string;focus:string;action:string;rhythm:string;reason:string;locked:boolean;enabled:boolean;props:Record<string,unknown>};
export type Direction={script:string;audioFile:string;duration:number;pauses:number[];peaks:number[];beats:Beat[];method:string;offset:number;appliedVisual?:string;appliedAudio?:string;generatedScript?:string;generatedAudio?:string};
export const emptyDirection=():Direction=>({script:'',audioFile:'',duration:0,pauses:[],peaks:[],beats:[],method:'hyperframes-creative · 本地规则建议',offset:0});
export const normalize=(text:string)=>text.replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
export function sentences(text:string){return (text.match(/[^。！？!?\n]+[。！？!?]?/g)??[]).map(s=>s.trim()).filter(Boolean)}
function recommend(text:string,index:number,total:number){
 const number=text.match(/\d+(?:\.\d+)?\s*(?:%|万|亿|倍|秒|个)?/);
 if(/相比|对比|之前|以前|过去|从.+到/.test(text))return {cardId:'manual-compare',evidence:'同一对象、同一口径的前后截图；分别填写来源，避免不同条件比较。',focus:'前后发生变化的同一位置',action:'先展示原状，再滑动揭示变化；读完差异后停住。',rhythm:'变化揭示后留 0.5 秒阅读',reason:'这句包含前后关系，双图对照比连续装饰转场更清楚。',props:{}};
 if(number)return {cardId:Number.isInteger(Number(number[0].replace(/[^\d.]/g,'')))?'manual-number':'manual-web',evidence:'提供支持「'+number[0]+'」的原始页面、图表或截图，并保留来源与统计口径。',focus:number[0],action:'先呈现证据，再强调这个数值；不要同时让多个数字运动。',rhythm:'关键数值出现后留阅读时间',reason:'数字是这句的主要信息，优先突出它及其出处。',props:{value:Number(number[0].replace(/[^\d.]/g,'')),unit:number[0].replace(/[\d.\s]/g,'')}};
 if(/点击|打开|选择|输入|拖动|界面|网页|功能|按钮|操作/.test(text))return {cardId:'manual-web',evidence:'对应操作的真实页面或结果截图；不要用无关页面替代证据。',focus:'本句所说的控件或操作结果',action:'先建立页面位置，再放大并圈出唯一重点。',rhythm:'操作前短停，结果出现后停留',reason:'操作句需要空间关系，网页聚焦能说明位置与结果。',props:{}};
 if(index===0)return {cardId:'manual-title',evidence:'开场主张的相关主体或结果；需要实证时补充真实截图。',focus:text.slice(0,24),action:'快速建立主题，只强调一个关键词。',rhythm:'开场简短，信息出现后再切',reason:'首句先让观众理解主题，避免多个焦点争抢注意力。',props:{}};
 if(index===total-1)return {cardId:'manual-title',evidence:'使用文案中的结论或下一步，不补写未经提供的承诺。',focus:'本句结论或行动',action:'收束到一个结论，结尾稳定停留。',rhythm:'结尾留 0.5–1 秒阅读',reason:'末句需要收束，避免在最后一个词处立刻切走。',props:{}};
 return {cardId:'manual-web',evidence:'提供能直接说明本句主张的真实图片、页面或图表，并记录来源。',focus:text.slice(0,24),action:'先给全貌，再将视线引向一个证据点。',rhythm:'一句一个主焦点，停顿处切换',reason:'解释句优先给可见证据；素材需要人工确认，本地规则不核实事实。',props:{}};
}
export function generateBeats(text:string,duration:number,pauses:number[],words:Word[]=[]):Beat[]{
 const lines=sentences(text);if(!lines.length||!Number.isFinite(duration)||duration<=0)throw Error('请提供文案和可播放的音频');
 if(lines.length>200)throw Error('一次最多 200 句，请分段制作');
 if(duration/lines.length<.15)throw Error('音频太短，无法为每句分配可用时间');
 const aligned=words.length>0&&normalize(words.map(w=>w.text).join(''))===normalize(text)&&words.every((w,i)=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start>=0&&w.end>w.start&&w.end<=duration+.03&&(!i||w.start>=words[i-1].end));
 const weight=lines.map(s=>Math.max(1,normalize(s).length));const sum=weight.reduce((a,b)=>a+b,0);
 let consumed=0,charOffset=0;const bounds=[0];
 const wordEnds=words.map(w=>{charOffset+=normalize(w.text).length;return {chars:charOffset,start:w.start,end:w.end}});
 for(let i=0;i<lines.length-1;i++){
  consumed+=weight[i];let at=duration*consumed/sum;
  if(aligned){const word=wordEnds.find(w=>w.chars>=consumed);if(word)at=word.end}
  else {const nearby=pauses.filter(p=>Math.abs(p-at)<Math.min(1,duration/lines.length*.3));if(nearby.length)at=nearby.sort((a,b)=>Math.abs(a-at)-Math.abs(b-at))[0]}
  bounds.push(Math.max(bounds[i]+.1,Math.min(duration-(lines.length-i-1)*.1,at)));
 }
 bounds.push(duration);
 return lines.map((line,i)=>{
  const rec=recommend(line,i,lines.length),start=bounds[i],end=bounds[i+1];
  const inSentence=aligned?words.filter(w=>w.start>=start-.001&&w.start<end):[];
  const keyword=line.match(/\d+(?:\.\d+)?|点击|打开|选择|输入|拖动/)?.[0];
  const cue=(keyword?inSentence.find(w=>normalize(w.text).includes(normalize(keyword))):null)??inSentence[0];
  return {id:'beat-'+i+'-'+Date.now().toString(36),text:line,start:+start.toFixed(3),end:+end.toFixed(3),timing:aligned?'aligned':'estimated',...(cue?{cue:{text:cue.text,at:cue.start}}:{}),...rec,locked:false,enabled:true,
   props:{title:line,subtitle:'',trigger:cue?Math.max(0,cue.start-start):Math.min(.25,(end-start)*.1),moveDuration:Math.min(.8,(end-start)*.35),...rec.props}};
 });
}
export function validateBeats(beats:Beat[],duration:number){
 let end=0;for(const beat of beats.filter(b=>b.enabled)){
  if(!Number.isFinite(beat.start)||!Number.isFinite(beat.end)||beat.start<0||beat.end<=beat.start||beat.end>duration+.03)throw Error('逐句时间需在音频范围内，结束必须晚于开始');
  if(beat.start<end-.001)throw Error('句子时间存在重叠，请调整后再应用');end=beat.end;
 }if(!beats.some(b=>b.enabled))throw Error('请至少勾选一句');
}
