import ts from 'typescript';
// Explicit placement rules keep each camera rig and its original animated parent intact.
export function cameraMedia(ast,stem,edits,fields){
 const camera=new Set(['Basic3DScene','CrashImpactReal','CrashZoomReal','CursorFlyover','DollyZoomReal','MultiplaneReal','GrazeFaceTour','OverheadTabletopDrop','TiltReveal','DroneDiveLanding','ExplodedView','SteepTiltGlide','BulletTimeFreezeOrbit','DutchRollToLevel','PullBackIsolation','SlowPushIn','Terminal3D']);
 if(!camera.has(stem))return '';
 const media=[];let serial=0;const used=new Set();
 const add=(key,label)=>{if(!media.some(f=>f.key===key))media.push({key,type:'text',label,default:''});return JSON.stringify(key)};
 const group=(prefix,label,count,index)=>{for(let i=0;i<count;i++)add(prefix+i,`${label} ${i+1}`);return `${JSON.stringify(prefix)}+${index}`};
 const wrap=(n,expr)=>{const style=n.openingElement.attributes.properties.find(a=>a.name?.getText(ast)==='style')?.initializer?.expression;if(style&&ts.isObjectLiteralExpression(style))edits.push([style.getStart(ast)+1,style.getStart(ast)+1,"position:'relative',"]);edits.push([n.openingElement.end,n.openingElement.end,`<StudioSurface name={${expr}}>`],[n.closingElement.getStart(ast),n.closingElement.getStart(ast),'</StudioSurface>']);};
 function owner(n){for(let p=n.parent;p;p=p.parent)if(ts.isVariableDeclaration(p))return p.name.getText(ast);return '';}
 function visit(n){
  if(ts.isJsxSelfClosingElement(n)&&['FakeDashboard','Card'].includes(n.tagName.getText(ast))&&stem!=='ExplodedView'){
   const tag=n.tagName.getText(ast),text=n.getText(ast);let key;
   if(stem==='PullBackIsolation'&&text.includes('s.w'))key=group('media_sibling_','周围卡片',8,'i');
   else key=add('media_fixture_'+serial++,tag==='Card'?'卡片图片':'网页截图 '+serial);
   edits.push([n.tagName.end,n.tagName.end,` studioSlot={${key}}`]);
  }
  if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='Img'){
   const attr=n.attributes.properties.find(a=>a.name?.getText(ast)==='src');
   const call=attr?.initializer?.expression;
   if(call&&ts.isCallExpression(call)&&call.expression.getText(ast)==='staticFile'){
    const arg=call.arguments[0];let key;
    if(ts.isTemplateExpression(arg))key=group('media_depth_','中景卡片',stem==='DollyZoomReal'?8:6,'k');
    else key=add('media_image_'+serial++,'图片 '+serial+' · '+arg.text.split('/').pop());
    // This expression owns the whole argument, so discard generic edits within it.
    for(let i=edits.length-1;i>=0;i--)if(edits[i][0]>=arg.getStart(ast)&&edits[i][1]<=arg.end)edits.splice(i,1);
    edits.push([arg.getStart(ast),arg.end,`(__values[${key}] || ${arg.getText(ast)})`]);
   }
  }
  if(ts.isJsxElement(n)){
   const tag=n.openingElement.tagName.getText(ast),head=n.openingElement.getText(ast);let key;
   if(stem==='SlowPushIn'&&head.includes('transform: `scale(${scale})`'))key=add('media_subject','慢推主体图片');
   if(stem==='PullBackIsolation'&&head.includes('width: 520')&&head.includes('height: 340'))key=add('media_fixture_0','主卡图片');
   if(stem==='CursorFlyover'&&head.includes("width: '92%'")&&head.includes("height: '90%'"))key=add('media_page','整页截图（优先于区域图片）');
   if(stem==='Basic3DScene'&&head.includes('last ? 320'))key=group('media_step_','空间画面',4,'i');
   if(stem==='Terminal3D'&&head.includes('width: 300 * K'))key=group('media_terminal_','终端窗口图片',3,'i');
   if(stem==='CursorFlyover'&&tag==='Quad')key=add('media_quad_'+serial++,'区域图片 '+serial);
   if(stem==='BulletTimeFreezeOrbit'&&head.includes('width: PANEL_W')&&head.includes('transform:'))key=add('media_panel','环绕主体图片');
   if(stem==='SteepTiltGlide'&&head.includes('width: PW, height: PH'))key=add('media_panel','透视页面图片');
   if(stem==='GrazeFaceTour'&&['SceneTree','SceneTopNav','SceneListRows'].includes(owner(n))&&!used.has(owner(n))){used.add(owner(n));key=add('media_'+owner(n),{SceneTree:'第一段页面',SceneTopNav:'第二段页面',SceneListRows:'第三段页面'}[owner(n)]);}
   if(stem==='ExplodedView'&&head.includes('key={L.key}')){
    for(const [k,l] of [['top','顶栏图片'],['side','侧栏图片'],...Array.from({length:6},(_,i)=>['card'+i,'卡片图片 '+(i+1)])])add('media_layer_'+k,l);
    key='"media_layer_"+L.key';
   }
   if(key)wrap(n,key);
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);
 if(!media.length)throw Error('Camera has no media adapter: '+stem);
 fields.unshift(...media);
 return `const StudioSurface = ({name,children}) => __values[name] ? editableElement(EditableImg,{src:editableStaticFile(String(__values[name])),style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}) : children;`;
}
