import ts from 'typescript';
// Reviewed content surfaces in the pinned vendor sources. Line anchors fail closed
// if the upstream layout changes; the original motion containers are retained.
export const PANEL_MEDIA = {
 AxisRescaleShockV2:[[136,'图表卡片图片（替代内置图表）']],OscilloscopeStreamV2:[[115,'波形面板图片（替代内置波形）']],NeedleSweepSelftest:[[132,'仪表面板图片']],TapeScrollFixedPointer:[[105,'读数卡片图片']],ConfettiCrossfire:[[94,'庆祝卡片图片']],CounterTickSparks:[[60,'数字卡片图片']],ParticleSandFill:[[45,'填充卡片图片']],BrakeReticleLock:[[46,'列表条目图片（统一替换）']],ChangelogScrollBrake:[[59,'日志卡片图片（统一替换）']],
 AvatarGridRadialBuildColorize:[[94,'人物卡片（统一替换）']],
 AssembleThenTypeFlyin:[[115,'展示卡片图片']],DashboardGlowHighlightPill:[[196,'仪表盘截图'],[328,'聚焦弹窗图片']],
 GlowOrbAmbient:[[103,'主体图片']],OrbFlylineRelay:[[175,'接力卡片图片（统一替换）']],SheenSweepRetry:[[35,'主角卡图片']],
 RadialRipplePhoneChips:[[87,'手机屏幕截图']],ScanBracketSweep:[[81,'文档截图']],ScanlineAnnotateFocus:[[91,'展示卡片图片']],ScanlineAssembleFlyin:[[118,'展示卡片图片']],
 CornerSpotlightReveal:[[11,'网页截图']],GlowWakeSleepPanel:[[32,'面板截图']],SlideSpotlightPan:[[45,'网页截图']],
 ThemeSweepToggle:[[26,'主题网页（1 浅色 / 2 深色）',2,'(p === LIGHT ? 0 : 1)']],
 StreamResponse:[[96,'响应面板截图']],AutolayoutGapDial:[[116,'布局卡片图片（统一替换）']],DiagramCascadeBuild:[[143,'节点图片（统一替换）']],PanelToCanvasMaterialize:[[47,'来源面板截图'],[190,'画布卡片图片（统一替换）']],
 CursorCastEnsemble:[[86,'便签图片（统一替换）'],[98,'中心面板图片']],
 MagicianCardFlourish:[[36,'翻转卡片图片']],OrbitRingTitleOpen:[[423,'环形画面',8,'i']],
 QuadSplitParallelScenes:[[276,'分屏画面',4,'i']],CardFlockTumble:[[93,'飞散卡片图片（统一替换）']],CubeNavigation:[[113,'立方体面',6,'i']],MosaicReframe:[[65,'拼贴图片（统一替换）']],
 WordRelayFilmstrip:[[234,'页面图片（统一替换）']],
 AvatarBracketCarousel:[[66,'头像图片（统一替换）']],BezierSourceConvergeMerge:[[161,'汇聚内容图片（统一替换）']],
 CardStack:[[40,'扇形卡片',8,'i']],Carousel3D:[[111,'环形卡片',8,'i','carousel'],[112,'环形卡片',8,'i','carousel']],
 DocParkLeftPillDeal:[[160,'文档截图']],DrawSvgTrace:[[77,'描边面板图片']],FloatingGlossyLabelPills:[[274,'陈列面板图片（统一替换）']],
 IntegrationHubMap:[[41,'第一面板截图'],[107,'第二面板截图']],MorphFromPrimitive:[[165,'变形后内容图片']],
 NeonFrameForerun:[[69,'网页截图']],NeonFrameForerunOrbit:[[71,'网页截图']],PlatformHingeRise:[[41,'铰链面板图片（统一替换）']],
 ProductCardProgressiveAssemble:[[72,'产品图片']],ResearchCardStackScroll:[[86,'研究卡片图片（统一替换）']],RunwayGroundSkim:[[56,'滑行页面截图']],SkeletonReveal:[[234,'界面截图']],
 LogoShrinkWordmarkLockup:[[68,'品牌标志图片']],IconFieldColorize:[[82,'图标图片（统一替换）']],
};
export function panelMedia(ast,stem,edits,fields){
 const specs=PANEL_MEDIA[stem];if(!specs)return '';
 const matches=new Set(),added=new Set();
 function visit(n){if(ts.isJsxElement(n)){
 const line=ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1;
 const spec=specs.find(s=>s[0]===line);
 if(spec){
  if(n.openingElement.tagName.getText(ast)!=='div')throw Error(`${stem}:${line} is no longer a div surface`);
  matches.add(line);const [,label,count=1,index,shared]=spec,base='media_panel_'+(shared||line);
  for(let i=0;i<count;i++){const key=count>1?base+'_'+i:base;if(!added.has(key)){added.add(key);fields.unshift({key,type:'text',label:count>1?`${label} ${i+1}`:label,default:''});}}
  const expr=count>1?`${JSON.stringify(base+'_')}+${index}`:JSON.stringify(base);
  const style=n.openingElement.attributes.properties.find(a=>a.name?.getText(ast)==='style')?.initializer?.expression;
  if(style&&ts.isObjectLiteralExpression(style))edits.push([style.getStart(ast)+1,style.getStart(ast)+1,"position:'relative',"]);
  edits.push([n.openingElement.end,n.openingElement.end,`<StudioPanelImage name={${expr}}>`],[n.closingElement.getStart(ast),n.closingElement.getStart(ast),'</StudioPanelImage>']);
 }
 }ts.forEachChild(n,visit)}visit(ast);
 if(matches.size!==specs.length)throw Error('Missing reviewed image surface in '+stem+': '+specs.filter(s=>!matches.has(s[0])).map(s=>s[0]));
 return `const StudioPanelImage = ({name,children}) => __values[name] ? editableElement(EditableImg,{src:editableStaticFile(String(__values[name])),style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}) : children;`;
}
