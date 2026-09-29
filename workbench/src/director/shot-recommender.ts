/** Director-facing catalog data. Recommendations use actual registered cards and their editable slots. */
export type ShotInfo={id:string;name:string;category:string;summary:string;mediaSlots:number;duration:number;editableFields:number};
export type ShotChoice={cardId:string;score:number;reason:string;needsEvidence:boolean};
export type ShotRole='compare'|'number'|'interaction'|'opening'|'closing'|'collection'|'explain';
export function shotRole(text:string,index:number,total:number):ShotRole{
 if(/相比|对比|之前|以前|过去|从.+到|变化前|变化后/.test(text))return 'compare';
 if(/\d+(?:\.\d+)?\s*(?:%|万|亿|倍|秒|个)?/.test(text))return 'number';
 if(/点击|打开|选择|输入|拖动|滑动|搜索|筛选|按钮|操作|鼠标|光标/.test(text))return 'interaction';
 if(index===0)return 'opening';
 if(index===total-1||/最后|总结|现在开始|立即体验|马上/.test(text))return 'closing';
 if(/列表|文档|报告|论文|页面|多个|集合|卡片/.test(text))return 'collection';
 return 'explain';
}
const profiles:Record<ShotRole,{preferred:string[];categories:string[];hint:string;needsEvidence:boolean}>={
 opening:{preferred:['demo:SpotlightHeroCard','demo:BrandFrameSnap','demo:CraneRiseReveal','demo:OrbitRingTitleOpen','manual-title'],categories:['开场与品牌','界面登场与陈列'],hint:'以主体出场建立主题，落定后留阅读时间',needsEvidence:true},
 interaction:{preferred:['demo:CursorFlyover','demo:CursorPerformancePunchIn','demo:CommandPaletteSummon','demo:TypeAndFilter','demo:ScanlineAnnotateFocus','manual-web'],categories:['交互与功能演示','运镜与空间'],hint:'让真实操作界面和鼠标落点成为视觉证据',needsEvidence:true},
 compare:{preferred:['demo:BeforeAfterSliderScrub','demo:ThemeSweepToggle','demo:PanelToCanvasMaterialize','manual-compare'],categories:['数据与指标','交互与功能演示'],hint:'让同口径的前后状态按动作顺序出现',needsEvidence:true},
 number:{preferred:['demo:BrakeReticleLock','demo:ScanlineAnnotateFocus','demo:AxisRescaleShockV2','demo:CounterTickSparks','manual-number'],categories:['数据与指标','光效与强调'],hint:'展示数值来源后只强调一个关键数值',needsEvidence:true},
 collection:{preferred:['demo:ResearchCardStackScroll','demo:PageWaterfallWall','demo:CardStack','demo:DeckDealFlyin','demo:ListStackPress'],categories:['界面登场与陈列','运镜与空间'],hint:'按信息层级依次陈列，避免一屏同时竞争',needsEvidence:true},
 explain:{preferred:['demo:ScanlineAnnotateFocus','demo:SlowPushIn','demo:GrazeFaceTour','demo:PageWaterfallWall','demo:SpotlightHeroCard','manual-web'],categories:['运镜与空间','界面登场与陈列','光效与强调'],hint:'先给全貌，再聚焦与本句对应的证据',needsEvidence:true},
 closing:{preferred:['demo:LogoShrinkWordmarkLockup','demo:LogoStingButton','demo:OutroGroupPhotoLaunch','demo:BrandFrameSnap','manual-title'],categories:['收尾','开场与品牌'],hint:'收束到结论或标志，结尾保持稳定',needsEvidence:false},
};
export function rankShots(text:string,index:number,total:number,seconds:number,catalog:ShotInfo[],used:string[]=[]):ShotChoice[]{
 const role=shotRole(text,index,total),profile=profiles[role];
 const last=used[used.length-1],lastCategory=catalog.find(c=>c.id===last)?.category;
 return catalog.filter(c=>c.id!=='audio-clip'&&c.category!=='音频').map(card=>{
  const preferred=profile.preferred.indexOf(card.id),hasMedia=card.mediaSlots>0;
  let score=preferred>=0?115-preferred*9:profile.categories.includes(card.category)?34-profile.categories.indexOf(card.category)*5:0;
  if(card.id.startsWith('demo:'))score+=8;
  if(profile.needsEvidence)score+=hasMedia?14:-90;
  if(card.editableFields>0)score+=Math.min(10,card.editableFields);
  if(card.mediaSlots>3)score-=Math.min(22,(card.mediaSlots-3)*3);
  if(card.duration>seconds*2.4)score-=14;
  if(card.duration<seconds*.45)score-=8;
  if(used.includes(card.id))score-=95;
  if(card.category===lastCategory)score-=9;
  if(card.category==='转场'&&role!=='closing')score-=45;
  if(card.id==='image-clip'||card.id==='video-clip')score-=100;
  const reason=`${profile.hint}；${card.name}（${card.category}）提供${hasMedia?'可替换画面位置':'文字或图形动效'}。${hasMedia?'需放入本项目真实素材并预览。':''}`;
  return {cardId:card.id,score,reason,needsEvidence:profile.needsEvidence&&hasMedia};
 }).sort((a,b)=>b.score-a.score||a.cardId.localeCompare(b.cardId));
}
