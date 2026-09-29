import ts from 'typescript';import fs from 'node:fs';import path from 'node:path';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const paths=walk('../demos');
const records=fs.readFileSync('src/cards/demo-index.ts','utf8').split('\n').filter(l=>l.includes('schema: [')).map(l=>({stem:l.match(/stem: "([^"]+)"/)[1],schema:JSON.parse(l.slice(l.indexOf('schema: ')+8,l.indexOf(', stem:')))}));
const result=[];
for(const r of records){if(r.schema.some(f=>/^(file2?$|media_)/.test(f.key)))continue;
 const file=paths.find(p=>p.endsWith('/'+r.stem+'.tsx')),src=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,src,99,true,4);const candidates=[];
 function visit(n){if(ts.isJsxElement(n)){
 const style=n.openingElement.attributes.properties.find(a=>a.name?.getText(ast)==='style')?.initializer?.expression;
 if(style&&ts.isObjectLiteralExpression(style)){
  const get=k=>style.properties.find(p=>p.name?.getText(ast)===k)?.initializer?.getText(ast);
  const w=get('width'),h=get('height');
  if(w&&h&&!['0','1','2','3','4','5','6','8','10','12','14','16','18','20','24','26','28','30','32','36','40','48','50'].includes(w)&&!['0','1','2','3','4','5','6','8','10','12','14','16','18','20','24','26','28','30','32','36','40','48','50'].includes(h))candidates.push({line:ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1,w,h,tag:n.openingElement.tagName.getText(ast),transform:get('transform'),bg:get('background')?.slice(0,45)});
 }
 }ts.forEachChild(n,visit)}visit(ast);
 result.push({stem:r.stem,file,candidates});
}
fs.writeFileSync('/private/tmp/surface-audit.json',JSON.stringify(result,null,2));
for(const r of result)if(r.candidates.length)console.log(r.stem,JSON.stringify(r.candidates));
