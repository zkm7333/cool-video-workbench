import ts from 'typescript';
import {readFileSync} from 'node:fs';
export function spotlightMedia(ast,stem,edits,fields){
 if(stem!=='SpotlightHeroCard')return '';
 const layout=JSON.parse(readFileSync(new URL('../../demos/_textures/live-layout.json',import.meta.url),'utf8'));
 const card=layout.projects.cards[3];
 for(let i=fields.length-1;i>=0;i--)if(fields[i].default==='textures/live/projects-full.png')fields.splice(i,1);
 fields.unshift(
 {key:'media_page',type:'text',label:'背景网页截图（同时替换主角卡）',default:''},
 {key:'media_hero',type:'text',label:'主角卡独立图片（可选）',default:''},
 ...[['pageHeight','网页画布高度',layout.projects.pageH,1080,20000],['heroX','主角区域 X',card.x,0,1920],['heroY','主角区域 Y',card.y,0,20000],['heroW','主角区域宽度',card.w,20,1920],['heroH','主角区域高度',card.h,20,10000]].map(([key,label,value,min,max])=>({key,type:'number',label,default:value,min,max,step:1}))
 );
 const replace=(n,value)=>{for(let i=edits.length-1;i>=0;i--)if(edits[i][0]>=n.getStart(ast)&&edits[i][1]<=n.end)edits.splice(i,1);edits.push([n.getStart(ast),n.end,value]);};
 function visit(n){
  if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='PAGE_H')replace(n.initializer,'Math.max(1080,Number(__values.pageHeight || layout.projects.pageH))');
  if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='CARD')replace(n.initializer,`({...layout.projects.cards[MAIN],x:Number(__values.heroX ?? ${card.x}),y:Number(__values.heroY ?? ${card.y}),w:Math.max(20,Number(__values.heroW ?? ${card.w})),h:Math.max(20,Number(__values.heroH ?? ${card.h}))})`);
  if(ts.isJsxOpeningElement(n)&&n.tagName.getText(ast)==='PageCam2D'){
   const src=n.attributes.properties.find(a=>a.name?.getText(ast)==='src');
   replace(src.initializer,'{String(__values.media_page || "textures/live/projects-full.png")}');
  }
  if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='Img')replace(n.tagName,'StudioHeroImage');
  ts.forEachChild(n,visit);
 }
 visit(ast);
 return `const StudioHeroImage = (p) => {
  if(__values.media_hero)return editableElement(EditableImg,{...p,src:editableStaticFile(String(__values.media_hero)),style:{...p.style,objectFit:'cover'}});
  if(__values.media_page)return editableElement(EditableImg,{...p,src:editableStaticFile(String(__values.media_page)),style:{...p.style,inset:'auto',left:-CARD.x,top:-CARD.y,width:1920,height:PAGE_H,maxWidth:'none'}});
  return editableElement(EditableImg,p);
 };`;
}
