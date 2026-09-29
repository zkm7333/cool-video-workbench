import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const MEDIA = /\.(mp4|mov|webm|gif)$/i;
const exists = async file => { try { await fs.access(file); return true; } catch { return false; } };

/** Keep Recordly projects editable in its complete, unmodified desktop app.
 * Only explicitly exported media crosses into the ShotCraft media library. */
export function createRecordlyBridge({root, data, execute, probe, appPath, hidden=()=>({})}) {
 const inbox = path.join(data, '录屏工作台', '导出成片');
 const manifest = path.join(data, 'recordly-imports.json');
 const uploads = path.join(data, 'uploads');
 const candidates = [appPath, process.env.STUDIO_RECORDLY_APP,
  path.join(data,'录屏工具','Recordly.app'),
  path.resolve(root, '../../modules/Recordly.app'),
  path.resolve(root, '../../../ShotCraft Studio.app/Contents/Resources/modules/Recordly.app')].filter(Boolean);
 let operation = Promise.resolve();
 const regionJobs=new Map();
 let activeRegion=null;
 const serial = fn => { const next=operation.then(fn,fn); operation=next.catch(()=>{}); return next; };
 const readImports = async () => { try { return JSON.parse(await fs.readFile(manifest,'utf8')); } catch { return {}; } };
 const saveImports = async value => {await fs.writeFile(manifest+'.tmp',JSON.stringify(value,null,2));await fs.rename(manifest+'.tmp',manifest);};
 const findApp = async () => {for(const candidate of candidates)if(await exists(path.join(candidate,'Contents/MacOS/Recordly')))return candidate;return null;};
 const mediaInfo = async file => {
  const metadata=await probe(file);const stream=metadata?.streams?.find(s=>s.codec_type==='video');
  const duration=Number(metadata?.format?.duration ?? stream?.duration);
  if(!stream || !Number.isFinite(duration) || duration<=0)throw Error('文件还未完成导出，或不是有效视频 / 动图，请稍后重试');
  return {duration,width:Number(stream.width)||0,height:Number(stream.height)||0};
 };
 const assertLocalFile = async (base, name) => {
  if(typeof name!=='string'||path.basename(name)!==name||!MEDIA.test(name))throw Error('请选择 MP4、MOV、WebM 或 GIF 成片');
  const target=path.join(base,name),actual=await fs.realpath(target),baseActual=await fs.realpath(base);
  if(path.dirname(actual)!==baseActual || !(await fs.stat(actual)).isFile())throw Error('素材路径无效');
  return actual;
 };
 const register = async (file, name, sourceKey) => {
  if(typeof file!=='string'||!file.startsWith('uploads/'))throw Error('请选择已导入的录屏成片');
  let full=await assertLocalFile(uploads,file.slice(8));
  const originalFile=file;
  await mediaInfo(full);
  if(/\.gif$/i.test(full)){
   const app=await findApp();
   if(!app)throw Error('GIF 动画接入需要完整录屏模块');
   const ffmpeg=path.join(app,'Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg');
   const target=full+'.mp4',temp=target+'.partial.mp4';
   try{
    await execute(ffmpeg,['-hide_banner','-loglevel','error','-i',full,'-an','-vf','scale=ceil(iw/2)*2:ceil(ih/2)*2','-pix_fmt','yuv420p','-movflags','+faststart','-y',temp]);
    await mediaInfo(temp);await fs.rename(temp,target);
   }catch(error){await fs.rm(temp,{force:true});throw error;}
   full=target;file=originalFile+'.mp4';
  }
  const info=await mediaInfo(full);
  const records=await readImports();
  const entry={file,name:typeof name==='string'?name.slice(0,160):path.basename(originalFile),kind:'video',...info,importedAt:Date.now()};
  records[sourceKey||originalFile]=entry;await saveImports(records);return entry;
 };
 return {
  regionStatus(id){const job=regionJobs.get(id);if(!job)throw Error('区域录制任务不存在');return {...job,child:undefined}},
  async previewRegion(){
   if(activeRegion)throw Error('请先结束当前区域录制');
   const preview=path.join(data,'录屏工作台','区域预览.png');
   await fs.mkdir(path.dirname(preview),{recursive:true});
   await new Promise(resolve=>setTimeout(resolve,2500));
   await execute('/usr/sbin/screencapture',['-x','-D1',preview]);
   const header=Buffer.alloc(24);const file=await fs.open(preview,'r');try{await file.read(header,0,24,0)}finally{await file.close()}
   if(header.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('未取得有效屏幕预览，请检查录屏权限');
   const display=JSON.parse(await execute(path.join(root,'bin/display-info'),[]));
   if(display.width<=0||display.height<=0)throw Error('无法读取主屏幕尺寸');
   return {image:'/api/recordly/region/preview-image?'+Date.now(),pixels:{width:header.readUInt32BE(16),height:header.readUInt32BE(20)},display};
  },
  previewFile(){return path.join(data,'录屏工作台','区域预览.png')},
  async clearPreview(){await fs.rm(path.join(data,'录屏工作台','区域预览.png'),{force:true});return {ok:true}},
  stopRegion(id){
   const job=regionJobs.get(id);if(!job||activeRegion!==id||!job.child)throw Error('没有正在录制的区域');
   job.status='stopping';job.message='正在保存录制视频…';job.child.stdin.write('q');job.child.stdin.end();
   return {ok:true};
  },
  async recordRegion({rect}={}){
   if(process.platform!=='darwin')throw Error('区域录制目前只支持 macOS');
   if(activeRegion)throw Error('区域录制正在进行，请先结束当前录制');
   const display=JSON.parse(await execute(path.join(root,'bin/display-info'),[]));
   if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||rect.width<64||rect.height<64||rect.x<display.x||rect.y<display.y||rect.x+rect.width>display.x+display.width||rect.y+rect.height>display.y+display.height)throw Error('请在主屏幕预览中选择至少 64 × 64 的区域');
   const r=Object.fromEntries(['x','y','width','height'].map(k=>[k,Math.round(rect[k])]));
   await fs.mkdir(inbox,{recursive:true});
   const id=crypto.randomUUID(),name=`区域录制-${new Date().toISOString().replace(/[:.]/g,'-')}.mov`;
   const output=path.join(inbox,name),job={id,name,status:'recording',message:'正在录制选中区域。完成后点击“停止并保存”',rect:r};
   regionJobs.set(id,job);activeRegion=id;
   const child=spawn('/usr/sbin/screencapture',['-v',`-R${r.x},${r.y},${r.width},${r.height}`,output],{stdio:['pipe','ignore','pipe']});
   job.child=child;let errorText='';child.stderr.on('data',chunk=>{errorText=(errorText+chunk).slice(-1200)});
   child.once('error',error=>{job.status='error';job.message=error.message;activeRegion=null});
   child.once('exit',async code=>{
    job.child=undefined;if(job.status==='error')return;
    try{
     const stat=await fs.stat(output);if(stat.size<1024)throw Error('录制文件为空');
     job.status='importing';job.message='正在接收录制片段…';
     const item=await serial(async()=>{
      const before=await fs.stat(output);await mediaInfo(output);
      const key=crypto.createHash('sha256').update(output+'\0'+before.size+'\0'+before.mtimeMs).digest('hex');
      const prior=(await readImports())[key];if(prior&&await exists(path.join(data,prior.file)))return prior;
      const destination='region-'+key.slice(0,16)+'.mov';
      const temp=path.join(uploads,destination+'.partial');await fs.copyFile(output,temp);
      const after=await fs.stat(output);
      if(before.size!==after.size||before.mtimeMs!==after.mtimeMs){await fs.rm(temp,{force:true});throw Error('录制仍在写入，请稍后重试')}
      await fs.rename(temp,path.join(uploads,destination));
      return register('uploads/'+destination,name,key);
     });
     job.status='done';job.message='区域录制已加入素材库';job.item=item;
    }catch(error){job.status='error';job.message=`录像未能接收：${error.message||errorText||code}`}
    finally{activeRegion=null;await fs.rm(path.join(data,'录屏工作台','区域预览.png'),{force:true})}
   });
   return {id};
  },
  async status(){
   await fs.mkdir(inbox,{recursive:true});
   const [app,records]=await Promise.all([findApp(),readImports()]);
   const imported=(await Promise.all(Object.values(records).map(async item=>await exists(path.join(data,item.file))&&!hidden()[item.file]?item:null))).filter(Boolean).sort((a,b)=>b.importedAt-a.importedAt);
   return {installed:!!app,version:'1.4.0',inbox,imports:imported,region:activeRegion?{id:activeRegion,status:regionJobs.get(activeRegion).status,message:regionJobs.get(activeRegion).message}:null};
  },
  async launch(){const app=await findApp();if(!app)throw Error('录屏模块尚未安装，请使用完整桌面版');await execute('/usr/bin/open',['-a',app]);return {opened:true};},
  async reveal(){await fs.mkdir(inbox,{recursive:true});await execute('/usr/bin/open',[inbox]);return {opened:true};},
  async inbox(){
   await fs.mkdir(inbox,{recursive:true});const files=await fs.readdir(inbox,{withFileTypes:true});
   return (await Promise.all(files.filter(f=>f.isFile()&&MEDIA.test(f.name)).map(async f=>{const s=await fs.stat(path.join(inbox,f.name));return {name:f.name,size:s.size,modified:s.mtimeMs};}))).sort((a,b)=>b.modified-a.modified);
  },
  register(file,name){return serial(()=>register(file,name));},
  importExport(name){return serial(async()=>{
   const full=await assertLocalFile(inbox,name);const before=await fs.stat(full);await mediaInfo(full);
   const key=crypto.createHash('sha256').update(full+'\0'+before.size+'\0'+before.mtimeMs).digest('hex');
   const prior=(await readImports())[key];if(prior&&await exists(path.join(data,prior.file)))return prior;
   const clean=name.replace(/[^\p{L}\p{N}_. -]/gu,'_').slice(-110);
   const destination='recordly-'+key.slice(0,16)+'-'+clean;
   const temp=path.join(uploads,destination+'.partial');await fs.copyFile(full,temp);
   const after=await fs.stat(full);
   if(before.size!==after.size||before.mtimeMs!==after.mtimeMs){await fs.unlink(temp);throw Error('成片仍在写入，完成后再接收');}
   await fs.rename(temp,path.join(uploads,destination));
   return register('uploads/'+destination,name,key);
  });},
 };
}
