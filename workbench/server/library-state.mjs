import fs from 'node:fs';
import path from 'node:path';
export function createLibraryState(data,root){
 const file=path.join(data,'library-state.json');
 const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{assets:{},projects:{}};
 const write=s=>{fs.writeFileSync(file+'.tmp',JSON.stringify(s,null,2));fs.renameSync(file+'.tmp',file)};
 return {
  read,
  trash:()=>{const s=read();return ['assets','projects'].flatMap(type=>Object.entries(s[type]).filter(([,v])=>!v.purged).map(([id,v])=>({type,id,...v}))).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt))},
  remove:(type,id,name)=>{
   if(!['assets','projects'].includes(type)||typeof id!=='string')throw Error('无效删除项');
   if(type==='projects'){if(!/^[a-f0-9]{20}$/.test(id)||!fs.existsSync(path.join(data,'projects',id+'.json')))throw Error('作品不存在')}
   else {const base=id.startsWith('uploads/')?data:path.join(root,'public');const target=path.resolve(base,id);if(!target.startsWith(path.resolve(base)+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())throw Error('素材不存在')}
   const s=read();s[type][id]={name:String(name||id).slice(0,200),deletedAt:new Date().toISOString()};write(s);return {ok:true};
  },
  purge:(type,id,currentProject,forceReferenced=false)=>{
   if(!['assets','projects'].includes(type)||typeof id!=='string')throw Error('无效删除项');
   const s=read();if(!s[type][id]||s[type][id].purged)throw Error('该项目不在回收站');
   let target;
   if(type==='projects'){
    if(!/^[a-f0-9]{20}$/.test(id))throw Error('无效作品');
    target=path.join(data,'projects',id+'.json');
   }else{
    const references=value=>{
     if(typeof value==='string')return value===id||value==='/'+id;
     if(!value||typeof value!=='object')return false;
     return Object.values(value).some(references);
    };
    const projectDir=path.join(data,'projects');
    const projects=fs.readdirSync(projectDir).filter(n=>/^[a-f0-9]{20}\.json$/.test(n)).map(n=>path.join(projectDir,n));
    const autosave=path.join(data,'autosave.json');if(fs.existsSync(autosave))projects.push(autosave);
    if(!forceReferenced&&(references(currentProject)||projects.some(p=>references(JSON.parse(fs.readFileSync(p,'utf8'))))))throw Error('素材仍被工程使用，请先移除工程中的引用，或彻底删除对应作品');
    // Bundled assets remain on disk to preserve the signed app, but stay hidden permanently.
    if(!id.startsWith('uploads/')){s.assets[id].purged=true;write(s);return {ok:true,bundled:true};}
    if(path.basename(id.slice(8))!==id.slice(8)||!id.slice(8))throw Error('无效素材路径');
    target=path.join(data,id);
   }
   if(fs.existsSync(target)){
    const stat=fs.lstatSync(target);
    if(!stat.isFile()||stat.isSymbolicLink()||path.dirname(fs.realpathSync(target))!==fs.realpathSync(path.dirname(target)))throw Error('无效文件路径');
    fs.unlinkSync(target);
   }
   delete s[type][id];write(s);return {ok:true};
  },
  restore:(type,id)=>{if(!['assets','projects'].includes(type)||typeof id!=='string')throw Error('无效恢复项');const s=read();delete s[type][id];write(s);return {ok:true}},
 };
}
