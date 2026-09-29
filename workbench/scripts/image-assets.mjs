import ts from 'typescript';
export function imageAssets(ast,stem,edits,fields){
 // Dedicated adapters own cropping and multi-layer sources in these cards.
 if(fields.some(f=>f.key.startsWith('media_'))||stem==='Fracture')return '';
 const added=[],keys=new Map();let serial=0;
 const slot=(identity,label)=>{if(keys.has(identity))return keys.get(identity);const key='media_asset_'+serial++;keys.set(identity,key);added.push({key,type:'text',label,default:''});return key};
 const replace=(n,s)=>{for(let i=edits.length-1;i>=0;i--)if(edits[i][0]>=n.getStart(ast)&&edits[i][1]<=n.end)edits.splice(i,1);edits.push([n.getStart(ast),n.end,s])};
 function visit(n){
  if(ts.isCallExpression(n)&&n.expression.getText(ast)==='staticFile'&&n.arguments.length){
   const arg=n.arguments[0],text=arg.getText(ast);
   if(/\.(png|jpe?g|webp|gif|svg)/i.test(text)||(/textures\//.test(text)&&ts.isTemplateExpression(arg))){
    const key=slot(ts.isStringLiteral(arg)?arg.text:text,ts.isTemplateExpression(arg)?'图片组（统一替换）':'图片 · '+(arg.text||'').split('/').pop());
    replace(arg,`(__values[${JSON.stringify(key)}] || ${text})`);return;
   }
  }
  if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&['PageCam2D','Img','img'].includes(n.tagName.getText(ast))){
   const a=n.attributes.properties.find(a=>a.name?.getText(ast)==='src');
   if(a?.initializer&&ts.isStringLiteral(a.initializer)){
    const value=a.initializer.text,key=slot(value,n.tagName.getText(ast)==='PageCam2D'?'网页截图':'图片来源');
    replace(a.initializer,`{__values[${JSON.stringify(key)}] ? editableStaticFile(String(__values[${JSON.stringify(key)}])) : ${JSON.stringify(value)}}`);
    // PageCam2D calls staticFile itself; keep its replacement path relative.
    if(n.tagName.getText(ast)==='PageCam2D')edits[edits.length-1][2]=`{String(__values[${JSON.stringify(key)}] || ${JSON.stringify(value)})}`;
    for(let i=fields.length-1;i>=0;i--)if(fields[i].default===value)fields.splice(i,1);
   }
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);fields.unshift(...added);return '';
}
